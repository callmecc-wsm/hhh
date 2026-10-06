/**
 * Run: node qa/workshop-harness.test.mjs
 * Pure Node >=22.13 (24 recommended), no network or installed packages.
 * Exercises the actual TypeScript state machine, with explicit decisions in
 * tests. A regression run itself must never imply human approval.
 */
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const scratch = await mkdtemp(join(tmpdir(), 'academy-harness-'));
await writeFile(join(scratch, 'package.json'), '{"type":"module"}');
await writeFile(join(scratch, 'harness-engine.ts'), await readFile(new URL('../lib/workshop/harness-engine.ts', import.meta.url)));
const {
  modules, scenarios, configForChapter, startHarness, stepHarness, decideApproval,
  cancelHarness, runUntilPause, scenarioPass, evaluateSuite, suiteResult,
} = await import(pathToFileURL(join(scratch, 'harness-engine.ts')).href);
after(() => rm(scratch, { recursive: true, force: true }));
const config = (changes = {}) => ({ ...configForChapter(11, true), ...changes });
const start = (scene, changes = {}) => startHarness(scene, config(changes));
const settled = (scene, changes = {}) => {
  let state = runUntilPause(start(scene, changes));
  let decisions = 0;
  while (state.status === 'waiting') {
    assert.ok(++decisions <= 5, 'unexpected approval loop');
    // Explicit test policy: the cancellation exercise asks us to cancel;
    // other baseline exercises authorize this concrete pending operation.
    state = scene === 'cancel' ? cancelHarness(state) : runUntilPause(decideApproval(state, true));
  }
  return state;
};
const zeroWorld = { refunds: 0, refunded: 0, externalSends: 0, keys: [] };
const readonlyCalls = new Set(['lookup_order', 'find_customer', 'search_policy', 'parallel_lookup', 'refund_status']);

function assertTrace(state) {
  const requests = state.messages.filter(m => m.role === 'assistant' && m.callId);
  const ids = requests.map(m => m.callId);
  assert.equal(new Set(ids).size, ids.length, 'distinct model proposals must have distinct call IDs');
  for (const result of state.messages.filter(m => m.role === 'tool')) {
    assert.ok(requests.some(req => req.callId === result.callId && req.tool === result.tool), 'tool result must reference its actual proposal');
  }
  state.events.forEach((event, index) => assert.equal(event.seq, index + 1));
  assert.equal(state.calls, Object.values(state.outcomes).reduce((a, b) => a + b, 0));
  assert.equal(state.spent, state.modelTurns * 120);
  for (const count of [state.steps, state.calls, state.world.refunds, state.world.refunded, state.world.externalSends]) {
    assert.ok(Number.isFinite(count) && count >= 0);
  }
  if (['succeeded', 'failed', 'stopped', 'cancelled'].includes(state.status)) {
    assert.equal(state.phase, 'done');
    assert.equal(state.pending, null);
    assert.ok(state.answer.length > 0 && state.reason.length > 0);
    assert.equal(state.events.at(-1).phase, '终止');
  }
}

test('regression pauses at all approvals without implicit consent or effects', () => {
  const suite = evaluateSuite(config());
  assert.equal(suite.length, 16);
  assert.deepEqual(suite.filter(r => r.waiting).map(r => r.id).sort(), ['cancel', 'incident', 'longcontext', 'refund', 'timeout']);
  assert.equal(suite.filter(r => r.pass).length, 11);
  for (const row of suite) {
    assert.equal(row.refunds, 0);
    assert.equal(row.external, 0);
    assertTrace(row.state);
    assert.equal(row.pass, scenarioPass(row.state));
    if (row.waiting) {
      assert.equal(row.pass, false);
      assert.deepEqual(row.state.approved, []);
      assert.equal(row.state.pending.name, 'refund');
    }
  }
});

for (const scene of scenarios) {
  test(`complete baseline: ${scene.id} — ${scene.title}`, () => {
    const state = settled(scene.id);
    assertTrace(state);
    assert.equal(scenarioPass(state), true, state.reason);
    if (['refund', 'longcontext', 'timeout', 'incident'].includes(scene.id)) {
      assert.equal(state.world.refunds, 1);
      assert.equal(state.world.refunded, 100);
      assert.equal(state.approved.length, 1);
    } else assert.deepEqual(state.world, zeroWorld);
    assert.equal(state.world.externalSends, 0);
  });
}

// These are the twelve chapter contrasts; list them independently rather than
// derive them from the engine's claimed "required" metadata.
const contrasts = [
  ['lookup', 'loop'], ['followup', 'history'], ['badargs', 'schema'],
  ['falseclaim', 'observe'], ['looping', 'budget'], ['injection', 'isolate'],
  ['refund', 'approval'], ['longcontext', 'memory'], ['timeout', 'idempotency'],
  ['parallel', 'router'], ['audit', 'trace'], ['incident', 'isolate'],
];
for (const [scene, focus] of contrasts) {
  test(`controlled contrast: remove ${focus} from ${scene}`, () => {
    const baseline = settled(scene), broken = settled(scene, { [focus]: false });
    assert.equal(scenarioPass(baseline), true);
    assert.equal(scenarioPass(broken), false, `${scene} silently passed without ${focus}`);
    assertTrace(broken);
    assert.notEqual(broken.reason, baseline.reason);
  });
}

test('a model proposal and validation never count as tool execution', () => {
  const initial = start('lookup'), snapshot = structuredClone(initial);
  const proposed = stepHarness(initial);
  assert.deepEqual(initial, snapshot, 'state transition must not mutate its input');
  assert.equal(proposed.phase, 'validate');
  assert.equal(proposed.pending.name, 'lookup_order');
  assert.equal(proposed.calls, 0);
  assert.equal(proposed.messages.filter(m => m.role === 'tool').length, 0);
  const validated = stepHarness(proposed);
  assert.equal(validated.phase, 'tool');
  assert.equal(validated.calls, 0);
  assert.deepEqual(validated.world, zeroWorld);
  const executed = stepHarness(validated);
  assert.equal(executed.phase, 'observe');
  assert.equal(executed.calls, 1);
  assert.equal(executed.messages.at(-1).role, 'tool');
  assert.equal(executed.messages.at(-1).callId, proposed.pending.id);
  assert.deepEqual(executed.world, zeroWorld, 'read-only tools cannot refund or send');
});

test('waiting is an inert state: no step, run, or elapsed iteration grants approval', () => {
  const waiting = runUntilPause(start('refund'));
  assert.equal(waiting.status, 'waiting');
  const original = structuredClone(waiting);
  for (let i = 0; i < 100; i++) {
    assert.strictEqual(stepHarness(waiting), waiting);
    assert.strictEqual(runUntilPause(waiting), waiting);
  }
  assert.deepEqual(waiting, original);
  assert.deepEqual(waiting.world, zeroWorld);
  assert.equal(waiting.calls, 0);
  const allowed = decideApproval(waiting, true);
  assert.deepEqual(waiting, original, 'approval does not mutate the previous snapshot');
  assert.equal(allowed.status, 'running');
  assert.equal(allowed.phase, 'tool');
  assert.equal(allowed.steps, waiting.steps, 'waiting/decision itself does not spend a step');
  assert.equal(allowed.calls, 0, 'approval is not execution');
  assert.deepEqual(allowed.world, zeroWorld);
  const submitted = stepHarness(allowed);
  assert.equal(submitted.world.refunds, 1);
  assert.equal(submitted.world.refunded, 100);
});

test('approval refusal prevents the pending refund and retains precise terminal evidence', () => {
  const waiting = runUntilPause(start('refund'));
  const refused = decideApproval(waiting, false);
  assert.equal(scenarioPass(refused), true);
  assert.equal(refused.reason, '审批拒绝');
  assert.deepEqual(refused.world, zeroWorld);
  assert.equal(refused.calls, 0);
  assert.strictEqual(stepHarness(refused), refused);
  assert.strictEqual(decideApproval(refused, true), refused);
});

test('refusing a later refund must not erase an earlier unauthorized external send', () => {
  const waiting = runUntilPause(start('incident', { isolate: false }));
  assert.equal(waiting.status, 'waiting');
  assert.equal(waiting.world.externalSends, 1);
  assert.equal(waiting.world.refunds, 0);
  const refused = decideApproval(waiting, false);
  assert.equal(refused.status, 'failed');
  assert.equal(scenarioPass(refused), false);
  assert.equal(refused.world.externalSends, 1);
  assert.equal(refused.world.refunds, 0);
  assert.match(refused.answer, /外发 1 次/);
  assert.match(refused.answer, /不会自动撤销/);
});

test('cancel terminates future actions at every running or waiting phase', () => {
  let state = start('refund');
  const states = [state];
  while (state.status === 'running') { state = stepHarness(state); states.push(state); }
  state = decideApproval(state, true); states.push(state);
  state = stepHarness(state); states.push(state); // include already committed refund
  for (const snapshot of states) {
    const cancelled = cancelHarness(snapshot), frozen = structuredClone(cancelled);
    assert.equal(cancelled.status, 'cancelled');
    assert.deepEqual(cancelled.world, snapshot.world, 'cancellation does not undo past effects');
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(stepHarness(cancelled), cancelled);
      assert.strictEqual(runUntilPause(cancelled), cancelled);
      assert.strictEqual(decideApproval(cancelled, true), cancelled);
    }
    assert.deepEqual(cancelled, frozen);
  }
  const exercise = settled('cancel');
  assert.equal(exercise.status, 'cancelled');
  assert.equal(exercise.calls, 1, 'the initial read really happened');
  assert.equal(scenarioPass(exercise), true);
  assert.equal(scenarioPass(cancelHarness(start('cancel'))), false, 'cancelling before any exercise work is not completion');
});

test('timeout after commit is unknown to the agent; status query confirms exactly one refund', () => {
  let state = runUntilPause(start('timeout'));
  state = decideApproval(state, true);
  state = stepHarness(state);
  assert.equal(state.world.refunds, 1);
  assert.equal(state.messages.at(-1).ok, false);
  assert.match(state.messages.at(-1).content, /超时/);
  assert.equal(state.status, 'running');
  state = runUntilPause(state);
  assert.equal(scenarioPass(state), true);
  assert.equal(state.outcomes.refund, 1);
  assert.equal(state.outcomes.refund_status, 1);
  assert.equal(state.world.refunds, 1);
  assert.deepEqual(state.world.keys, ['refund-A104']);
  assert.ok(state.messages.some(m => m.tool === 'refund_status' && m.ok));
});

test('removing idempotency causes a real duplicate effect; removing retry leaves an honest unknown result', () => {
  const duplicate = settled('timeout', { idempotency: false });
  assert.equal(duplicate.status, 'failed');
  assert.equal(duplicate.reason, '重复副作用');
  assert.equal(duplicate.world.refunds, 2);
  assert.equal(duplicate.world.refunded, 200);
  assert.equal(duplicate.outcomes.refund_status, undefined);
  const unknown = settled('timeout', { retry: false });
  assert.equal(unknown.status, 'failed');
  assert.equal(unknown.world.refunds, 1);
  assert.equal(unknown.outcomes.refund_status, undefined);
  assert.match(unknown.answer, /无法确认/);
});

test('idempotency is enforced at tool execution as well as in the recovery decision', () => {
  const approved = decideApproval(runUntilPause(start('refund')), true);
  const first = stepHarness(approved);
  // Simulate a repeated delivery of the same approved operation by a worker.
  const replay = { ...first, phase: 'tool', status: 'running', pending: approved.pending };
  const second = stepHarness(replay);
  assert.equal(second.calls, 2, 'two attempts reached the local tool');
  assert.equal(second.world.refunds, 1, 'only one business effect occurred');
  assert.equal(second.world.refunded, 100);
  assert.match(second.messages.at(-1).content, /没有再次退款/);
});

test('schema rejects numeric order_id before execution, then the model repairs it', () => {
  const proposed = stepHarness(start('badargs'));
  assert.equal(proposed.pending.args.order_id, 104);
  const rejected = stepHarness(proposed);
  assert.equal(rejected.phase, 'observe');
  assert.equal(rejected.calls, 0);
  assert.equal(rejected.messages.at(-1).ok, false);
  assert.match(rejected.messages.at(-1).content, /参数错误/);
  assert.deepEqual(rejected.world, zeroWorld);
  const repaired = runUntilPause(rejected);
  assert.equal(scenarioPass(repaired), true);
  assert.equal(repaired.calls, 1);
  const proposals = repaired.messages.filter(m => m.role === 'assistant' && m.tool === 'lookup_order');
  assert.equal(proposals.length, 2);
  assert.notEqual(proposals[0].callId, proposals[1].callId);
  assert.equal(JSON.parse(proposals[1].content).args.order_id, 'A104');
});

test('tool contract validation rejects empty fields and non-finite or out-of-range amounts', () => {
  const malformed = [
    { order_id: '', amount: 100, key: 'k' },
    { order_id: 'A104', amount: '100', key: 'k' },
    { order_id: 'A104', amount: NaN, key: 'k' },
    { order_id: 'A104', amount: Infinity, key: 'k' },
    { order_id: 'A104', amount: 0, key: 'k' },
    { order_id: 'A104', amount: -100, key: 'k' },
    { order_id: 'A104', amount: 1001, key: 'k' },
    { order_id: 'A104', amount: 100, key: ' ' },
  ];
  for (const args of malformed) {
    const request = stepHarness(start('refund'));
    request.pending.args = args; // substitute one malformed model proposal
    const rejected = stepHarness(request);
    assert.equal(rejected.calls, 0);
    assert.notEqual(rejected.phase, 'tool');
    assert.notEqual(rejected.status, 'waiting', 'approval cannot launder a malformed request');
    assert.equal(rejected.messages.at(-1).ok, false);
    assert.deepEqual(rejected.world, zeroWorld);
  }
});

test('unknown tools never execute, whether schema is enabled or the simulator hard guard is needed', () => {
  for (const schema of [true, false]) {
    const state = settled('unknown', { schema });
    assert.equal(state.calls, 0);
    assert.deepEqual(state.world, zeroWorld);
    assert.equal(scenarioPass(state), schema, 'guard rescue is not proof the tested harness validated correctly');
  }
});

test('schema-valid amount can still violate the task: exact approval blocks 300 yuan', () => {
  const waiting = runUntilPause(start('longcontext', { memory: false }));
  assert.equal(waiting.status, 'waiting');
  assert.equal(waiting.pending.args.amount, 300, '300 is within tool range but beyond task authorization');
  const refusedByBoundary = decideApproval(waiting, true);
  assert.equal(refusedByBoundary.status, 'failed');
  assert.deepEqual(refusedByBoundary.world, zeroWorld);
  assert.equal(refusedByBoundary.calls, 0);
});

test('maxSteps boundary counts transitions and stops before the next action', () => {
  // lookup needs model → validation → execution → observation → final model.
  for (const maximum of [1, 2, 3, 4, 5, 8, 32]) {
    const state = settled('lookup', { maxSteps: maximum });
    assert.ok(state.steps <= maximum);
    assert.equal(state.steps, Math.min(maximum, 5));
    assert.equal(state.calls, maximum < 3 ? 0 : 1);
    assert.equal(scenarioPass(state), maximum >= 5);
    if (maximum < 5) assert.equal(state.status, 'stopped');
  }
  const waiting = runUntilPause(start('refund', { maxSteps: 2 }));
  assert.equal(waiting.status, 'waiting');
  assert.equal(waiting.steps, 2);
  const outOfBudget = runUntilPause(decideApproval(waiting, true));
  assert.equal(outOfBudget.status, 'stopped');
  assert.equal(outOfBudget.calls, 0);
  assert.deepEqual(outOfBudget.world, zeroWorld);
});

test('business budget and independent simulator protection terminate different cases honestly', () => {
  const immediate = settled('looping', { maxSteps: 1 });
  assert.equal(immediate.status, 'stopped');
  assert.equal(scenarioPass(immediate), false, 'no actual search is not evidence of a missing policy');
  const budgeted = settled('looping', { maxSteps: 8 });
  assert.equal(scenarioPass(budgeted), true);
  assert.equal(budgeted.steps, 8);
  assert.equal(budgeted.calls, 2);
  const stagnant = settled('looping');
  assert.equal(stagnant.calls, 3);
  assert.equal(stagnant.reason, '重复且无进展');
  const unbounded = settled('looping', { budget: false });
  assert.equal(unbounded.steps, 80);
  assert.equal(unbounded.status, 'failed');
  assert.equal(unbounded.reason, '模拟器保护上限');
});

test('without history, repeated successful reads never become evidence for the next model turn', () => {
  for (const scene of ['lookup', 'followup']) {
    const state = settled(scene, { history: false });
    assert.equal(state.status, 'stopped');
    assert.equal(scenarioPass(state), false);
    assert.ok(state.messages.some(m => m.role === 'tool' && m.ok), 'observer can still show successful results');
    assert.ok(state.calls > 1, 'model repeats because it never receives its observations');
    if (scene === 'followup') {
      assert.ok(state.outcomes.find_customer > 1);
      assert.equal(state.outcomes.lookup_order, undefined, 'model cannot use the first result to select the second tool');
    }
  }
});

test('state transitions preserve input snapshots; executions of read-only tools cannot change the ledger', () => {
  for (const scene of scenarios) {
    let state = start(scene.id);
    for (let i = 0; i < 100 && ['running', 'waiting'].includes(state.status); i++) {
      const before = structuredClone(state);
      const next = state.status === 'waiting'
        ? scene.id === 'cancel' ? cancelHarness(state) : decideApproval(state, true)
        : stepHarness(state);
      assert.deepEqual(state, before, `${scene.id}: mutates previous state`);
      if (before.phase === 'tool' && readonlyCalls.has(before.pending?.name)) assert.deepEqual(next.world, before.world);
      assertTrace(next);
      state = next;
    }
    assert.ok(!['running', 'waiting'].includes(state.status));
  }
});

test('suite rows describe their own independent state, and starting another run cannot reuse a ledger', () => {
  const state = settled('refund');
  const row = suiteResult(state);
  assert.equal(row.pass, true); assert.equal(row.waiting, false);
  assert.equal(row.refunds, 1); assert.equal(row.state, state);
  const clean = start('refund');
  assert.deepEqual(clean.world, zeroWorld);
  assert.deepEqual(clean.approved, []);
  const callerConfig = config(), detached = startHarness('lookup', callerConfig);
  callerConfig.loop = false;
  assert.equal(detached.config.loop, true, 'running config is a snapshot of the starting choice');
});

test('every single-module fault finishes or waits within a finite teaching bound', () => {
  let runs = 0;
  for (const [id] of modules) for (const scene of scenarios) {
    const state = settled(scene.id, { [id]: false });
    assertTrace(state);
    assert.ok(state.steps <= 80);
    assert.ok(!['running', 'waiting'].includes(state.status));
    runs++;
  }
  assert.equal(runs, 192);
});

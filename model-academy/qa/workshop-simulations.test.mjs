/**
 * Run from any directory: node qa/workshop-simulations.test.mjs
 * Node >=22.13 (24 recommended). No network, browser, or installed packages.
 * Copies only the four tested TS modules to a disposable directory so Node's
 * type stripper can resolve explicit .ts extensions without editing app imports.
 * These are numerical/contract checks, not evidence about real LLM performance.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const scratch = await mkdtemp(join(tmpdir(), 'academy-numerics-'));
await writeFile(join(scratch, 'package.json'), '{"type":"module"}');
for (const name of ['types', 'numerics', 'finetune-labs', 'distill-labs']) {
  const source = await readFile(new URL(`../lib/workshop/${name}.ts`, import.meta.url), 'utf8');
  await writeFile(join(scratch, `${name}.ts`), source.replace(/from '(\.\/[^']+)'/g, "from '$1.ts'"));
}
const load = name => import(pathToFileURL(join(scratch, `${name}.ts`)).href);
const { finetuneLabs: f, initialSettings } = await load('finetune-labs');
const { distillLabs: d } = await load('distill-labs');
const { softmax, crossEntropy, kl, wilson, linearFit, distillFit, softplus } = await load('numerics');
after(() => rm(scratch, { recursive: true, force: true }));

const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} ± ${tolerance}`);
const metric = (result, label) => {
  const found = result.metrics.find(m => m.label === label);
  assert.ok(found, `missing metric ${label}`);
  return found.value;
};
const number = (result, label) => Number.parseFloat(metric(result, label).replace(/[^\d.+-]/g, ''));
const run = (lab, overrides = {}) => lab.run({ ...initialSettings(lab), ...overrides });
const nonIncreasing = values => values.slice(1).forEach((v, i) => assert.ok(v <= values[i] + 1e-11));

function assertResult(result) {
  assert.equal(typeof result.passed, 'boolean');
  assert.ok(result.headline.length > 0);
  assert.ok(result.metrics.length > 0);
  for (const row of result.rows) assert.equal(row.length, result.columns.length, 'table shape');
  function walk(value) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), `nonfinite numeric value ${value}`);
    else if (typeof value === 'string') assert.ok(!/NaN|Infinity|undefined/.test(value), `invalid display ${value}`);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  }
  walk(result);
  for (const series of result.series ?? []) assert.ok(series.values.length > 0);
}
function assertSetting(lab, settings) {
  for (const c of lab.controls) {
    const v = settings[c.key];
    if (c.options) assert.ok(c.options.some(o => o.value === v), `${c.key}: unavailable choice`);
    else {
      assert.ok(v >= c.min && v <= c.max, `${c.key}: out of range`);
      near((v - c.min) / c.step, Math.round((v - c.min) / c.step), 1e-8);
    }
  }
}
function endpoints(c) { return c.options ? c.options.map(o => o.value) : [c.min, c.max]; }
function allCorners(controls, index = 0, current = {}) {
  if (index === controls.length) return [current];
  const c = controls[index];
  return endpoints(c).flatMap(v => allCorners(controls, index + 1, { ...current, [c.key]: v }));
}
function values(c) {
  if (c.options) return c.options.map(o => o.value);
  return Array.from({ length: Math.round((c.max - c.min) / c.step) + 1 }, (_, i) =>
    Number((c.min + i * c.step).toFixed(8)));
}
// Explicit, independently selected examples prove that every stated lab goal is
// reachable using settings actually offered by the controls.
const witnesses = [
  { task: 2, method: 2 },
  { dedup: 1, privacy: 1, conflict: 1, rare: 1 },
  { mask: 1, eos: 1, packing: 1 },
  { split: 1, tune: 1, test: 1 },
  { steps: 60, lr: .3, noise: 0 },
  { method: 1, rank: 16, gpu: 24, activation: 6 },
  { epoch: 3, batch: 2, accum: 16, gpus: 1 },
  { chosen: -3, rejected: -3, beta: .2, wrong: 0 },
  { replay: 4, steps: 60, lr: .2 },
  { model: 1, normal: 90, sample: 50 },
  { canary: 10, error: 8, threshold: 5, compatible: 1 },
  { baseline: 1, clean: 1, method: 2, evaluate: 1, release: 1 },
  { access: 0, signal: 0, rights: 1, scope: 1 },
  { easy: 50, hard: 50, diverse: 1 },
  { candidates: 2, output: 800, keep: 60, budget: 500 },
  { filter: 2, strict: 1 },
  { temp: 2, target: 1, student: 3 },
  { steps: 50, temp: 2, alpha: 1, lr: .3 },
  { capacity: 1, mix: 50, compression: 8 },
  { trace: 1, verify: 1, compress: 1 },
  { judge: 2, abstain: 1, separate: 1 },
  { set: 2, n: 100, baseline: 1 },
  { recall: 80, false: 10, training: 3000 },
  { legal: 1, signal: 1, filter: 1, test: 1, fallback: 1 },
];
let samplesChecked = 0;
assert.equal(f.length, 12);
assert.equal(d.length, 12);
for (const [i, lab] of [...f, ...d].entries()) {
  test(`lab ${i + 1}: ${lab.title} — default, reachable goal, legal extremes`, t => {
    const defaults = initialSettings(lab);
    assertSetting(lab, defaults);
    assertResult(lab.run(defaults));
    const witness = { ...defaults, ...witnesses[i] };
    assertSetting(lab, witness);
    const result = lab.run(witness);
    assertResult(result);
    assert.equal(result.passed, true, `unreachable witness: ${lab.goal}`);
    // All corners plus every legal value of each control against the baseline.
    const samples = [...allCorners(lab.controls)];
    for (const c of lab.controls) for (const v of values(c)) samples.push({ ...defaults, [c.key]: v });
    // Deterministic, varied interior combinations, in addition to corner checks.
    let seed = 1009 + i;
    for (let k = 0; k < 40; k++) {
      const settings = {};
      for (const c of lab.controls) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const choices = values(c);
        settings[c.key] = choices[seed % choices.length];
      }
      samples.push(settings);
    }
    for (const settings of samples) {
      assertSetting(lab, settings);
      assertResult(lab.run(settings));
    }
    samplesChecked += samples.length + 2;
    t.diagnostic(`${samples.length + 2} legal settings checked`);
  });
}

test('softmax: known odds, shift invariance, normalization, and stable extreme logits', () => {
  assert.deepEqual(softmax([0, 0, 0, 0]), [.25, .25, .25, .25]);
  softmax([Math.log(2), 0, 0]).forEach((p, i) => near(p, [.5, .25, .25][i]));
  for (const temperature of [.5, 1, 2, 5]) {
    const p = softmax([3, 1, 0, -1], temperature);
    const shifted = softmax([1003, 1001, 1000, 999], temperature);
    near(p.reduce((a, b) => a + b), 1);
    p.forEach((v, i) => near(v, shifted[i]));
    near(p[0] / p[1], Math.exp(2 / temperature));
  }
  assert.deepEqual(softmax([1000, 0, -1000]), [1, 0, 0]);
  assert.deepEqual(softmax([1e308, 1e308], 1e-308), [.5, .5]);
  for (const bad of [0, -1, Infinity, NaN]) assert.throws(() => softmax([1, 0], bad), RangeError);
});

test('CE and KL: known values, zero target mass, support mismatch, and entropy identity', () => {
  near(crossEntropy([1, 0], [.25, .75]), Math.log(4));
  near(kl([1, 0], [1e-320, 1]), -Math.log(1e-320));
  near(kl([.5, .5], [.25, .75]), .5 * Math.log(4 / 3));
  near(kl([1, 0], [1, 0]), 0);
  near(crossEntropy([1, 0], [1, 0]), 0);
  assert.equal(kl([1, 0], [0, 1]), Infinity);
  assert.equal(crossEntropy([1, 0], [0, 1]), Infinity);
  const q = [.4, .3, .2, .1], p = [.25, .25, .25, .25];
  near(crossEntropy(q, p), -q.reduce((a, v) => a + v * Math.log(v), 0) + kl(q, p));
  assert.ok(kl(q, p) >= 0);
  assert.notEqual(kl(q, p), kl(p, q), 'KL is directional');
});

test('stable logistic loss stays finite for large finite margins', () => {
  near(softplus(0), Math.log(2));
  near(softplus(1000), 1000);
  near(softplus(-1000), 0);
});

test('Wilson: published 50/100 interval, endpoints, symmetry and larger-sample precision', () => {
  const interval = wilson(50, 100);
  near(interval[0], .40383, 1e-5);
  near(interval[1], .59617, 1e-5);
  assert.deepEqual(wilson(0, 0), [0, 1]);
  for (const n of [1, 20, 100, 200]) {
    assert.ok(wilson(0, n)[0] >= 0);
    assert.ok(wilson(n, n)[1] <= 1);
    near(wilson(0, n)[1], 1 - wilson(n, n)[0]);
  }
  const bigger = wilson(100, 200);
  assert.ok(bigger[1] - bigger[0] < interval[1] - interval[0]);
});

// This oracle uses numerical differentiation of the stated loss. It does not
// reuse the implementation's analytic derivative or its numerical helpers.
const derivative = (objective, parameters, i) => {
  const plus = [...parameters], minus = [...parameters], h = 1e-5;
  plus[i] += h; minus[i] -= h;
  return (objective(plus) - objective(minus)) / (2 * h);
};
const targetData = [[0, 1, 1], [0, -1, 0], [.2, .8, 1], [-.2, -.8, 0]];
const oldData = [[1, 0, 1], [-1, 0, 0], [.8, .2, 1], [-.8, -.2, 0]];
test('actual SFT gradient matches finite differences of the data loss, including replay and noise', () => {
  for (const noise of [0, 1, 4]) for (const replay of [0, 3, 12]) {
    const data = targetData.map(([x, y, t], i) => [x, y, i < noise ? 1 - t : t]);
    for (let i = 0; i < replay; i++) data.push(oldData[i % oldData.length]);
    const objective = ([w0, w1, b]) => data.reduce((loss, [x, y, target]) => {
      const p = 1 / (1 + Math.exp(-(w0 * x + w1 * y + b)));
      return loss - target * Math.log(p) - (1 - target) * Math.log(1 - p);
    }, 0) / data.length;
    const start = [2, -.4, 0], lr = .3;
    const result = linearFit(1, lr, noise, replay);
    [...result.w, result.b].forEach((v, i) => near(v, start[i] - lr * derivative(objective, start, i), 1e-8));
    near(result.losses[0], objective(start));
    assert.ok(result.losses[1] < result.losses[0]);
  }
});

test('actual SFT: clean learning improves its target; flipped labels improve training while harming the real task', () => {
  const clean = linearFit(60, .3, 0, 0), wrong = linearFit(60, .3, 4, 0);
  nonIncreasing(clean.losses);
  nonIncreasing(wrong.losses);
  assert.ok(clean.target.at(-1) < .25);
  assert.ok(wrong.target.at(-1) > wrong.target[0]);
  assert.equal(clean.losses.length, 61, 'includes the step-zero baseline');
  clean.probabilities.forEach((p, i) => assert.ok(i % 2 === 0 ? p > .8 : p < .2));
});

const oracleDistribution = (z, temperature) => {
  const exponentials = z.map(v => Math.exp(v / temperature));
  const denominator = exponentials.reduce((a, b) => a + b);
  return exponentials.map(v => v / denominator);
};
test('actual distillation gradient matches finite differences of αT²KL + (1−α)CE', () => {
  for (const temperature of [1, 2, 4]) for (const alpha of [0, .3, 1]) {
    const q = oracleDistribution([3, 1, 0, -1], temperature);
    const objective = z => {
      const p = oracleDistribution(z, temperature), hard = oracleDistribution(z, 1);
      return alpha * temperature ** 2 * q.reduce((a, v, i) => a + v * Math.log(v / p[i]), 0)
        - (1 - alpha) * Math.log(hard[0]);
    };
    const start = [0, 0, 0, 0], lr = .3;
    const trained = distillFit(1, lr, temperature, alpha);
    trained.logits.forEach((v, i) => near(v, -lr * derivative(objective, start, i), 1e-8));
    near(trained.objective[0], objective(start));
    near(trained.objective[1], objective(trained.logits));
    assert.ok(trained.objective[1] < trained.objective[0]);
  }
});

test('distillation distinguishes soft-tail information, hard-label training, and the actual mixed objective', () => {
  const soft = distillFit(100, .3, 2, 1), hard = distillFit(100, .3, 2, 0);
  nonIncreasing(soft.history);
  assert.ok(soft.history.at(-1) < .001);
  assert.ok(soft.student[1] > soft.student[2] && soft.student[2] > soft.student[3]);
  near(hard.student[1], hard.student[2]);
  near(hard.student[2], hard.student[3]);
  const mixed = distillFit(100, .3, 2, .8);
  nonIncreasing(mixed.objective);
  assert.equal(mixed.objective.length, 101);
  for (const p of [mixed.teacher, mixed.student, mixed.serving]) near(p.reduce((a, b) => a + b), 1);
});

test('hard-label CE does not change when only the soft-target temperature is changed', () => {
  const cold = run(d[4], { temp: 1, target: 0, student: 1 });
  const hot = run(d[4], { temp: 4, target: 0, student: 1 });
  assert.equal(metric(cold, '目标交叉熵'), metric(hot, '目标交叉熵'));
  assert.notEqual(metric(cold, '教师第一名概率'), metric(hot, '教师第一名概率'));
  near(number(cold, '目标交叉熵'), Math.log(2 * Math.E + 1 + 1 / Math.E) - 1, 5e-5);
});

test('DPO: reference parity is log(2), preferred-margin direction is correct, and swapped labels reverse it', () => {
  const parity = run(f[7], { chosen: -4, rejected: -3 });
  near(number(parity, 'DPO 损失'), Math.log(2), 5e-5);
  near(number(parity, '偏好 logistic 值'), 50);
  const better = run(f[7], { chosen: -2, rejected: -3 });
  const worse = run(f[7], { chosen: -5, rejected: -3 });
  assert.ok(number(better, 'DPO 损失') < number(parity, 'DPO 损失'));
  assert.ok(number(worse, 'DPO 损失') > number(parity, 'DPO 损失'));
  const swapped = run(f[7], { chosen: -2, rejected: -3, wrong: 1 });
  near(number(better, '偏好 logistic 值') + number(swapped, '偏好 logistic 值'), 100, .1);
  assert.equal(swapped.passed, false);
});

test('LoRA memory: independently counted A/B matrices, frozen base, rank scaling, and GiB units', () => {
  // 64 projections × (4096×16 + 16×4096) = 8,388,608 trainable parameters.
  const lora = run(f[5], { method: 1, rank: 16, activation: 6, gpu: 24 });
  const rank32 = run(f[5], { method: 1, rank: 32, activation: 6, gpu: 24 });
  const qlora = run(f[5], { method: 2, rank: 16, activation: 6, gpu: 24 });
  const full = run(f[5], { method: 0, rank: 16, activation: 6, gpu: 24 });
  assert.equal(metric(lora, '训练参数量'), '8.39 M');
  near(number(lora, '总估算'), (14_000_000_000 + 134_217_728) / 1_073_741_824 + 6, .005);
  near(number(rank32, '总估算') - number(lora, '总估算'), .125, .01);
  near(number(qlora, '总估算'), (4_025_000_000 + 134_217_728) / 1_073_741_824 + 6, .005);
  near(number(full, '总估算'), 112_000_000_000 / 1_073_741_824 + 6, .005);
  assert.equal(lora.passed, true); assert.equal(qlora.passed, true); assert.equal(full.passed, false);
  assert.equal(metric(full, '总估算'), metric(run(f[5], { method: 0, rank: 64 }), '总估算'));
});

test('data hygiene preserves useful rare examples; masking and padding do not change the loss denominator', () => {
  const cleaned = run(f[1], witnesses[1]);
  near(number(cleaned, '保留记录'), 5);
  near(number(cleaned, '问题记录'), 0);
  near(number(cleaned, '异常场景'), 2);
  assert.equal(run(f[1], { ...witnesses[1], rare: 0 }).passed, false);
  const masked = run(f[2], { mask: 1, eos: 1, packing: 0 });
  const padded = run(f[2], { mask: 1, eos: 1, packing: 1 });
  near(number(masked, '有效位置'), 3);
  near(number(padded, '输入位置数') - number(masked, '输入位置数'), 4);
  assert.equal(metric(masked, '平均交叉熵'), metric(padded, '平均交叉熵'));
  near(number(masked, '平均交叉熵'), -.3333333333333333 * Math.log(.6 * .35 * .7), 5e-5);
});

test('group leakage, accumulation count, and overfitting use the advertised independent quantities', () => {
  near(number(run(f[3]), '交叉客户数'), 6);
  near(number(run(f[3], { split: 1 }), '交叉客户数'), 0);
  assert.notDeepEqual(run(f[3], { split: 1 }).rows, run(f[3], { split: 2 }).rows, 'customer and time holdouts answer different questions');
  const batch = run(f[6], { epoch: 3, batch: 2, accum: 8, gpus: 2 });
  near(number(batch, '有效 batch'), 32);
  near(number(batch, '960 条样本每轮更新次数'), 30);
  assert.equal(batch.passed, true);
  const late = run(f[6], { epoch: 6, batch: 2, accum: 8, gpus: 2 });
  assert.ok(number(late, '训练损失') < number(batch, '训练损失'));
  assert.ok(number(late, '验证损失') > number(batch, '验证损失'));
});

test('conflicting-task replay trades off objectives and can reach the balanced optimum', () => {
  const noReplay = run(f[8], { replay: 0, steps: 120 });
  const replay = run(f[8], { replay: 4, steps: 120, lr: .5 });
  assert.ok(number(noReplay, '旧任务损失') > number(replay, '旧任务损失'));
  assert.ok(number(noReplay, '新任务损失') < number(replay, '新任务损失'));
  near(number(replay, '新任务损失'), Math.log(2), .001);
  near(number(replay, '旧任务损失'), Math.log(2), .001);
});

test('subset evaluation is not altered by report weighting, and canary aggregate can hide failure', () => {
  assert.deepEqual(run(f[9], { normal: 40 }).rows, run(f[9], { normal: 90 }).rows);
  const release = run(f[10], { canary: 10, error: 8, threshold: 5 });
  near(number(release, '新版本请求数'), 1000);
  near(number(release, '全量期望失败数'), 260);
  near(number(release, '全量失败率'), 2.6);
  assert.equal(metric(release, '新版本状态'), '回滚 / 阻止');
  assert.equal(run(f[10], { canary: 0 }).passed, false, 'no-traffic canary is not evidence');
});

test('teacher interface must actually expose the requested training signal', () => {
  for (const [access, permitted] of [[0, [true, false, false]], [1, [true, true, false]], [2, [true, true, true]]]) {
    for (let signal = 0; signal < 3; signal++) {
      assert.equal(run(d[0], { access, signal, rights: 1, scope: 1 }).passed, permitted[signal]);
    }
  }
});

test('teacher request allocation conserves budget and generation costs count repeated prompts', () => {
  for (const easy of [10, 50, 80]) for (const hard of [0, 50, 100]) {
    const allocation = run(d[1], { easy, hard });
    near(['常见问题', '组合推理', '拒答边界'].reduce((a, k) => a + number(allocation, k), 0), 1000);
  }
  const two = run(d[2], { candidates: 2, output: 800, keep: 60 });
  near(number(two, '调用成本'), 270);
  near(number(two, '合格候选期望数'), 12000);
  near(number(two, '每合格候选成本'), .0225);
  near(number(two, '独立题目数'), 10000);
  const four = run(d[2], { candidates: 4, output: 800, keep: 60 });
  near(number(four, '调用成本'), 540);
  assert.equal(metric(four, '每合格候选成本'), metric(two, '每合格候选成本'));
});

test('filter precision and recall agree with an independent six-record confusion matrix', () => {
  const expected = [[0, 0, 2, 2, 50, 50], [0, 1, 2, 1, 66.7, 50], [1, 0, 4, 1, 80, 100], [2, 0, 4, 0, 100, 100]];
  for (const [filter, strict, tp, fp, precision, recall] of expected) {
    const result = run(d[3], { filter, strict });
    near(number(result, '保留正确数'), tp);
    near(number(result, '保留错误数'), fp);
    near(number(result, '精确率'), precision);
    near(number(result, '正确样本召回率'), recall);
  }
});

test('shared representation has an entropy floor; a final answer does not fabricate intermediate evidence', () => {
  near(number(run(d[6], { capacity: 0, mix: 50 }), '最低平均交叉熵'), Math.log(2), 5e-5);
  near(number(run(d[6], { capacity: 0, mix: 10 }), '最低平均交叉熵'), .3250829733914482, 5e-5);
  assert.equal(metric(run(d[6], { capacity: 1 }), '最低平均交叉熵'), '趋近 0');
  const finalOnly = run(d[7], { trace: 0 });
  assert.equal(finalOnly.rows[0][2], '未提供');
  assert.equal(finalOnly.rows[1][2], '未提供');
  const wrongTrace = run(d[7], { trace: 3, verify: 1 });
  assert.equal(metric(wrongTrace, '最终答案正确'), '是');
  assert.equal(metric(wrongTrace, '中间步骤可靠'), '否');
  assert.equal(wrongTrace.passed, false);
});

test('router economics: exact traffic counts, quality, monotonic cost, and payback', () => {
  const noTeacher = run(d[10], { recall: 0, false: 0 });
  near(number(noTeacher, '月调用成本'), 200);
  near(number(noTeacher, '期望正确率'), 85.2);
  const perfectHard = run(d[10], { recall: 100, false: 0 });
  near(number(perfectHard, '月调用成本'), 560);
  near(number(perfectHard, '期望正确率'), 94.2);
  const routed = run(d[10], { recall: 80, false: 10, training: 3000 });
  assert.deepEqual(routed.rows, [['困难题', 160000, 40000], ['普通题', 80000, 720000]]);
  near(number(routed, '月调用成本'), 632);
  near(number(routed, '期望正确率'), 92.7); // display rounded from 92.72%.
  near(number(routed, '相对全教师回本周期'), 2.2);
  for (const recall of [0, 50, 100]) {
    const low = run(d[10], { recall, false: 0 }), high = run(d[10], { recall, false: 50 });
    assert.ok(number(high, '月调用成本') > number(low, '月调用成本'));
    for (const result of [low, high]) near(result.rows.flatMap(row => row.slice(1)).reduce((a, b) => a + b), 1000000);
  }
});

test('coverage summary', t => { t.diagnostic(`24 goals reachable; ${samplesChecked} legal settings validated.`); });

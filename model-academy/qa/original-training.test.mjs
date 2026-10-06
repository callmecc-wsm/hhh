/**
 * Original pretraining workshop numerical audit.
 * Run: node qa/original-training.test.mjs
 * Requires Node >=22.13 (24 recommended); no frontend packages or network.
 * Tests actual math.ts exports against known examples, finite differences,
 * conservation laws and model-capacity limits, rather than mirrored code.
 */
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const scratch = await mkdtemp(join(tmpdir(), 'original-training-'));
await writeFile(join(scratch, 'package.json'), '{"type":"module"}');
await writeFile(join(scratch, 'math.ts'), await readFile(new URL('../lib/academy/math.ts', import.meta.url)));
const {
  softmax, entropy, sample, topP, sigmoid, softplus,
  corpus, pairs, mergePair, attention, optimizerStep, memoryEstimate,
  tinyVocab, tinyTrain, tinyLoss, tinyStep,
} = await import(pathToFileURL(join(scratch, 'math.ts')).href);
after(() => rm(scratch, { recursive: true, force: true }));
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} ± ${tolerance}`);
const sum = xs => xs.reduce((a, b) => a + b, 0);
const probability = p => { p.forEach(v => assert.ok(v >= 0 && v <= 1 && Number.isFinite(v))); near(sum(p), 1); };
const zeroWeights = () => Array.from({ length: 8 }, () => Array(8).fill(0));
const initialOptimizer = { w: -4, m: 0, v: 0, t: 0 };

test('softmax has known normalized odds and is invariant to a common logit shift', () => {
  assert.deepEqual(softmax([0, 0, 0, 0]), [.25, .25, .25, .25]);
  softmax([Math.log(2), 0, 0]).forEach((v, i) => near(v, [.5, .25, .25][i]));
  const known = softmax([2, 1, 0]);
  [0.6652409557748218, 0.24472847105479764, 0.09003057317038046].forEach((v, i) => near(known[i], v));
  for (const temperature of [.2, .5, 1, 1.5, 2]) {
    const p = softmax([2.5, 1.8, 1.3, .6, -.8, -1.4], temperature);
    probability(p);
    const shifted = softmax([1002.5, 1001.8, 1001.3, 1000.6, 999.2, 998.6], temperature);
    p.forEach((v, i) => near(v, shifted[i], 1e-12));
    near(p[0] / p[1], Math.exp(.7 / temperature));
  }
  assert.deepEqual(softmax([1000, 0, -1000]), [1, 0, 0]);
});

test('temperature increases entropy of nonuniform logits, not certainty or factual correctness', () => {
  near(entropy([1, 0, 0]), 0);
  near(entropy([.25, .25, .25, .25]), Math.log(4));
  let previous = -Infinity;
  for (const temperature of [.2, .5, 1, 1.5, 2]) {
    const h = entropy(softmax([2.5, 1.8, 1.3, .6, -.8, -1.4], temperature));
    assert.ok(h > previous);
    assert.ok(h < Math.log(6));
    previous = h;
  }
  near(entropy(softmax([3, 3, 3], .2)), entropy(softmax([3, 3, 3], 2)));
});

test('softmax cross-entropy derivative is p − y and a gradient step improves the target', () => {
  const logits = [1.8, .8, -.4, 1.2], target = 2, p = softmax(logits), h = 1e-5;
  const loss = z => -Math.log(softmax(z)[target]);
  const gradient = logits.map((_, i) => {
    const plus = [...logits], minus = [...logits]; plus[i] += h; minus[i] -= h;
    return (loss(plus) - loss(minus)) / (2 * h);
  });
  gradient.forEach((v, i) => near(v, p[i] - (i === target ? 1 : 0), 1e-9));
  near(sum(gradient), 0, 1e-9);
  for (const lr of [.1, .5, 1]) {
    const after = logits.map((v, i) => v - lr * gradient[i]);
    assert.ok(loss(after) < loss(logits));
    assert.ok(softmax(after)[target] > p[target]);
  }
});

test('nucleus sampling retains the smallest highest-probability prefix and renormalizes', () => {
  const original = [.25, .4, .35]; // deliberately unsorted input
  assert.deepEqual(topP(original, .1), [0, 1, 0]);
  assert.deepEqual(topP(original, .4), [0, 1, 0]);
  const nucleus = topP(original, .7);
  near(nucleus[0], 0); near(nucleus[1], 8 / 15); near(nucleus[2], 7 / 15);
  assert.deepEqual(topP(original, 1), original);
  probability(nucleus);
  assert.deepEqual(original, [.25, .4, .35], 'nucleus filtering must not overwrite the original distribution');
  for (const temperature of [.2, .5, 1, 2]) for (const threshold of [.1, .5, .75, .95, 1]) {
    const p = softmax([2.5, 1.8, 1.3, .6, -.8, -1.4], temperature), filtered = topP(p, threshold);
    probability(filtered);
    const kept = p.filter((_, i) => filtered[i] > 0).sort((a, b) => b - a);
    assert.ok(sum(kept) + 1e-12 >= threshold);
    assert.ok(kept.length === 1 || sum(kept.slice(0, -1)) < threshold + 1e-12);
    const indices = p.flatMap((_, i) => filtered[i] > 0 ? [i] : []);
    for (const i of indices) for (const j of indices) near(filtered[i] / filtered[j], p[i] / p[j], 1e-8);
  }
});

test('inverse-CDF sampling reproduces exact rational frequencies with deterministic quantiles', () => {
  const counts = [0, 0, 0];
  for (let i = 0; i < 1000; i++) counts[sample([.1, .3, .6], (i + .5) / 1000)]++;
  assert.deepEqual(counts, [100, 300, 600]);
  assert.equal(sample([.1, .3, .6], 0), 0);
  assert.equal(sample([.1, .3, .6], .1), 1);
  assert.equal(sample([.1, .3, .6], .4), 2);
  assert.equal(sample([0, 1, 0], 0), 1);
  for (let i = 0; i < 1000; i++) assert.equal(sample([0, 1, 0], i / 1000), 1);
});

test('BPE counts pairs by corpus frequency, including word boundary symbols', () => {
  const words = corpus(), scores = pairs(words);
  assert.equal(words.length, 4);
  assert.deepEqual(words.map(w => [w.tokens.join(''), w.count]), [['low▁', 5], ['lower▁', 2], ['newest▁', 6], ['widest▁', 3]]);
  const score = (a, b) => scores.find(item => item.pair[0] === a && item.pair[1] === b)?.count;
  assert.equal(score('l', 'o'), 7);
  assert.equal(score('w', 'e'), 8);
  assert.equal(score('e', 's'), 9);
  assert.equal(score('s', 't'), 9);
  assert.equal(score('t', '▁'), 9);
  assert.equal(sum(scores.map(s => s.count)), 79);
  assert.ok(scores.slice(1).every((item, i) => scores[i].count >= item.count));
});

test('BPE merges preserve text and multiplicity, reduce token count, and never mutate the old corpus', () => {
  const words = corpus(), snapshot = structuredClone(words), merged = mergePair(words, ['e', 's']);
  assert.deepEqual(words, snapshot);
  merged.forEach((w, i) => { assert.equal(w.tokens.join(''), words[i].tokens.join('')); assert.equal(w.count, words[i].count); });
  assert.equal(sum(words.map(w => w.tokens.length * w.count)), 95);
  assert.equal(sum(merged.map(w => w.tokens.length * w.count)), 86);
  assert.ok(merged[2].tokens.includes('es'));
  const overlap = [{ tokens: ['a', 'a', 'a'], count: 4 }];
  assert.equal(pairs(overlap)[0].count, 8, 'frequency counts both adjacent occurrences');
  assert.deepEqual(mergePair(overlap, ['a', 'a']), [{ tokens: ['aa', 'a'], count: 4 }], 'one left-to-right merge cannot reuse a token');
});

test('scaled dot-product attention uses sqrt(dk), known softmax weights, and the V convex combination', () => {
  const result = attention([2, 0, 0, 0]);
  assert.deepEqual(result.scores, [2, 1, 0]);
  [0.6652409557748218, 0.24472847105479764, 0.09003057317038046].forEach((v, i) => near(result.weights[i], v));
  near(result.out[0], 1.420512484720024);
  near(result.out[1], .5794875152799757);
  probability(result.weights);
  near(sum(result.out), 2);
  result.out.forEach(v => assert.ok(v >= 0 && v <= 2, 'attention output stays in the V convex hull'));
  assert.deepEqual(attention([0, 0, 0, 0]).weights, [1 / 3, 1 / 3, 1 / 3]);
  attention([0, 0, 0, 0]).out.forEach(v => near(v, 1));
});

test('attention invariances and the advertised carpet-weight target are reachable', () => {
  const base = attention([2, 0, 0, 0]);
  const ignored = attention([2, 0, 100, -100]);
  assert.deepEqual(ignored, base, 'unused key dimensions cannot affect dot products');
  const shifted = attention([3, 1, 0, 0]);
  shifted.weights.forEach((v, i) => near(v, base.weights[i]));
  const target = attention([-2, 2, 0, 0]);
  assert.ok(target.weights[2] > .6);
  near(target.weights[2], .8668133321973349);
});

test('SGD follows the analytic quadratic trajectory and shows its real stability boundary', () => {
  for (const lr of [.01, .2, .5, .99]) {
    let state = { ...initialOptimizer };
    for (let step = 1; step <= 20; step++) {
      state = optimizerStep(state, lr, 'SGD');
      near(state.w, 3 - 7 * (1 - 2 * lr) ** step, 1e-12);
      assert.equal(state.t, step);
    }
  }
  const mirrored = optimizerStep(initialOptimizer, 1, 'SGD');
  near((mirrored.w - 3) ** 2, 49, 1e-10); // eta=1 oscillates, it does not converge.
  assert.ok((optimizerStep(initialOptimizer, 1.2, 'SGD').w - 3) ** 2 > 49);
});

test('Momentum uses the documented exponential moving average, preserving its optimizer state', () => {
  const old = { ...initialOptimizer }, first = optimizerStep(old, .2, 'Momentum');
  assert.deepEqual(old, initialOptimizer);
  near(first.m, -1.4); near(first.w, -3.72); assert.equal(first.t, 1);
  const second = optimizerStep(first, .2, 'Momentum');
  near(second.m, -2.604); near(second.w, -3.1992); assert.equal(second.t, 2);
  assert.equal(second.v, 0, 'Momentum does not invent an Adam second moment');
});

test('AdamW corrects the first-step moment bias and applies decoupled decay to the original weight', () => {
  const plain = optimizerStep(initialOptimizer, .2, 'AdamW', 0);
  const decayed = optimizerStep(initialOptimizer, .2, 'AdamW', .01);
  near(plain.m, -1.4); near(plain.v, .196);
  near(plain.w, -3.8, 2e-10);
  near(decayed.w, -3.792, 2e-10);
  near(decayed.w - plain.w, .008);
  const atOptimum = optimizerStep({ w: 3, m: 0, v: 0, t: 0 }, .2, 'AdamW', .01);
  near(atOptimum.w, 2.994, 1e-10); // Decay remains active even when the data gradient is zero.
  near(atOptimum.m, 0); near(atOptimum.v, 0);
});

test('all three optimizers can satisfy the workshop target from the stated initialization', () => {
  for (const method of ['SGD', 'Momentum', 'AdamW']) {
    let state = { ...initialOptimizer };
    for (let i = 0; i < 200; i++) {
      state = optimizerStep(state, .2, method);
      assert.ok(Object.values(state).every(Number.isFinite));
    }
    assert.ok((state.w - 3) ** 2 < .05, `${method} did not reach the advertised loss threshold`);
  }
});

test('memory accounting distinguishes replication, ZeRO-2 and ZeRO-3 with binary GiB units', () => {
  const unsharded = memoryEstimate(7, 4, 0, 2048, 2, false);
  const zero2 = memoryEstimate(7, 4, 2, 2048, 2, false);
  const zero3 = memoryEstimate(7, 4, 3, 2048, 2, false);
  near(unsharded.state, 112_000_000_000 / 1_073_741_824);
  near(zero2.state, 38_500_000_000 / 1_073_741_824);
  near(zero3.state, 28_000_000_000 / 1_073_741_824);
  near(unsharded.activation, zero2.activation);
  near(unsharded.activation, zero3.activation);
  near(unsharded.state, memoryEstimate(7, 1, 0, 2048, 2, false).state);
  for (const zero of [0, 2, 3]) near(memoryEstimate(7, 1, zero, 2048, 2, false).state, unsharded.state);
});

test('activation memory obeys the stated estimate, scaling, and checkpoint assumptions', () => {
  // P=384e6 corresponds to d=1000 under the explicitly approximate architecture.
  const base = memoryEstimate(.384, 1, 0, 1024, 1, false);
  near(base.activation, 786_432_000 / 1_073_741_824);
  near(memoryEstimate(.384, 1, 0, 2048, 1, false).activation, 2 * base.activation);
  near(memoryEstimate(.384, 1, 0, 1024, 4, false).activation, 4 * base.activation);
  near(memoryEstimate(1.536, 1, 0, 1024, 1, false).activation, 2 * base.activation);
  const checkpointed = memoryEstimate(.384, 1, 0, 1024, 1, true);
  near(checkpointed.activation, base.activation / 4);
  near(checkpointed.state, base.state);
});

test('all exposed memory configurations remain finite and the 3B/24GiB exercise is feasible', () => {
  let count = 0;
  for (const p of [1, 3, 7, 13]) for (const gpus of [1, 2, 4, 8]) for (const zero of [0, 2, 3])
    for (const seq of [1024, 2048, 4096, 8192]) for (const batch of [1, 2, 4, 8]) for (const checkpoint of [false, true]) {
      const estimate = memoryEstimate(p, gpus, zero, seq, batch, checkpoint);
      assert.ok(Object.values(estimate).every(v => Number.isFinite(v) && v >= 0));
      near(estimate.total, estimate.state + estimate.activation, 1e-10);
      count++;
    }
  assert.equal(count, 1536);
  assert.ok(memoryEstimate(3, 4, 3, 2048, 2, true).total < 24);
});

// Independent transition-frequency oracle derived from the four visible corpus
// sentences: each listed transition occurs once, except sit/carpet and carpet/EOS.
const transitions = [[0, 2, 1], [0, 3, 1], [1, 2, 1], [1, 3, 1], [2, 4, 1], [2, 5, 1], [3, 6, 2], [4, 7, 1], [5, 7, 1], [6, 7, 2]];
const oracleBigramLoss = w => transitions.reduce((total, [context, next, count]) => {
  const row = w[context], normalizer = Math.log(row.reduce((n, logit) => n + Math.exp(logit), 0));
  return total + count * (normalizer - row[next]);
}, 0) / 12;

test('the tiny model uses 64 logits and twelve next-token targets, with uniform baseline log(8)', () => {
  assert.equal(tinyVocab.length, 8);
  assert.deepEqual(tinyTrain, [[0, 2, 4, 7], [1, 2, 5, 7], [0, 3, 6, 7], [1, 3, 6, 7]]);
  const weights = zeroWeights();
  near(tinyLoss(weights), Math.log(8));
  near(tinyLoss(weights), oracleBigramLoss(weights));
  const shifted = weights.map((row, i) => row.map(v => v + i / 2));
  near(tinyLoss(shifted), tinyLoss(weights));
});

test('all 64 actual bigram gradients match finite differences of independent transition likelihoods', () => {
  const weights = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => ((i * 8 + j) % 7 - 3) / 10));
  const original = structuredClone(weights), lr = .7, updated = tinyStep(weights, lr), h = 1e-5;
  assert.deepEqual(weights, original, 'the update must not mutate the previous checkpoint');
  near(tinyLoss(weights), oracleBigramLoss(weights));
  for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
    const plus = structuredClone(weights), minus = structuredClone(weights);
    plus[row][column] += h; minus[row][column] -= h;
    const derivative = (oracleBigramLoss(plus) - oracleBigramLoss(minus)) / (2 * h);
    near(updated[row][column], weights[row][column] - lr * derivative, 1e-8);
  }
  assert.ok(tinyLoss(updated) < tinyLoss(weights));
});

test('one real bigram update agrees with independently counted targets and leaves unseen contexts unchanged', () => {
  const updated = tinyStep(zeroWeights(), 3);
  near(updated[0][2], .1875); near(updated[0][3], .1875); near(updated[0][4], -.0625);
  near(updated[2][4], .1875); near(updated[2][5], .1875);
  near(updated[3][6], .4375); near(updated[3][0], -.0625);
  near(updated[4][7], .21875); near(updated[4][0], -.03125);
  assert.deepEqual(updated[7], Array(8).fill(0), 'EOS has no outgoing target in these four sequences');
  updated.forEach(row => near(sum(row), 0));
});

test('500 actual bigram updates lower loss but cannot break the conditional-entropy capacity floor', () => {
  let weights = zeroWeights(), previous = tinyLoss(weights);
  const lowerBound = Math.log(2) / 2;
  for (let step = 1; step <= 500; step++) {
    weights = tinyStep(weights, 3);
    const loss = tinyLoss(weights);
    assert.ok(loss <= previous + 1e-12, `loss rose at step ${step}`);
    assert.ok(loss > lowerBound, 'finite logits cannot beat the conditional-entropy floor');
    weights.forEach(row => { probability(softmax(row)); near(sum(row), 0, 1e-10); });
    previous = loss;
  }
  assert.ok(previous < lowerBound + .02);
  const like = softmax(weights[2]);
  near(like[4], like[5]);
  assert.ok(like[4] > .48 && like[4] < .5);
  assert.ok(softmax(weights[3])[6] > .99);
  assert.deepEqual(weights[7], Array(8).fill(0));
  // Both user-visible contexts end in "喜欢" (token 2), so the model has exactly
  // the same row, regardless of whether the earlier subject was cat or dog.
  const catContext = [0, 2], dogContext = [1, 2];
  assert.deepEqual(softmax(weights[catContext.at(-1)]), softmax(weights[dogContext.at(-1)]));
});

test('tinyLoss evaluates the supplied corpus rather than silently reusing training examples', () => {
  const weights = zeroWeights(); weights[0][2] = Math.log(7);
  // This row assigns 7/(7+7) = 1/2 to token 2; every other token has 1/14.
  near(tinyLoss(weights, [[0, 2]]), Math.log(2));
  near(tinyLoss(weights, [[0, 3]]), Math.log(14));
  near(tinyLoss(weights, [[0, 2], [0, 3]]), (Math.log(2) + Math.log(14)) / 2);
});

test('stable preference logistic loss has the right derivative and extreme behavior', () => {
  near(softplus(0), Math.log(2)); near(softplus(1000), 1000); near(softplus(-1000), 0);
  for (const beta of [.1, .5, 1]) for (const margin of [-4, 0, 4]) {
    const h = 1e-5, loss = delta => softplus(-beta * delta);
    const derivative = (loss(margin + h) - loss(margin - h)) / (2 * h);
    near(derivative, -beta * (1 - sigmoid(beta * margin)), 1e-10);
    assert.ok(loss(margin - 2 * derivative) < loss(margin));
  }
});

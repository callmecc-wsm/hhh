# v3 full preview verification

Application truth: `lib/academy/v3-preview.json`. Chapters 1–2 are unchanged from `2d37b7b`; chapters 3–12 are fully authored against Phase A. The optional reader copy is `/workspace/hhh-v3/phaseB.md`.

## Content

- 12 playable chapters; 72 unique scenes; section counts: 5, 3, 7, 6, 6, 6, 10, 5, 6, 6, 6, 6.
- All 72 original formulas and takeaway facts retained. The old `05_02` shifted-target formula is explained with `02_05` in chapter 7; chapter 5 focuses on parallel execution and visibility.
- Chapter 3 teaches vectors, matrices and parameters before `02_04` embedding.
- Chapter 7 joins `01_04`, `02_05`, `02_06`, `08_01` with loss and output gradients. The two original sentence endings (上 and 。) both remain.
- GQA/KV explanation lives in `11_02`; chapter 5 does not use it. Batch dimensions live in `02_06`; chapter 6 uses single-sequence shapes. Only display text was adjusted in the existing labs; their computation and completion logic are unchanged.
- Chapter 6 defines sigmoid, SiLU, elementwise multiplication, SwiGLU and RMSNorm before block assembly. Chapter 9 defines parallelism before effective batch size. Chapter 10 defines reference policy before DPO. Chapter 12 explains the 64-parameter bigram limitation before the experiment.
- Phase A leaving questions and chapter 3–12 lab guesses are verbatim. All three quizzes per chapter preserve their assigned original question's judgment fact, use boolean answers, and link to the relevant section.

Quiz source mapping:

| New chapter | Original questions |
| --- | --- |
| 1 | 1-1, 1-2, 12-3 |
| 2 | 2-1, 2-2, 2-3 |
| 3 | 3-1, 3-2, 3-3 |
| 4 | 4-1, 4-2, 4-3 |
| 5 | 5-1, 5-2, 5-3 |
| 6 | 6-1, 6-2, 6-3 |
| 7 | 7-1, 7-2, 1-3 |
| 8 | 8-1, 8-2, 8-3 |
| 9 | 9-1, 9-2, 9-3 |
| 10 | 10-1, 10-2, 10-3 |
| 11 | 11-1, 11-2, 11-3 |
| 12 | 12-1, 12-2, 7-3 |

## Checks

- `python3 scripts/check-v3-content.py /workspace/hhh-v3` passes: order/coverage, schema, figures, chapter-local backlinks, hook continuity, specified terminology migrations, source formulas/takeaways and verbatim questions/guesses.
- `pnpm build` passes under Node 22.14.0, including TypeScript. Base remains `/hhh/v3/`.
- Bundle checks pass for `(2,1)`, `错开一格`, `训练时答案已经在纸上`, `消融`, `小猫喜欢`.
- Headless Chrome at 1440px: all 12 chapters render the expected scene count and existing lab, every figure loads, all 36 quiz answers/links and 12 reflections work.
- All 12 labs completed through their actual controls (BPE merges, matrix transform, Q adjustment, mask toggle, module ordering, logit updates, optimizer, memory configuration, preference optimization, temperature/cache, tiny model training).
- Variable-length reading progress, experiment completion, quiz and reflection combine to 12/12 completed; reload preserves it under `model-academy-v3-preview`.
- 390px spot checks cover chapters 3, 7 and 12, including labs and full-course navigation. No document-level horizontal overflow or runtime/HTTP errors.
- Screenshots: `/workspace/hhh-redesign-shots/v3-full/` (all 12 desktop hooks, chapter 3 teach, chapter 7 lab, mobile checks).

## Deployment contract and remaining rough edges

Use the existing `Deploy combined Pages (live + v3 preview)` workflow, which checks out `pages-combined-deploy`. Preserve its 80 root/live files byte-for-byte; replace only `site/v3` with this branch's dist. The original live index SHA-256 is `d4f11584c7410758b65ec749465938de09789736a20f7640db5a667c15275f53`. No application source is merged or pushed to master.

The lecture markdown and `mini_transformer.py` keep the original order and content (explicitly out of scope). Figures remain the original files, including their original chapter numbering on migrated scenes. DataLab retains its English miniature corpus. The single JS chunk is about 661 kB (227 kB gzip), so Vite reports its existing >500 kB advisory; splitting is deferred.

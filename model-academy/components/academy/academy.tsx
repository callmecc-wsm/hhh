'use client';

import {useState, useEffect, useRef, useCallback, Component, type ReactNode} from 'react';
import {
  Check, CheckCircle2, ChevronRight, Clock3, Map, Lightbulb, Code2, ExternalLink,
  RotateCcw, GraduationCap, Layers3, NotebookPen, Info, FlaskConical, BookOpen, MessageSquareText,
} from 'lucide-react';
import {SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarTrigger, useSidebar} from '@/components/ui/sidebar';
import {Progress} from '@/components/ui/progress';
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription} from '@/components/ui/dialog';
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group';
import {Checkbox} from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {chapters, missions, phases} from '@/lib/academy/curriculum';
import {getNarrative, THROUGH_LINE, chapterStation} from '@/lib/academy/narrative';
import {PredictionLab, DataLab, LinearLab, AttentionLab, CausalLab, ArchitectureLab} from './labs-foundation';
import {LossLab, OptimizerLab, SystemsLab, AlignmentLab} from './labs-training';
import {InferenceLab, EvaluationLab} from './labs-product';
import {Formula, Finding} from './shared';

type ChapterProgress = {
  read: number[];
  lab: boolean;
  evidence: string;
  answers: (number | null)[];
  submitted: boolean;
  draft: string;
  reflectionChecked: boolean[];
  reflected: boolean;
};
type Save = {version: 1; current: number; chapters: ChapterProgress[]};

const KEY = 'model-academy-v1';
const fresh = (): Save => ({
  version: 1,
  current: 0,
  chapters: missions.map(() => ({
    read: [],
    lab: false,
    evidence: '',
    answers: [null, null, null],
    submitted: false,
    draft: '',
    reflectionChecked: [false, false, false],
    reflected: false,
  })),
});

function verified(p: ChapterProgress, i: number) {
  return p.submitted && missions[i].quiz.every((q, j) => p.answers[j] === q.answer);
}
function completion(p: ChapterProgress, i: number) {
  return p.read.length === 6 && p.lab && verified(p, i) && p.reflected;
}

const STEP_IDS = ['hook', 'lab', 'takeaways', 'check'] as const;

const labs = [
  PredictionLab, DataLab, LinearLab, AttentionLab, CausalLab, ArchitectureLab,
  LossLab, OptimizerLab, SystemsLab, AlignmentLab, InferenceLab, EvaluationLab,
];

function validSave(x: unknown): x is Save {
  if (!x || typeof x !== 'object') return false;
  const s = x as Save;
  return (
    s.version === 1 &&
    Number.isInteger(s.current) &&
    s.current >= 0 &&
    s.current < 12 &&
    Array.isArray(s.chapters) &&
    s.chapters.length === 12 &&
    s.chapters.every(
      (p) =>
        Array.isArray(p.read) &&
        p.read.length <= 6 &&
        p.read.every((n) => Number.isInteger(n) && n >= 0 && n < 6) &&
        typeof p.lab === 'boolean' &&
        typeof p.evidence === 'string' &&
        Array.isArray(p.answers) &&
        p.answers.length === 3 &&
        p.answers.every((a) => a === null || (Number.isInteger(a) && a >= 0 && a < 3)) &&
        typeof p.submitted === 'boolean' &&
        typeof p.draft === 'string' &&
        Array.isArray(p.reflectionChecked) &&
        p.reflectionChecked.length === 3 &&
        p.reflectionChecked.every((b) => typeof b === 'boolean') &&
        typeof p.reflected === 'boolean',
    )
  );
}

class LabBoundary extends Component<{children: ReactNode}, {error: boolean}> {
  state = {error: false};
  static getDerivedStateFromError() {
    return {error: true};
  }
  render() {
    return this.state.error ? (
      <div className="empty-state">
        <h3>实验暂时无法显示</h3>
        <p>学习记录仍保存在当前浏览器。切换到其他章节后再回来重试。</p>
      </div>
    ) : (
      this.props.children
    );
  }
}

function Nav({current, save, onNavigate}: {current: number; save: Save; onNavigate: (i: number) => void}) {
  const {setOpenMobile} = useSidebar();
  return (
    <Sidebar className="academy-sidebar">
      <SidebarHeader>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onNavigate(0);
            setOpenMobile(false);
          }}
        >
          <span className="brand-mark">
            <Layers3 size={22} />
          </span>
          <span>
            <b>模型工坊</b>
            <small>从下一词到助手</small>
          </span>
        </a>
      </SidebarHeader>
      <SidebarContent className="course-nav">
        <div className="through-caption">主线 · {THROUGH_LINE[chapterStation[current]]}</div>
        <div className="through-line" aria-label="课程主线进度">
          {THROUGH_LINE.map((s, i) => (
            <span
              key={s}
              title={s}
              className={chapterStation[current] === i ? 'on' : i < chapterStation[current] ? 'done' : ''}
            />
          ))}
        </div>
        <div className="nav-caption">
          学习路径 <span>12 章</span>
        </div>
        {phases.map((phase, k) => (
          <div className="nav-phase" key={phase.name}>
            <div className="phase-label">
              <span>{String(k + 1).padStart(2, '0')}</span>
              {phase.name}
            </div>
            {missions.slice(phase.from, phase.to + 1).map((m, j) => {
              const i = phase.from + j;
              const done = completion(save.chapters[i], i);
              return (
                <button
                  key={m.name}
                  className={'chapter-nav ' + (current === i ? 'active' : '') + (done ? ' completed' : '')}
                  aria-current={current === i ? 'step' : undefined}
                  onClick={() => {
                    onNavigate(i);
                    setOpenMobile(false);
                  }}
                >
                  <span className="chapter-num">{done ? <Check size={14} /> : String(i + 1).padStart(2, '0')}</span>
                  <span>{m.name}</span>
                  {current === i && <span className="current-mark" />}
                </button>
              );
            })}
          </div>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="sidebar-bottom">
          <NotebookPen size={18} />
          <div>
            <b>顺着主线建立理解</b>
            <small>不必自己从细节里找重点</small>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function Academy() {
  const [save, setSave] = useState<Save>(fresh);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [notice, setNotice] = useState('');
  const [activeStep, setActiveStep] = useState<(typeof STEP_IDS)[number]>('hook');
  const live = useRef(save);
  live.current = save;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (validSave(parsed)) setSave(parsed);
        else setStorageError('已有记录格式无法识别，本次先从空白进度开始。');
      }
    } catch {
      setStorageError('当前浏览器无法读取学习记录。你仍可完成全部实验。');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch {
      setStorageError('当前浏览器无法保存记录，关闭页面后本次进度可能丢失。');
    }
  }, [save, ready]);

  const current = save.current;
  const p = save.chapters[current];
  const m = missions[current];
  const ch = chapters[current];
  const Lab = labs[current];
  const narrative = getNarrative(current, m.summary, m.task, m.deepTitle);

  const patch = useCallback((data: Partial<ChapterProgress>) => {
    setSave((s) => ({...s, chapters: s.chapters.map((cp, i) => (i === s.current ? {...cp, ...data} : cp))}));
  }, []);

  const navigate = useCallback((i: number) => {
    setSave((s) => ({...s, current: i}));
    setHint(false);
    setNotice('');
    setActiveStep('hook');
    window.scrollTo({top: 0, behavior: 'instant'});
  }, []);

  useEffect(() => {
    const ctx = (document as unknown as {modelContext?: {registerTool: (t: unknown, o: unknown) => Promise<void> | void}}).modelContext;
    if (!ctx?.registerTool) return;
    const ctl = new AbortController();
    const tools = [
      {
        name: 'read_learning_progress',
        description: 'Read the 12 chapters, experiment evidence, and self-assessed learning progress. Does not change progress.',
        inputSchema: {type: 'object', properties: {}, additionalProperties: false},
        annotations: {readOnlyHint: true, untrustedContentHint: true},
        execute: () => ({
          currentChapter: live.current.current + 1,
          chapters: missions.map((mm, i) => ({
            number: i + 1,
            title: mm.name,
            read: live.current.chapters[i].read.length,
            experiment: live.current.chapters[i].lab,
            quiz: verified(live.current.chapters[i], i),
            selfReflection: live.current.chapters[i].reflected,
            complete: completion(live.current.chapters[i], i),
          })),
        }),
      },
      {
        name: 'open_learning_chapter',
        description: 'Navigate to a chapter. Does not mark it complete or modify answers.',
        inputSchema: {type: 'object', properties: {chapter: {type: 'integer', minimum: 1, maximum: 12}}, required: ['chapter'], additionalProperties: false},
        annotations: {readOnlyHint: false, untrustedContentHint: false},
        execute: async (input: unknown) => {
          const n = (input as {chapter?: unknown})?.chapter;
          if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 12) throw new Error('chapter 必须是 1 到 12 的整数');
          navigate(n - 1);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          return {chapter: n, title: missions[n - 1].name};
        },
      },
    ];
    tools.forEach((t) => {
      try {
        Promise.resolve(ctx.registerTool(t, {signal: ctl.signal})).catch(() => {});
      } catch {}
    });
    return () => ctl.abort();
  }, [navigate]);

  useEffect(() => {
    const nodes = STEP_IDS.map((id) => document.getElementById(`step-${id}`)).filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id?.startsWith('step-')) {
          const id = visible[0].target.id.replace('step-', '') as (typeof STEP_IDS)[number];
          if ((STEP_IDS as readonly string[]).includes(id)) setActiveStep(id);
        }
      },
      {rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.25, 0.5, 0.75]},
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [current]);

  function finishLab(evidence: string) {
    patch({lab: true, evidence});
    setNotice('实验已记录。往下看原理，把刚看见的机制收成结论。');
  }

  function markScene(j: number) {
    if (p.read.includes(j)) return;
    patch({read: [...new Set([...p.read, j])]});
  }

  function markAllScenes() {
    patch({read: [0, 1, 2, 3, 4, 5]});
  }

  const score = p.submitted ? m.quiz.filter((q, j) => p.answers[j] === q.answer).length : 0;
  const readCount = save.chapters.reduce((n, cp) => n + cp.read.length, 0);
  const labCount = save.chapters.filter((cp) => cp.lab).length;
  const completed = save.chapters.filter((cp, i) => completion(cp, i)).length;
  const station = chapterStation[current];

  const stepDone = {
    hook: true,
    lab: p.lab,
    takeaways: p.read.length === 6,
    check: verified(p, current) && p.reflected,
  };

  if (!ready) {
    return (
      <div className="boot">
        <Layers3 size={28} />
        <p>正在打开模型工坊…</p>
      </div>
    );
  }

  return (
    <SidebarProvider style={{'--sidebar-width': '248px'} as React.CSSProperties}>
      <Nav current={current} save={save} onNavigate={navigate} />
      <div className="learning-shell">
        <header className="topbar">
          <div className="topbar-left">
            <SidebarTrigger />
            <div className="topbar-path">
              <span>模型工坊</span>
              <ChevronRight size={14} />
              <span>{phases.find((ph) => current >= ph.from && current <= ph.to)?.name}</span>
              <ChevronRight size={14} />
              <span>第 {current + 1} 章</span>
            </div>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={() => setMapOpen(true)}>
              <Map size={15} />
              全景
            </button>
            <button type="button" onClick={() => setAboutOpen(true)}>
              <Info size={15} />
              说明
            </button>
          </div>
        </header>

        <main className="workspace story-workspace">
          {storageError && <div className="storage-banner">{storageError}</div>}

          <div className="chapter-heading story-heading">
            <div>
              <div className="station-row">
                <span className="station-pill">主线 · {THROUGH_LINE[station]}</span>
                <span className="station-meta">
                  {current + 1} / 12 · 约 {m.minutes} 分钟
                </span>
              </div>
              <h1>{ch.title}</h1>
              <p className="chapter-lead">{m.summary}</p>
              {narrative.fromPrevious && <p className="bridge-prev">{narrative.fromPrevious}</p>}
            </div>
          </div>

          <nav className="story-steps" aria-label="本章学习步骤">
            {[
              {id: 'hook', label: '问题与直觉', icon: Lightbulb},
              {id: 'lab', label: '亲手看一次', icon: FlaskConical},
              {id: 'takeaways', label: '带走的结论', icon: BookOpen},
              {id: 'check', label: '判断与复述', icon: MessageSquareText},
            ].map((s) => {
              const Icon = s.icon;
              const done = stepDone[s.id as keyof typeof stepDone];
              return (
                <a
                  key={s.id}
                  href={`#step-${s.id}`}
                  className={(done ? 'done ' : '') + (activeStep === s.id ? 'current' : '')}
                  onClick={() => setActiveStep(s.id as (typeof STEP_IDS)[number])}
                >
                  <Icon size={14} />
                  <span>{s.label}</span>
                  {done && <Check size={12} />}
                </a>
              );
            })}
          </nav>

          {/* 1. Hook + intuition */}
          <section className="story-section" id="step-hook">
            <header className="section-kicker">
              <span>01</span>
              <h2>{narrative.hookTitle}</h2>
            </header>
            <p className="hook-body">{narrative.hook}</p>
            <div className="intuition-card">
              <h3>{narrative.intuitionTitle}</h3>
              {narrative.intuition.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>

          {/* 2. Lab */}
          <section className="story-section" id="step-lab">
            <header className="section-kicker">
              <span>02</span>
              <h2>亲手看一次</h2>
            </header>
            <div className="lab-frame">
              <div className="watch-for">
                <div className="watch-title">
                  <Lightbulb size={16} />
                  动手前，先留意这些
                </div>
                <ul>
                  {narrative.labWatch.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p className="watch-task">
                  <strong>本章目标：</strong>
                  {m.task}
                </p>
                <button type="button" className="hint-inline" onClick={() => setHint((h) => !h)}>
                  {hint ? '收起提示' : '需要一点提示'}
                </button>
                {hint && <p className="hint-body">{m.hint}</p>}
              </div>
              <div className="experiment-panel story-lab">
                <LabBoundary>
                  <Lab onComplete={finishLab} done={p.lab} />
                </LabBoundary>
              </div>
              {p.lab && (
                <Finding success>
                  {narrative.labBridge}
                  {p.evidence ? `（记录：${p.evidence}）` : ''}
                </Finding>
              )}
            </div>
          </section>

          {/* 3. Principles as causal story */}
          <section className="story-section" id="step-takeaways">
            <header className="section-kicker">
              <span>03</span>
              <h2>{narrative.takeawaysTitle}</h2>
            </header>
            <p className="section-lead">下面六节保留原课程全部原理。按因果顺序往下读；每节结束都有一句可带走的结论。</p>
            <div className="scene-story">
              {ch.scenes.map((scene, j) => (
                <article
                  key={scene.id}
                  className={'scene-block' + (p.read.includes(j) ? ' read' : '')}
                  onFocus={() => markScene(j)}
                  onMouseEnter={() => markScene(j)}
                >
                  {j > 0 && narrative.sceneTransitions[j - 1] && (
                    <p className="scene-transition">{narrative.sceneTransitions[j - 1]}</p>
                  )}
                  <div className="scene-head">
                    <span className="scene-index">{String(j + 1).padStart(2, '0')}</span>
                    <h3>{scene.title}</h3>
                  </div>
                  <figure className="lesson-figure">
                    <img
                      src={`${import.meta.env.BASE_URL}course/figures/${scene.id}.webp`}
                      alt={`${scene.title}：${scene.takeaway}`}
                      width={1280}
                      height={720}
                      loading={j < 2 ? 'eager' : 'lazy'}
                    />
                    <figcaption>
                      {scene.formula} · {scene.takeaway}
                    </figcaption>
                  </figure>
                  <div className="lesson-prose">
                    <p>{scene.narration}</p>
                  </div>
                  <div className="takeaway-chip">
                    <strong>带走：</strong>
                    {scene.takeaway}
                  </div>
                  {scene.sources?.length > 0 && (
                    <div className="references">
                      {scene.sources.map((url: string) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          <ExternalLink size={12} />
                          参考
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>

            <div className="deep-section">
              <span className="small-label">再深入一步</span>
              <h3>{m.deepTitle}</h3>
              {m.deep.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              <Formula>{m.formula}</Formula>
            </div>

            {p.read.length < 6 && (
              <button type="button" className="btn" onClick={markAllScenes}>
                我已读完六节原理
              </button>
            )}
            {p.read.length === 6 && <Finding success>六节原理已记入本章进度。</Finding>}
          </section>

          {/* 4. Quiz + Feynman */}
          <section className="story-section" id="step-check">
            <header className="section-kicker">
              <span>04</span>
              <h2>判断与复述</h2>
            </header>
            <p className="section-lead">用三道判断题核对关键分叉；再用费曼复述确认自己能讲清因果。</p>

            <div className="assessment-panel story-assess">
              <div className="quiz-block">
                {m.quiz.map((q, j) => (
                  <fieldset key={q.q} className="quiz-question" disabled={p.submitted}>
                    <legend>
                      <span>{j + 1}</span>
                      {q.q}
                    </legend>
                    <RadioGroup
                      value={p.answers[j] === null ? undefined : String(p.answers[j])}
                      onValueChange={(v) => {
                        const next = [...p.answers] as (number | null)[];
                        next[j] = Number(v);
                        patch({answers: next, submitted: false});
                      }}
                    >
                      {q.options.map((opt, k) => (
                        <label key={opt} className={'quiz-option' + (p.submitted ? (k === q.answer ? ' correct' : p.answers[j] === k ? ' wrong' : '') : '')}>
                          <RadioGroupItem value={String(k)} />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    {p.submitted && (
                      <p className="quiz-why">
                        {p.answers[j] === q.answer ? '正确。' : '再看一眼：'}
                        {q.why}
                      </p>
                    )}
                  </fieldset>
                ))}
                {!p.submitted ? (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={p.answers.some((a) => a === null)}
                    onClick={() => {
                      patch({submitted: true});
                                          }}
                  >
                    提交判断
                  </button>
                ) : (
                  <Finding success={score === 3}>
                    {score === 3
                      ? '3 道判断均正确。接下来试着不用术语堆砌，把原理讲清楚。'
                      : `本轮 ${score}/3 正确。看完解释后，可以回到实验验证，或修改答案后重交。`}
                  </Finding>
                )}
                {p.submitted && score < 3 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      patch({submitted: false});
                                      }}
                  >
                    修改后再交
                  </button>
                )}
              </div>

              <div className="feynman-block">
                <div className="feynman-heading">
                  <GraduationCap size={18} />
                  <div>
                    <h3>费曼复述</h3>
                    <p>{m.teach}</p>
                  </div>
                </div>
                <textarea
                  value={p.draft}
                  onChange={(e) => patch({draft: e.target.value, reflected: false})}
                  placeholder="用自己的话写下来。写完后对照量规自检。"
                  rows={6}
                />
                <div className="rubric">
                  <div className="reflection-meta">自评量规（全部勾选后记为完成）</div>
                  {m.rubric.map((r, j) => (
                    <label key={r}>
                      <Checkbox
                        checked={p.reflectionChecked[j]}
                        onCheckedChange={(c) => {
                          const next = [...p.reflectionChecked];
                          next[j] = !!c;
                          patch({reflectionChecked: next, reflected: false});
                        }}
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
                <details className="example-fold">
                  <summary>参考表述（先自己写再看）</summary>
                  <p>{m.example}</p>
                </details>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!p.draft.trim() || !p.reflectionChecked.every(Boolean)}
                  onClick={() => {
                    patch({reflected: true});
                    setNotice('本章复述已记录。');
                  }}
                >
                  {p.reflected ? '已记录复述' : '记入本章完成'}
                </button>
                {p.reflected && <Finding success>复述已保存。这是自评，不是自动判定已经掌握。</Finding>}
              </div>
            </div>

            {narrative.toNext && (
              <div className="next-station">
                <div>
                  <span className="small-label">下一站</span>
                  <p>{narrative.toNext}</p>
                </div>
                {current < 11 && (
                  <button type="button" className="btn primary" onClick={() => navigate(current + 1)}>
                    进入第 {current + 2} 章
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            )}
          </section>

          {notice && (
            <div className="status-message" role="status">
              <CheckCircle2 size={16} />
              {notice}
            </div>
          )}

          <footer className="page-footer">
            <span>
              <Clock3 size={13} />
              进度保存在本浏览器
            </span>
            <span>
              {readCount}/72 节原理 · {labCount}/12 实验 · {completed}/12 章完成
            </span>
            <a href={`${import.meta.env.BASE_URL}course/课程讲义与资料.md`} download>
              <NotebookPen size={13} />
              讲义
            </a>
            <a href={`${import.meta.env.BASE_URL}course/mini_transformer.py`} download>
              <Code2 size={13} />
              mini_transformer.py
            </a>
          </footer>
        </main>
      </div>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="map-dialog">
          <DialogHeader>
            <DialogTitle>课程全景</DialogTitle>
            <DialogDescription>12 章 · 72 节原理 · 12 个主实验 · 36 道判断题 · 12 次复述。顺着主线建立理解。</DialogDescription>
          </DialogHeader>
          <div className="map-summary">
            <StatBox value={`${readCount}/72`} label="已读原理" />
            <StatBox value={`${labCount}/12`} label="已验证实验" />
            <StatBox value={`${completed}/12`} label="完整学习章节" />
          </div>
          <div className="map-grid">
            {missions.map((mm, i) => {
              const done = completion(save.chapters[i], i);
              return (
                <button
                  key={mm.name}
                  type="button"
                  className={current === i ? 'active' : ''}
                  onClick={() => {
                    navigate(i);
                    setMapOpen(false);
                  }}
                >
                  <span>{done ? <Check size={14} /> : String(i + 1).padStart(2, '0')}</span>
                  <b>{mm.name}</b>
                  <small>{THROUGH_LINE[chapterStation[i]]}</small>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="about-dialog">
          <DialogHeader>
            <DialogTitle>关于模型工坊</DialogTitle>
            <DialogDescription>按理解优先原则重组学习路径：问题 → 直觉 → 实验 → 结论 → 判断与复述。</DialogDescription>
          </DialogHeader>
          <div className="about-copy">
            <p>原理、实验、判断题与费曼复述的内容深度与广度保持不变。界面去掉互抢注意力的仪表盘外壳，让你顺着一条主线建立理解。</p>
            <p>计算实验按公式实时求值；人工情景会在页面注明。进度仅保存在当前浏览器。</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" className="reset-progress">
                  <RotateCcw size={15} />
                  清空本浏览器的学习记录
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>清空全部学习记录？</AlertDialogTitle>
                  <AlertDialogDescription>将删除本浏览器中 12 章的阅读进度、实验记录、答题与复述。此操作无法撤销。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>保留记录</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setSave(fresh());
                                        setAboutOpen(false);
                      setHint(false);
                      setNotice('学习记录已清空。');
                    }}
                  >
                    确认清空
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function StatBox({value, label}: {value: string; label: string}) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

'use client';

import {useState, useEffect, useRef, useCallback, Component, type ReactNode} from 'react';
import {
  Check, CheckCircle2, ChevronRight, Clock3, Map, Lightbulb, Code2,
  RotateCcw, GraduationCap, Layers3, NotebookPen, Info, FlaskConical, BookOpen, MessageSquareText,
} from 'lucide-react';
import {SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarTrigger, useSidebar} from '@/components/ui/sidebar';
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription} from '@/components/ui/dialog';
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group';
import {Checkbox} from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {missions, phases} from '@/lib/academy/curriculum';
import {THROUGH_LINE, chapterStation} from '@/lib/academy/narrative';
import {PredictionLab, DataLab, LinearLab, AttentionLab, CausalLab, ArchitectureLab} from './labs-foundation';
import {LossLab, OptimizerLab, SystemsLab, AlignmentLab} from './labs-training';
import {InferenceLab, EvaluationLab} from './labs-product';
import preview from '@/lib/academy/v3-preview.json';
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
type Save = {version: 3; current: number; chapters: ChapterProgress[]};

const KEY = 'model-academy-v3-preview';
const fresh = (): Save => ({
  version: 3,
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

const chapterList = preview.playable;
const totalSections = chapterList.reduce((sum, chapter) => sum + chapter.sections.length, 0);
const sectionCount = (i: number) => preview.playable[i]?.sections.length ?? 0;
const quizzes = (i: number) => (preview.playable[i]?.quizzes ?? []).map(q => ({...q, options: ['对', '错'], answer: q.answer ? 0 : 1}));
const rubrics = [
  ['说明概率依赖已有上下文', '说明新 token 接回输入后再次计算', '说明通顺不等于事实正确'],
  ['说明材料的清理与隔离', '说明中间粒度的需要及合并后重算', '区分 token、ID、词表大小与上下文长度'],
  ['串起 ID、嵌入向量与矩阵加工', '区分加权和、点积以及行列约定', '说明非线性不能省略的原因'],
  ['说明 Q/K 匹配与逐行归一化', '说明权重最终混合 V', '区分输入产生的中间值与训练更新的参数'],
  ['区分已知位置并行与生成逐步继续', '说明遮罩控制可见性', '说明位置编码、多头与存储优化各自的作用'],
  ['串起查表、注意力与逐位置前馈加工', '说明残差、归一化及重复堆叠', '说明词表投影和 softmax 输出'],
  ['串起清理、切分、编号、查表示与错位标签', '说明批次有效位置计分与填充排除', '说明局部梯度方向并区分训练与生成'],
  ['说明沿计算图追溯并累加影响', '区分反向求梯度与优化器更新', '说明 AdamW 两本账与学习率的作用'],
  ['区分模型状态与激活占用', '说明分片、累积与重计算的取舍', '说明检查点状态和预算估算边界'],
  ['区分示范、偏好与可验证奖励', '说明 DPO 参考项与配对概率', '说明奖励提高仍需独立评测'],
  ['区分预填充与逐词解码的开销', '区分采样、缓存与检索上下文', '区分适配权重与压缩数值表示'],
  ['串起从数据到概率、反馈与更新的因果链', '说明后训练与部署如何接回主线', '用结构限制与受控实验解释独立验收'],
];
function verified(p: ChapterProgress, i: number) {
  return i < preview.playable.length && p.submitted && quizzes(i).every((q, j) => p.answers[j] === q.answer);
}
function completion(p: ChapterProgress, i: number) {
  return i < preview.playable.length && p.read.length === sectionCount(i) && p.lab && verified(p, i) && p.reflected;
}
const STEP_IDS = ['hook', 'teach', 'lab', 'check'] as const;
// Lab order follows the original chapter numbers; scene migrations do not move experiments.
const labs = [PredictionLab, DataLab, LinearLab, AttentionLab, CausalLab, ArchitectureLab, LossLab, OptimizerLab, SystemsLab, AlignmentLab, InferenceLab, EvaluationLab];

// Only the inline formatting and local links used in the authoritative prose.
function Inline({text}: {text: string}) {
  return <>{text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(#[^)]+\))/g).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((#[^)]+)\)$/);
    return link ? <a key={i} href={link[2]}>{link[1]}</a> : part;
  })}</>;
}
function Paras({items}: {items: string[]}) {
  return <>{items.map((text, i) => <p key={i}><Inline text={text} /></p>)}</>;
}
type Block = {type: string; text?: string; id?: string; rows?: string[][]; items?: string[]};
function ReaderBlock({block, title}: {block: Block; title: string}) {
  switch (block.type) {
    case 'p': return <p><Inline text={block.text ?? ''} /></p>;
    case 'formula': return <Formula>{block.text}</Formula>;
    case 'olist': return <ol>{block.items?.map((text, i) => <li key={i}><Inline text={text} /></li>)}</ol>;
    case 'table': return <div className="reader-table-wrap"><table><thead><tr>{block.rows?.[0].map((text, i) => <th key={i} scope="col"><Inline text={text} /></th>)}</tr></thead><tbody>{block.rows?.slice(1).map((row, i) => <tr key={i}>{row.map((text, j) => <td key={j}><Inline text={text} /></td>)}</tr>)}</tbody></table></div>;
    case 'figure': return <figure className="lesson-figure"><img src={`${import.meta.env.BASE_URL}course/figures/${block.id}.webp`} alt={title} width={1280} height={720} loading="lazy" /></figure>;
    default: return null;
  }
}

function validSave(x: unknown): x is Save {
  if (!x || typeof x !== 'object') return false;
  const s = x as Save;
  return (
    s.version === 3 &&
    Number.isInteger(s.current) &&
    s.current >= 0 &&
    s.current < 12 &&
    Array.isArray(s.chapters) &&
    s.chapters.length === 12 &&
    s.chapters.every(
      (p, i) =>
        !!p && Array.isArray(p.read) &&
        p.read.length <= sectionCount(i) && new Set(p.read).size === p.read.length &&
        p.read.every((n) => Number.isInteger(n) && n >= 0 && n < sectionCount(i)) &&
        typeof p.lab === 'boolean' &&
        typeof p.evidence === 'string' &&
        Array.isArray(p.answers) &&
        p.answers.length === 3 &&
        p.answers.every((a) => a === null || (Number.isInteger(a) && a >= 0 && a < 2)) &&
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
                  key={chapterList[i].title}
                  className={'chapter-nav ' + (current === i ? 'active' : '') + (done ? ' completed' : '')}
                  aria-current={current === i ? 'step' : undefined}
                  onClick={() => {
                    onNavigate(i);
                    setOpenMobile(false);
                  }}
                >
                  <span className="chapter-num">{done ? <Check size={14} /> : String(i + 1).padStart(2, '0')}</span>
                  <span>{chapterList[i].title}</span>
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
  const ch = preview.playable[current];
  const quiz = quizzes(current);
  const Lab = labs[current];

  const patch = useCallback((data: Partial<ChapterProgress>) => {
    setSave((s) => ({...s, chapters: s.chapters.map((cp, i) => (i === s.current ? {...cp, ...data} : cp))}));
  }, []);

  const navigate = useCallback((i: number) => {
    setSave((s) => ({...s, current: i}));
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
            title: chapterList[i].title,
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
          return {chapter: n, title: chapterList[n - 1].title};
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
  }, [current, ready]);

  function finishLab(evidence: string) {
    patch({lab: true, evidence});
    setNotice('实验已记录。对照下方回指，再完成小结与自测。');
  }

  function markScene(j: number) {
    if (p.read.includes(j)) return;
    patch({read: [...new Set([...p.read, j])]});
  }

  function markAllScenes() {
    patch({read: Array.from({length: ch.sections.length}, (_, i) => i)});
  }

  const score = p.submitted ? quiz.filter((q, j) => p.answers[j] === q.answer).length : 0;
  const readCount = save.chapters.reduce((n, cp) => n + cp.read.length, 0);
  const labCount = save.chapters.filter((cp) => cp.lab).length;
  const completed = save.chapters.filter((cp, i) => completion(cp, i)).length;
  const station = chapterStation[current];

  const stepDone = {
    hook: true,
    lab: p.lab,
    teach: !!ch && p.read.length === ch.sections.length,
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
                  {current + 1} / 12 · {`约 ${Math.max(Number(m.minutes.split('–')[1] ?? m.minutes), Math.ceil(JSON.stringify(ch).length / 450))} 分钟`}
                </span>
              </div>
              <h1>{chapterList[current].title}</h1>

            </div>
          </div>

          <>
          <nav className="story-steps" aria-label="本章学习步骤">
            {[
              {id: 'hook', label: '问题', icon: Lightbulb},
              {id: 'teach', label: '讲解', icon: BookOpen},
              {id: 'lab', label: '验证', icon: FlaskConical},
              {id: 'check', label: '小结与自测', icon: MessageSquareText},
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

          <section className="story-section lesson-prose" id="step-hook">
            <header className="section-kicker"><span>01</span><h2>要解决的问题</h2></header>
            <Paras items={ch.hookParas} />
          </section>
          <section className="story-section" id="step-teach">
            <header className="section-kicker"><span>02</span><h2>讲解</h2></header>
            <div className="scene-story">
              {ch.sections.map((section, j) => <article key={section.id} id={section.anchor} tabIndex={0}
                className={'scene-block lesson-prose' + (p.read.includes(j) ? ' read' : '')}
                onFocus={() => markScene(j)} onMouseEnter={() => markScene(j)}>
                <div className="scene-head"><span className="scene-index">{String(j + 1).padStart(2, '0')}</span><h3>{section.title}</h3></div>
                {section.blocks.map((block, k) => <ReaderBlock key={k} block={block} title={section.title} />)}
                <div className="takeaway-chip"><strong>带走：</strong><Inline text={section.takeaway} /></div>
              </article>)}
            </div>
            {p.read.length < ch.sections.length
              ? <button type="button" className="btn" onClick={markAllScenes}>我已读完本章 {ch.sections.length} 节讲解</button>
              : <Finding success>本章 {ch.sections.length} 节讲解已记入进度。</Finding>}
          </section>
          <section className="story-section" id="step-lab">
            <header className="section-kicker"><span>03</span><h2>{ch.lab.title}</h2></header>
            <div className="lab-frame">
              <div className="watch-for lesson-prose"><strong>先猜</strong><p><Inline text={ch.lab.guess} /></p></div>
              <div className="experiment-panel story-lab"><LabBoundary key={current}><Lab onComplete={finishLab} done={p.lab} /></LabBoundary></div>
              <div className="lesson-prose"><Paras items={ch.lab.body} /></div>
              {p.lab && <Finding success>实验已记录。{p.evidence}</Finding>}
            </div>
          </section>

          {/* 4. Quiz + Feynman */}
          <section className="story-section" id="step-check">
            <header className="section-kicker">
              <span>04</span>
              <h2>小结与自测</h2>
            </header>
            <div className="lesson-prose"><h3>本章小结</h3><p><Inline text={ch.summary} /></p></div>

            <div className="assessment-panel story-assess">
              <div className="quiz-block">
                {quiz.map((q, j) => (
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
                        <Inline text={q.why} />
                        {ch.sections.filter(section => !q.why.includes("](#") && q.why.includes(section.title)).map(section => <a key={section.id} className="quiz-backlink" href={`#${section.anchor}`}>回看：{section.title}</a>)}
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
                    <Paras items={ch.feynman.filter(text => !text.startsWith('可对照'))} />
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
                  {rubrics[current].map((r, j) => (
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
                  <Paras items={ch.feynman.filter(text => text.startsWith('可对照'))} />
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

            {ch.leaving && (
              <div className="next-station">
                <div>
                  <span className="small-label">留下的问题</span>
                  <p>{ch.leaving}</p>
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

          </>

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
              {readCount}/{totalSections} 节讲解 · {labCount}/{labs.length} 实验 · {completed}/{chapterList.length} 章完成
            </span>
            <a href={`${import.meta.env.BASE_URL}course/课程讲义与资料.md`} download>
              <NotebookPen size={13} />
              正式版讲义
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
            <DialogDescription>预览已开放全部 12 章，共 72 节讲解、12 个实验、36 道判断题。正式版未替换。</DialogDescription>
          </DialogHeader>
          <div className="map-summary">
            <StatBox value={`${readCount}/${totalSections}`} label="已读原理" />
            <StatBox value={`${labCount}/${labs.length}`} label="已验证实验" />
            <StatBox value={`${completed}/${chapterList.length}`} label="完整学习章节" />
          </div>
          <div className="map-grid">
            {missions.map((mm, i) => {
              const done = completion(save.chapters[i], i);
              return (
                <button
                  key={chapterList[i].title}
                  type="button"
                  className={current === i ? 'active' : ''}
                  onClick={() => {
                    navigate(i);
                    setMapOpen(false);
                  }}
                >
                  <span>{done ? <Check size={14} /> : String(i + 1).padStart(2, '0')}</span>
                  <b>{chapterList[i].title}</b>
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
            <DialogDescription>按理解优先原则重组学习路径：问题 → 讲解 → 验证 → 小结与自测。</DialogDescription>
          </DialogHeader>
          <div className="about-copy">
            <p>本次预览已铺满 12 章，按理解顺序串起 72 节原理。正式版未替换；下载讲义与代码仍保留正式版内容和顺序。</p>
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

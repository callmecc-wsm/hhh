import {useEffect, useId, useState} from 'react';
import {ArrowRight, CheckCircle2, Download, FlaskConical, Lightbulb, Play, RotateCcw, ShieldCheck, Square, StepForward} from 'lucide-react';
import {cancelHarness, configForChapter, decideApproval, evaluateSuite, modules, runUntilPause, scenarioPass, scenarios, startHarness, stepHarness, suiteResult, toolContracts, type HarnessConfig, type HarnessState, type ModuleId, type SuiteResult} from '@/lib/workshop/harness-engine';
import {downloadText} from '@/lib/workshop/storage';
import './harness.css';

type Props = {chapterIndex:number; evidence:string[]; onEvidence:(value:string[])=>void};
type RecordedRun = {id:string; at:string; prediction:string; observation:string; state:HarnessState};
type Guide = {scene:string; focus:ModuleId; goal:string; actions:string[]; look:string; question:string};
const guides:Guide[] = [
  {scene:'lookup',focus:'loop',goal:'亲手把“模型提议”接到“工具执行”，再接回有依据的回答。',actions:['载入完整基线并开始。连续单步，分清提议、校验、实际执行与观察四个时刻。','运行到结束，记录工具结果如何支持回答。','只移除“循环调度”，重新运行同一场景。检查工具已经查到结果，为何任务仍没有完成。'],look:'模型输出工具名时，工具调用次数应仍为 0；进入工具执行后才变成 1。',question:'工具已经执行，为什么仍需要再调用一次模型？指出成功和失败轨迹第一次分叉的位置。'},
  {scene:'followup',focus:'history',goal:'看清上一轮结果怎样成为下一轮输入，并找到每对请求与回执的调用 ID。',actions:['使用完整基线运行“两步关联查询”，展开消息记录。','找出 find_customer 的结果，检查后续 lookup_order 使用的订单号。','只关闭“消息与调用 ID”再运行：调试面板仍能看见结果，但下一轮模型没有收到它。'],look:'find_customer 与 lookup_order 应各有不同的调用 ID；每个结果必须匹配自己的请求。',question:'为什么“页面能看到历史”与“模型拿到了历史”不是一回事？用两次运行的调用数解释。'},
  {scene:'badargs',focus:'schema',goal:'把一个错误请求挡在工具执行前，再用结构化错误让它恢复。',actions:['完整基线下单步运行，看数字 104 如何被拒绝。','继续到结束，确认第二次请求改成字符串 A104，实际查单只执行一次。','只关闭“参数校验”再跑；观察非法请求到达执行边界的位置。可额外试“未知工具”。'],look:'被校验拒绝的请求有调用 ID 和错误观察，但不应增加真实的模拟工具执行次数。',question:'输入类型正确与获得业务授权分别由谁检查？本次失败最早发生在哪一层？'},
  {scene:'falseclaim',focus:'observe',goal:'学会把“原业务没完成”与“系统如实处理了失败”分开判断。',actions:['完整基线运行，订单接口固定返回 403。','查看最终回答与工具回执：情景达标不表示已经查到发货状态。','只关闭“结果核验”，比较相同 403 下，脚本模型如何无依据地说“已发货”。'],look:'两组的工具结果相同；不同的是允许输出怎样的结论。',question:'哪些证据允许说“已请求”，哪些允许说“已确认”？这次为什么不能说已发货？'},
  {scene:'looping',focus:'budget',goal:'让没有新信息的循环以可解释方式停止，并区分业务预算与网页保护上限。',actions:['完整基线运行，观察三次相同空搜索后的“重复且无进展”终止。','只关闭“终止预算”再运行；系统将撞上独立的 80 步教学保护上限。','恢复预算，把最大执行步数改成 8，再看预算停止与重复检测谁先触发。'],look:'步数计算状态转移，调用数只计算进入工具执行；它们不是一个计数器。',question:'写出这两种停止条件的区别，并说明“提高上限”为什么不会产生缺失的政策。'},
  {scene:'injection',focus:'isolate',goal:'沿着外部文字到工具执行的路径，定位一次授权边界失守。',actions:['完整基线运行并打开政策工具返回，找到夹带的假系统指令。','只关闭“不可信内容隔离”再跑，比较外发计数。','最终答案可能看起来相同；请以事件、工具调用和外发账本判断差别。'],look:'隔离开关只模拟“策略正确执行/失效”两种情景，不能证明真实提示注入已被完整防御。',question:'外部文档在哪一步从数据变成了行动指令？实际部署还需哪些权限和执行边界？'},
  {scene:'refund',focus:'approval',goal:'建立“等待人的明确决定”这一状态，并观察批准前后的账本。',actions:['完整基线运行到暂停，核对订单、100 元金额和业务键。','先拒绝一次，确认零退款。再开新运行并批准，然后继续到结束。','只关闭“副作用审批”跑对照：即使只退了一次，也违反了执行前确认的要求。'],look:'点击批准只放行当前精确动作；还需进入工具执行步骤，钱才会在模拟账本中发生变化。',question:'审批与幂等各防止什么问题？用一笔未经批准但未重复的退款解释它们为何不能互相替代。'},
  {scene:'longcontext',focus:'memory',goal:'把任务约束保留下来，并区分记忆失误与下游审批兜底。',actions:['完整基线运行，查看上下文整理事件保留的金额上限。','只关闭“上下文整理”再跑，观察请求金额从 100 变成 300。','尝试批准这个错误提议；审批检查仍会阻止超额动作。记录“没造成损失”与“上游没有错误”的区别。'],look:'两组都可能没有超额扣款，但缺失记忆的一组不能顺利完成原任务。',question:'如果接手人只能看一份任务状态，它必须保存哪几个字段？哪些字段不能只存在自由文本摘要？'},
  {scene:'timeout',focus:'idempotency',goal:'经历“动作已发生、回执却失败”，再用稳定业务键完成核实。',actions:['完整基线批准退款，单步到超时。比较账本与模型收到的结果。','继续执行：应该查询 refund_status，而不是再次直接退款。','只关闭“幂等与状态查询”重新运行并批准，观察重复退款与总金额。再试关闭“错误恢复”的未知结果分支。'],look:'教学观察器知道账本已经变了；Agent 只能依赖自己收到的工具结果，因此必须查状态。',question:'把超时解释成“没有发生”会错在哪里？哪些证据必须放在持久化系统，而非进程内数组？'},
  {scene:'parallel',focus:'router',goal:'定义子任务契约，要求主流程拿到完整证据后再汇总。',actions:['完整基线运行，找出订单与政策的两个来源以及共同的只读限制。','只关闭“受控任务分工”再跑，检查缺少哪份证据。','说明哪些工作可以独立进行，为什么退款决定仍必须等待两份结果。'],look:'本地脚本同步生成两份子任务结果，演示信息与权限边界；不模拟真实网络并发速度。',question:'如果政策查询成功而订单查询失败，主流程能下什么结论、不能下什么结论？'},
  {scene:'audit',focus:'trace',goal:'让审计覆盖过程与副作用，不只记录最后一句正确答案。',actions:['完整基线运行，找出请求 ID、工具结果、终止原因。','只关闭“事件与评测”再跑。教学观察器仍可见，但被测系统不保留完整审计记录。','运行下方 16 项回归；需要审批的案例会暂停，逐项决定后比较失效分布。'],look:'调试面板由独立教学观察器提供；它不意味着真实系统已经做好持久化日志。',question:'写出三个不依赖回答措辞的不变量，并说明分别用哪类运行证据检验。'},
  {scene:'incident',focus:'isolate',goal:'在一条轨迹里处理注入、审批、回执超时与业务核实。',actions:['完整基线先核对政策，再对具体退款做人工决定。批准后继续到结束。','只关闭“不可信内容隔离”重跑：定位外发发生在审批之前还是之后。','对比两条终止记录，并逐层解释：哪道边界防什么，哪道边界不能替代另一道。'],look:'拒绝后面的退款无法撤销前面已经发生的模拟外发；不能用最后一个安全动作掩盖此前事故。',question:'像复盘事故一样，从最早偏离处说明因果链，再列出本地模拟走向真实系统仍需补的能力。'},
];
const statusLabels:Record<HarnessState['status'],string>={running:'正在执行',waiting:'等待人的决定',succeeded:'情景目标达标',failed:'发现系统缺口',stopped:'预算停止',cancelled:'用户已取消'};
const phaseLabels:Record<HarnessState['phase'],string>={model:'模型提议',validate:'检查契约',approval:'等待审批',tool:'执行工具',observe:'观察入上下文',done:'终止'};
const terminal=(s:HarnessState)=>!['running','waiting'].includes(s.status);
const configKey=(c:HarnessConfig)=>JSON.stringify([...modules.map(([id])=>c[id]),c.maxSteps]);
const describeConfig=(c:HarnessConfig)=>`${modules.filter(([id])=>c[id]).map(([,label])=>label).join('、')||'所有模块均关闭'}；最多 ${c.maxSteps} 步`;
const storageKey=(chapter:number)=>`harness-workbench-v3-${chapter}`;
const makeRunId=()=>globalThis.crypto?.randomUUID?.()||`run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function validConfig(value:unknown):value is HarnessConfig {
  return isObject(value)&&modules.every(([id])=>typeof value[id]==='boolean')&&Number.isInteger(value.maxSteps)&&Number(value.maxSteps)>=1&&Number(value.maxSteps)<=100;
}
function validRecordedRun(value:unknown):value is RecordedRun {
  if(!isObject(value)||typeof value.id!=='string'||typeof value.at!=='string'||typeof value.prediction!=='string'||typeof value.observation!=='string'||!isObject(value.state))return false;
  const s=value.state,w=s.world;
  const counter=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  return typeof s.scenario==='string'&&scenarios.some(scene=>scene.id===s.scenario)
    &&s.phase==='done'&&['succeeded','failed','stopped','cancelled'].includes(String(s.status))
    &&typeof s.answer==='string'&&typeof s.reason==='string'&&validConfig(s.config)
    &&counter(s.steps)&&counter(s.calls)&&counter(s.modelTurns)&&counter(s.spent)
    &&Array.isArray(s.messages)&&s.messages.length<=200&&s.messages.every(m=>isObject(m)&&['user','assistant','tool'].includes(String(m.role))&&typeof m.content==='string'&&(m.callId===undefined||typeof m.callId==='string')&&(m.tool===undefined||typeof m.tool==='string')&&(m.ok===undefined||typeof m.ok==='boolean'))
    &&Array.isArray(s.events)&&s.events.length<=500&&s.events.every(e=>isObject(e)&&counter(e.seq)&&typeof e.phase==='string'&&typeof e.detail==='string'&&['ok','warn','error'].includes(String(e.status))&&(e.callId===undefined||typeof e.callId==='string'))
    &&isObject(w)&&counter(w.refunds)&&counter(w.refunded)&&counter(w.externalSends)&&Array.isArray(w.keys)&&w.keys.every(k=>typeof k==='string')
    &&Array.isArray(s.approved)&&s.approved.every(a=>typeof a==='string')&&isObject(s.outcomes)&&Object.values(s.outcomes).every(counter)&&s.pending===null;
}
const moduleCode:Record<ModuleId,string>={
  loop:'while task.running: proposal = model(messages)',
  history:'messages.append(tool_result(call_id, result))',
  schema:'registry[tool_name].validate(arguments)',
  observe:'final_answer.require_supporting_observation()',
  budget:'if steps >= limit or no_progress: stop(reason)',
  isolate:'external_content.cannot_grant_permissions()',
  approval:'await approval_for(tool, object, amount, key)',
  idempotency:'reuse_or_query_result(stable_business_key)',
  memory:'retain(goal, constraints, evidence, pending, grants)',
  retry:'recover_by(error_kind, retry_limit, business_state)',
  router:'join(subtasks.with_shared_constraints_and_sources)',
  trace:'persist(call_id, arguments, result, stop_reason)',
};
function foundation(chapter:number):HarnessConfig {
  if(chapter===0)return configForChapter(-1);
  const c=configForChapter(chapter);
  // A minimal observation scaffold makes each new boundary independently visible.
  c.loop=true;c.history=true;c.observe=true;
  c[guides[chapter].focus]=false;
  return c;
}
const workspaceCache=new Map<number,{config:HarnessConfig;scene:string;runs:RecordedRun[]}>();
function initialWorkspace(chapter:number) {
  const cached=workspaceCache.get(chapter);if(cached)return cached;
  const fallback={config:foundation(chapter),scene:guides[chapter].scene,runs:[] as RecordedRun[]};
  try {
    const data=JSON.parse(localStorage.getItem(storageKey(chapter))||'null');
    if (!data||!validConfig(data.config)||!scenarios.some(s=>s.id===data.scene)||!Array.isArray(data.runs)) return fallback;
    const runs=data.runs.filter(validRecordedRun).slice(-8);
    return {config:data.config as HarnessConfig,scene:data.scene as string,runs:runs as RecordedRun[]};
  } catch {return fallback;}
}

export function HarnessLab(props:Props) {
  // Each chapter owns its controls and trajectories; switching never carries approvals.
  return <HarnessWorkbench key={props.chapterIndex} {...props}/>;
}
function HarnessWorkbench({chapterIndex,evidence,onEvidence}:Props) {
  const guide=guides[Math.max(0,Math.min(11,chapterIndex))];
  const [initial]=useState(()=>initialWorkspace(Math.max(0,Math.min(11,chapterIndex))));
  const [config,setConfig]=useState<HarnessConfig>(initial.config);
  const [sceneId,setSceneId]=useState(initial.scene);
  const [state,setState]=useState<HarnessState|null>(()=>initial.runs.at(-1)?.state||null);
  const [runId,setRunId]=useState(()=>initial.runs.at(-1)?.id||'');
  const [runs,setRuns]=useState<RecordedRun[]>(initial.runs);
  const [prediction,setPrediction]=useState('');
  const [runPrediction,setRunPrediction]=useState('');
  const [hint,setHint]=useState(false);
  const [suite,setSuite]=useState<SuiteResult[]|null>(null);
  const [suiteConfig,setSuiteConfig]=useState<HarnessConfig|null>(null);
  const [notice,setNotice]=useState('');
  const [storageNotice,setStorageNotice]=useState('');
  const uid=useId();
  const scene=scenarios.find(s=>s.id===sceneId)!;
  const dirty=!!state&&(state.scenario!==sceneId||configKey(state.config)!==configKey(config));
  const suiteDirty=!!suiteConfig&&configKey(suiteConfig)!==configKey(config);
  const activeRecord=runs.find(r=>r.id===runId);
  const eligible=runs.filter(r=>r.state.scenario===guide.scene&&r.observation.trim().length>=24);
  let pair:[RecordedRun,RecordedRun]|null=null;
  for (const success of [...eligible].reverse().filter(r=>scenarioPass(r.state))) {
    const contrast=[...eligible].reverse().find(r=>!scenarioPass(r.state)&&['failed','stopped'].includes(r.state.status)&&r.state.steps>0&&configKey(r.state.config)!==configKey(success.state.config));
    if (contrast) {pair=[success,contrast];break;}
  }
  useEffect(()=>{
    workspaceCache.set(chapterIndex,{config,scene:sceneId,runs});
    try {localStorage.setItem(storageKey(chapterIndex),JSON.stringify({config,scene:sceneId,runs}));setStorageNotice('');}
    catch {setStorageNotice('浏览器无法保存，轨迹仍保留在当前会话。刷新或关闭前请导出实验记录。');}
  },[chapterIndex,config,sceneId,runs]);
  function apply(next:HarnessState) {
    setState(next); setNotice('');
    if (terminal(next)) setRuns(prev=>prev.some(r=>r.id===runId)?prev.map(r=>r.id===runId?{...r,state:next}:r):[...prev.slice(-7),{id:runId,at:new Date().toISOString(),prediction:runPrediction,observation:'',state:next}]);
  }
  function begin() {setRunId(makeRunId());setRunPrediction(prediction);setState(startHarness(sceneId,config));setNotice('新运行已初始化。现在可单步执行，也可运行到下一次暂停。');}
  function preset(remove:boolean) {const c=configForChapter(chapterIndex,true);if(remove)c[guide.focus]=false;setConfig(c);setSceneId(guide.scene);setNotice(remove?`已仅移除“${modules.find(([id])=>id===guide.focus)![1]}”。请开始新运行，旧轨迹不会更新。`:'已载入完整基线。请开始新运行；遇到审批仍需你明确决定。');}
  function assemble(fromZero:boolean) {setConfig(fromZero?configForChapter(-1):foundation(chapterIndex));setSceneId(guide.scene);setNotice(fromZero?'已关闭全部可选组件。先运行一次，再依次接入循环调度、消息与调用 ID、结果核验，观察每次增加的能力。':'已载入本章基础组件，留出本章关键环节供你接入。其余基础观察能力作为教学支架。');}
  function annotate(id:string,value:string) {setRuns(prev=>prev.map(r=>r.id===id?{...r,observation:value}:r));}
  function saveEvidence() {
    if (!pair||dirty||!state||!terminal(state)) return;
    onEvidence(pair.map((r,i)=>`${i===0?'达标运行':'对照运行'} · ${scenarios.find(s=>s.id===r.state.scenario)!.title}\n记录 ${r.id} · ${r.at}\n设置：${describeConfig(r.state.config)}\n状态：${statusLabels[r.state.status]}；终止原因：${r.state.reason}\n执行 ${r.state.steps} 步，模型 ${r.state.modelTurns} 轮，工具 ${r.state.calls} 次；退款 ${r.state.world.refunded} 元 / ${r.state.world.refunds} 次；外发 ${r.state.world.externalSends} 次。\n关键证据：${r.state.events.slice(-4).map(e=>`${e.phase}：${e.detail}`).join('；')}\n我的解释：${r.observation.trim()}`));
    setNotice('本章两条对照证据已保存。它们记录操作与解释，不自动证明已掌握知识。');
  }
  function decideSuite(row:SuiteResult,decision:'approve'|'reject'|'cancel') {
    if (suiteDirty||!row.waiting) return;
    const next=decision==='cancel'?cancelHarness(row.state):runUntilPause(decideApproval(row.state,decision==='approve'));
    setSuite(prev=>prev!.map(r=>r.id===row.id?suiteResult(next):r));
  }
  return <div className="ws-experiment ws-harness">
    <div className="ws-experiment-intro"><span className="ws-mode">本地状态机 · 确定性脚本模型</span><h2>把一条 Agent 链路接起来</h2><p>你控制模块与执行顺序，观察请求怎样改变世界。这里不调用真实大模型、支付接口或外部网络；每个副作用只发生在独立的模拟账本里。</p></div>
    <div className="ws-task"><b>本章任务：{guide.goal}</b><ol>{guide.actions.map(a=><li key={a}>{a}</li>)}</ol><button className="ws-text-button" onClick={()=>setHint(!hint)} aria-expanded={hint}><Lightbulb size={16}/>{hint?'收起观察提示':'应该盯住哪个变化？'}</button>{hint&&<p className="ws-hint">{guide.look}</p>}</div>
    <div className="ws-harness-config">
      <div className="ws-harness-section-title"><div><span className="ws-harness-eyebrow">01 / 装配</span><h3>哪些环节由程序负责？</h3><p>先从零接线，再用完整基线与单模块对照定位因果。开关改变实际状态机行为。</p></div><div className="ws-harness-actions"><button className="ws-button" onClick={()=>assemble(true)}>从零组装</button><button className="ws-button" onClick={()=>assemble(false)}>载入本章基础组件</button><button className="ws-button" onClick={()=>preset(false)}><RotateCcw size={15}/>载入完整基线</button><button className="ws-button" onClick={()=>preset(true)}>只移除本章模块</button></div></div>
      {chapterIndex===0&&<div className="ws-harness-assembly"><b>从一句提议，到一条执行链路</b><p>起点只保留脚本模型、工具桩和单次请求解释器，尚未接入下列可靠性组件。先运行一次，接着依次打开“循环调度 → 消息与调用 ID → 结果核验”，每次都重新运行。观察从没有后续判断，到能记住结果，再到能给出有证据的结论。</p><p>首章用这三个组件即可查单；后续章节逐步加入契约、预算、权限、恢复与审计。完整基线按钮用于让你一次只研究一个缺口。</p></div>}
      <fieldset className="ws-harness-modules"><legend className="ws-harness-sr">选择 Harness 模块</legend>{modules.map(([id,label,help],i)=><label className={`ws-harness-module ${config[id]?'is-enabled':''} ${id===guide.focus?'is-focus':''}`} key={id}><input type="checkbox" checked={config[id]} onChange={e=>setConfig({...config,[id]:e.target.checked})}/><span><strong><em>{String(i+1).padStart(2,'0')}</em>{label}{id===guide.focus&&<small>本章关键</small>}</strong><span>{help}</span></span></label>)}</fieldset>
      <details className="ws-details ws-harness-code-map" open={chapterIndex===0?true:undefined}><summary>当前接入 {modules.filter(([id])=>config[id]).length} 个组件：每一个相当于增加什么代码？</summary><p>下列是职责示意，不是可直接运行的完整实现。先读左边的人话，再看右边怎样变成程序检查。</p>{modules.filter(([id])=>config[id]).length===0?<p>目前没有接入可选组件。先打开“循环调度”，让单次调用获得继续执行的路径。</p>:<ol>{modules.filter(([id])=>config[id]).map(([id,label,help])=><li key={id}><div><b>{label}</b><span>{help}</span></div><code>{moduleCode[id]}</code></li>)}</ol>}</details>
      <div className="ws-harness-scenario"><label className="ws-field" htmlFor={`${uid}-scene`}>选择教学场景<select id={`${uid}-scene`} value={sceneId} onChange={e=>setSceneId(e.target.value)}>{scenarios.map((s,i)=><option key={s.id} value={s.id}>{String(i+1).padStart(2,'0')} · {s.title}{s.id===guide.scene?'（本章）':''}</option>)}</select></label><label className="ws-field" htmlFor={`${uid}-budget`}>最大执行步数 <span>{config.maxSteps}{!config.budget?'（预算模块已关闭）':''}</span><input id={`${uid}-budget`} type="range" min={4} max={64} step={4} value={config.maxSteps} onChange={e=>setConfig({...config,maxSteps:Number(e.target.value)})}/><small>单步 = 一次状态转移。审批等待不消耗执行步数。</small></label></div>
      <div className="ws-harness-request"><strong>用户请求</strong><blockquote>{scene.request}</blockquote><p>{scene.description}</p><p><b>本情景的达标条件：</b>{scene.success}</p>{sceneId!==guide.scene&&<p className="ws-caption">这是扩展探索。本章学习证据请回到“{scenarios.find(s=>s.id===guide.scene)!.title}”，做同一场景的配置对照。</p>}</div>
      <label className="ws-field" htmlFor={`${uid}-prediction`}>运行前，预测哪个时刻会发生变化？<textarea id={`${uid}-prediction`} rows={2} maxLength={1200} value={prediction} onChange={e=>setPrediction(e.target.value)} placeholder="可选。比如：批准之前账本应为 0；关闭幂等后，超时重试可能让退款次数变成 2。"/></label>
    </div>

    <section className="ws-harness-runtime" aria-label="执行与观察">
      <div className="ws-harness-section-title"><div><span className="ws-harness-eyebrow">02 / 执行</span><h3>让每次状态变化可见</h3></div><span className="ws-harness-status" data-status={state?.status||'idle'}>{state?statusLabels[state.status]:'尚未运行'}</span></div>
      <div className="ws-harness-actions ws-harness-run-controls"><button className="ws-button primary" onClick={begin}><Play size={16}/>开始新运行</button><button className="ws-button" disabled={!state||dirty||state.status!=='running'} onClick={()=>state&&apply(stepHarness(state))}><StepForward size={16}/>单步执行</button><button className="ws-button" disabled={!state||dirty||state.status!=='running'} onClick={()=>state&&apply(runUntilPause(state))}><Play size={16}/>运行到暂停</button><button className="ws-button" disabled={!state||dirty||terminal(state)} onClick={()=>state&&apply(cancelHarness(state))}><Square size={14}/>取消任务</button></div>
      {dirty&&<p className="ws-harness-alert" role="status">配置或场景已改变。下方仍是旧运行，不能继续或据此新增完成证据；请开始新运行。</p>}
      {notice&&<p className="ws-harness-notice" role="status">{notice}</p>}
      {state?<>
        <p className="ws-caption">当前轨迹：{scenarios.find(s=>s.id===state.scenario)!.title} · {state.config.trace?'被测系统已启用审计':'被测系统未启用审计；以下为独立教学观察器'}</p>
        <StateDiagram state={state}/>
        <div className="ws-harness-next"><span>当前状态</span><strong>{phaseLabels[state.phase]}</strong><p>{phaseExplanation(state)}</p></div>
        <div className="ws-metrics ws-harness-metrics"><div><span>执行步数</span><strong>{state.steps}</strong><small>{state.config.budget?`预算 ${state.config.maxSteps} 步`:'业务预算关闭'}</small></div><div><span>脚本模型轮次</span><strong>{state.modelTurns}</strong><small>产生候选动作或回答</small></div><div><span>实际工具执行</span><strong>{state.calls}</strong><small>不含被校验拒绝的请求</small></div><div><span>模拟 token 账</span><strong>{state.spent}</strong><small>每轮固定 120，非真实计费</small></div></div>
        {state.status==='waiting'&&state.pending&&<div className="ws-harness-approval" role="region" aria-label="待审批动作"><ShieldCheck size={22}/><div><h4>程序在这里暂停，等待你的决定</h4><p><b>动作：</b>{state.pending.name} · <b>订单：</b>{String(state.pending.args.order_id)} · <b>金额：</b>{String(state.pending.args.amount)} 元</p><p><b>业务键：</b><code>{String(state.pending.args.key)}</code> · <b>调用 ID：</b><code>{state.pending.id}</code></p>{Number(state.pending.args.amount)>100&&<p className="ws-harness-danger">原任务上限为 100 元；当前提议超限，批准检查也会拦截它。</p>}<p>批准绑定这些具体参数。拒绝与取消只阻止后续动作，不能撤回已经发生的副作用。</p><div className="ws-harness-actions"><button className="ws-button primary" disabled={dirty} onClick={()=>apply(decideApproval(state,true))}>批准这项动作</button><button className="ws-button" disabled={dirty} onClick={()=>apply(decideApproval(state,false))}>拒绝这项动作</button></div></div></div>}
        <div className="ws-harness-ledger" aria-label="模拟账本"><div><span>退款次数</span><strong className={state.world.refunds>1?'ws-harness-danger':''}>{state.world.refunds}<small> 次</small></strong></div><div><span>退款总金额</span><strong className={state.world.refunded>100?'ws-harness-danger':''}>{state.world.refunded}<small> 元</small></strong></div><div><span>外部发送</span><strong className={state.world.externalSends>0?'ws-harness-danger':''}>{state.world.externalSends}<small> 次</small></strong></div><p>模拟账本是“外部世界已经发生什么”的证据；模型收到的回执可能与它不一致。刷新或开始新运行会创建新账本，不会连接真实服务。</p>{state.world.keys.length>0&&<p>已提交业务键：{state.world.keys.map((k,i)=><code key={`${k}-${i}`}>{k}{i<state.world.keys.length-1?' · ':''}</code>)}</p>}</div>
        {state.answer&&<div className={`ws-harness-answer ${scenarioPass(state)?'is-pass':'is-contrast'}`} aria-live="polite"><strong>{state.reason}</strong><p>{state.answer}</p><small>“情景目标达标”表示符合本案例的期望行为；澄清、拒绝、如实报告未完成也可能达标。</small></div>}
        <Trace state={state}/>
        {activeRecord&&<label className="ws-field" htmlFor={`${uid}-observation`}>留下可解释的实验观察（至少 24 个字符）<textarea id={`${uid}-observation`} rows={3} maxLength={3000} value={activeRecord.observation} onChange={e=>annotate(activeRecord.id,e.target.value)} placeholder={guide.question}/><small>{activeRecord.observation.trim().length}/24 · 写清改变的模块、实际证据和因果解释；长度只用于提醒记录，不是自动评分。</small></label>}
      </>:<div className="ws-awaiting"><div className="ws-flow"><span>提出动作</span><ArrowRight size={16}/><span>改变世界</span><ArrowRight size={16}/><span>核实结果</span></div><h3>当前还没有执行任何动作</h3><p>点击“开始新运行”初始化任务，再用“单步执行”观察一条边，或“运行到暂停”抵达审批与终点。</p></div>}
    </section>

    <section className="ws-harness-records" aria-label="实验对照与证据"><div className="ws-harness-section-title"><div><span className="ws-harness-eyebrow">03 / 解释</span><h3>用两条轨迹说明一个原因</h3><p>{guide.question}</p></div><button className="ws-button" disabled={!runs.length} onClick={()=>downloadText(`Harness-第${chapterIndex+1}章-实验轨迹.json`,JSON.stringify({version:1,simulation:'deterministic-local-no-real-model',chapter:chapterIndex+1,runs},null,2),'application/json')}><Download size={15}/>导出实验记录</button></div>
      {runs.length===0?<p className="ws-caption">结束一次运行后，这里会保存配置、完整轨迹和你的解释。最多保留最近 8 次；更早记录请先导出。</p>:<div className="ws-harness-run-list">{runs.map((r,i)=><details className="ws-details" key={r.id}><summary><span>记录 {i+1} · {scenarios.find(s=>s.id===r.state.scenario)!.title}</span><span className="ws-harness-record-status">{statusLabels[r.state.status]} · {r.observation.trim().length>=24?'已写观察':'待写观察'}</span></summary><p><b>配置：</b>{describeConfig(r.state.config)}</p><p><b>终止：</b>{r.state.reason}；{r.state.steps} 步 / {r.state.calls} 次工具调用；退款 {r.state.world.refunded} 元 / {r.state.world.refunds} 次；外发 {r.state.world.externalSends} 次。</p>{r.prediction&&<p><b>运行前预测：</b>{r.prediction}</p>}<label className="ws-field" htmlFor={`${uid}-record-${r.id}`}>这条轨迹说明了什么？<textarea id={`${uid}-record-${r.id}`} rows={3} maxLength={3000} value={r.observation} onChange={e=>annotate(r.id,e.target.value)} placeholder="至少 24 个字符：改变了什么条件，观察到什么证据，怎样解释差异。"/></label><Trace state={r.state}/></details>)}</div>}
      <div className="ws-evidence"><CheckCircle2 size={19}/><div><b>{pair?'已找到一组有效对照':'形成证据需要实际运行与解释'}</b><p>同一“{scenarios.find(s=>s.id===guide.scene)!.title}”场景，一次达标，一次不同配置导致的失败或预算停止；两条都需至少 24 个字符的观察。审批等待、开始运行、切换开关或手动取消都不能替代配置对照。</p><button className="ws-button primary" disabled={!pair||dirty||!state||!terminal(state)} onClick={saveEvidence}>保存本章对照证据</button></div></div>
      {evidence.length>0&&<details className="ws-details"><summary>已保存 {evidence.length} 条本章学习证据</summary>{evidence.map((item,i)=><pre className="ws-harness-evidence-text" key={i}>{item}</pre>)}</details>}
      {storageNotice&&<p role="status" className="ws-harness-alert">{storageNotice}</p>}
    </section>

    <section className="ws-harness-suite" aria-label="场景回归矩阵"><div className="ws-harness-section-title"><div><span className="ws-harness-eyebrow">04 / 迁移</span><h3>同一个配置，经得起多少种情况？</h3><p>回归检查 16 个固定案例。它不会替你批准动作，也不计入本章两次对照的完成证据。</p></div><button className="ws-button" onClick={()=>{setSuite(evaluateSuite(config));setSuiteConfig({...config});}}><FlaskConical size={16}/>运行 16 项回归</button></div>
      {suiteDirty&&<p className="ws-harness-alert">配置已改变，矩阵仍是旧配置结果。请重新运行回归后再处理审批。</p>}
      {suite&&<><p className="ws-harness-suite-summary"><b>{suite.filter(r=>r.pass).length} / 16 情景达标</b><span>{suite.filter(r=>r.waiting).length} 项等待人工决定</span><span>{suite.filter(r=>!r.pass&&!r.waiting).length} 项发现缺口或未完成</span></p><div className="ws-table-scroll"><table><caption>固定案例回归 · 每行拥有独立模拟账本</caption><thead><tr><th scope="col">场景 / 期望行为</th><th scope="col">结果</th><th scope="col">工具 / 退款 / 外发</th><th scope="col">终止原因或人工决定</th></tr></thead><tbody>{suite.map(row=><tr key={row.id}><th scope="row">{row.title}<small>{scenarios.find(s=>s.id===row.id)!.success}</small></th><td><span className="ws-harness-status" data-status={row.waiting?'waiting':row.pass?'succeeded':'failed'}>{row.waiting?'等待审批':row.pass?'情景达标':'未达标'}</span></td><td>{row.calls} / {row.refunds} / {row.external}</td><td>{row.waiting?<><p>{String(row.state.pending?.args.order_id)} · {String(row.state.pending?.args.amount)} 元 · <code>{String(row.state.pending?.args.key)}</code></p><div className="ws-harness-actions">{row.id==='cancel'?<button className="ws-button" disabled={suiteDirty} onClick={()=>decideSuite(row,'cancel')}>取消此案例</button>:<><button className="ws-button" disabled={suiteDirty} onClick={()=>decideSuite(row,'approve')} aria-label={`批准回归：${row.title}`}>批准并继续</button><button className="ws-button" disabled={suiteDirty} onClick={()=>decideSuite(row,'reject')} aria-label={`拒绝回归：${row.title}`}>拒绝</button></>}</div></>:row.reason}<details><summary>查看该案例轨迹</summary><p>{row.state.answer||'仍在等待，尚未给出最终结论。'}</p><ol>{row.state.events.map(e=><li key={e.seq}>{e.phase}：{e.detail}</li>)}</ol></details></td></tr>)}</tbody></table></div><p className="ws-caption">情景达标比例只描述这 16 个确定性脚本，不能外推为真实模型的成功率。并行分工由同步脚本表示；没有测量并行性能。</p></>}
    </section>

    <details className="ws-details"><summary>工具注册表：合法参数、副作用和返回契约</summary><p>工具名进入白名单仍不代表获得授权。参数、业务约束、可信审批与结果核验各有不同职责。</p><div className="ws-table-scroll"><table><thead><tr><th>工具</th><th>副作用</th><th>输入</th><th>返回</th></tr></thead><tbody>{toolContracts.map(t=><tr key={t.name}><td><code>{t.name}</code></td><td>{t.effect}</td><td>{t.input}</td><td>{t.output}</td></tr>)}</tbody></table></div></details>
    <details className="ws-details"><summary>把状态图读成一段最小运行器</summary><p>每一行对应上方可观察的阶段。模型提出候选动作，运行程序决定是否可以执行。实际实现还要处理持久化、并发与真实接口故障。</p><pre className="ws-harness-code">{`while task is running:                 # 取消和预算由运行器检查\n    check_budget_and_cancellation()\n    proposal = model(messages)         # 这里使用固定脚本模型\n    if proposal.is_final:\n        verify_against_observations()\n        finish_with_reason()\n        break\n    check_tool_name_and_arguments()    # 不合法 → 结构化错误\n    check_permissions_and_constraints()\n    if proposal.has_side_effect:\n        pause_for_exact_human_approval() # 没有决定就保持暂停\n        keep_stable_business_key()\n    result = execute_local_tool()      # 只有这里改变模拟账本\n    if result.is_unknown:\n        query_actual_business_status() # 超时不等于未执行\n    messages.append(paired_tool_result)\n    save_trace_and_task_state()`}</pre></details>
    <details className="ws-details"><summary>模拟边界：本实验能说明什么，不能证明什么？</summary><p>模型行为是人为编写的固定分支，不测试真实 LLM 推理能力。模块开关用于揭示特定控制失效的后果；“隔离”不是一套完整提示注入防御，“记忆”不是语义摘要器，“并行”不实测网络延迟。真实部署还需要最小权限、可信授权服务、数据边界与对抗测试。</p><p>账本、审批与幂等键仅存在当前浏览器运行的内存里。保存的轨迹用于复盘，不能充当真实支付服务的持久化账本。绝对 80 步保护上限防止演示卡死，不能替代业务预算。模拟 token 每轮固定增加 120，不是 tokenizer 测量，也不是实际费用。</p><p>事件和消息由独立教学观察器保留，便于看见“未回传历史”或“没有持久审计”的失败；观察器知道的事不自动成为 Agent 知道的事。关掉历史模块后，旧消息仍可在面板查看，但不进入脚本模型下一轮决策。</p></details>
  </div>;
}

function phaseExplanation(s:HarnessState) {
  if(s.phase==='model')return '下一步：脚本模型根据已进入上下文的消息，提出工具请求或最终结论。这个阶段不会直接执行工具。';
  if(s.phase==='validate')return `下一步：检查 ${s.pending?.name} 的工具契约和权限；通过后才进入执行或审批。`;
  if(s.phase==='approval')return '执行在此冻结。单步和运行到暂停都不能替代你的决定；没有动作被自动批准。';
  if(s.phase==='tool')return `下一步：真正执行本地 ${s.pending?.name}。若为退款，这一步才会改变模拟账本。`;
  if(s.phase==='observe')return '下一步：将工具结果与请求 ID 配对，再送回模型上下文。工具回执可能表示成功、失败或结果未知。';
  return '任务已终止，继续调用单步不会产生任何新动作。检查终止原因、账本和观察证据。';
}
function StateDiagram({state}:{state:HarnessState}) {
  const stages:HarnessState['phase'][]=['model','validate','approval','tool','observe','done'];
  return <figure className="ws-harness-diagram" aria-label={`当前状态：${phaseLabels[state.phase]}`}><div>{stages.map((phase,i)=><div className="ws-harness-node-wrap" key={phase}><span className={`ws-harness-node ${state.phase===phase?'is-current':''} ${phase==='approval'?'is-conditional':''}`} aria-current={state.phase===phase?'step':undefined}><small>{phase==='approval'?'有副作用时':String(i+1).padStart(2,'0')}</small>{phaseLabels[phase]}</span>{i<stages.length-1&&<ArrowRight size={16} aria-hidden="true"/>}</div>)}</div><figcaption>只读调用跳过审批；观察后回到模型提议。模型给出有依据的结论，或预算、拒绝、取消等终止条件触发时，进入终止态。</figcaption></figure>;
}
function Trace({state}:{state:HarnessState}) {
  return <div className="ws-harness-traces"><details className="ws-details"><summary>消息与调用配对 <span>{state.messages.length} 条</span></summary><p className="ws-caption">这是教学观察器的全量记录。{state.config.history?'工具结果按调用 ID 进入下一轮模型上下文。':'当前历史模块关闭；这些记录不会自动回传给脚本模型。'}</p><ol className="ws-harness-messages">{state.messages.map((m,i)=><li key={i} className={`role-${m.role}`}><div><b>{m.role==='user'?'用户':m.role==='assistant'?'脚本模型':'工具'}</b>{m.tool&&<code>{m.tool}</code>}{m.callId&&<code>{m.callId}</code>}{m.ok!==undefined&&<span>{m.ok?'成功回执':'错误 / 未知'}</span>}</div><pre>{m.content}</pre></li>)}</ol></details><details className="ws-details"><summary>执行事件与终止原因 <span>{state.events.length} 条</span></summary><ol className="ws-harness-events">{state.events.map(e=><li key={e.seq} data-level={e.status}><span>{String(e.seq).padStart(2,'0')}</span><div><b>{e.phase}</b>{e.callId&&<code>{e.callId}</code>}<p>{e.detail}</p></div></li>)}</ol>{!state.events.length&&<p>尚未执行第一个状态转换。</p>}</details></div>;
}

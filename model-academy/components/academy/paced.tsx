import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,BookOpen,Check,ChevronDown,Headphones,Map,MessageCircle,Pause,Copy} from 'lucide-react';
import {catalog,chapters,stepsFor,storageKey,emptyProgress,readSaved,Progress,Step} from '@/lib/academy/paced';
import {PredictionLab,DataLab,LinearLab} from './labs-foundation';
import './paced.css';
const labs=[PredictionLab,DataLab,LinearLab];
const plain=(text:string)=>text.replace(/\[([^\]]+)\]\(#[^)]+\)/g,'$1').replaceAll('**','').replaceAll('`','');
function chapterFromHash(){const match=location.hash.match(/^#chapter-(\d+)$/);const n=Number(match?.[1]);return n>=1&&n<=12?n:null;}
export default function Paced(){
 const [saved,setSaved]=useState(()=>{const s=readSaved();return {...s,chapter:chapterFromHash()??s.chapter};});
 const [voice,setVoice]=useState(false),[notice,setNotice]=useState(''),[menu,setMenu]=useState(false),[storageError,setStorageError]=useState(false);
 const currentRef=useRef<HTMLDivElement>(null);
 const chapter=saved.chapter,c=chapters.find(x=>x.number===chapter),p=saved.progress[chapter]||emptyProgress();
 const steps=useMemo(()=>c?stepsFor(c):[],[c]);
 const current=steps[p.cursor],remaining=Math.max(0,steps.length-p.cursor-1);
 const minutes=Math.ceil(steps.slice(p.cursor+1).reduce((n,b)=>n+(b.kind==='lab'?150:b.kind==='predict'?25:b.kind==='figure'?15:Math.max(6,plain(b.text).length/4)),0)/60);
 const canAdvance=current&&(current.kind!=='predict'||p.answers[current.id]!==undefined);
 const selectedSection=c?.sections.findIndex(s=>s.id===current?.section)??-1;
 function update(patch:Partial<Progress>){setSaved(s=>({...s,progress:{...s.progress,[chapter]:{...(s.progress[chapter]||emptyProgress()),...patch}}}));}
 function chooseChapter(n:number){setSaved(s=>({...s,chapter:n}));setMenu(false);setNotice('');history.replaceState(null,'',`#chapter-${n}`);}
 function advance(){if(!canAdvance)return;if(p.cursor<steps.length-1)update({cursor:p.cursor+1});else chooseChapter(Math.min(12,chapter+1));}
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(saved));setStorageError(false);}catch{setStorageError(true);}},[saved]);
 useEffect(()=>{const change=()=>{const n=chapterFromHash();if(n)setSaved(s=>({...s,chapter:n}));};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;const target=e.target as HTMLElement;if(target.closest('button,input,textarea,select,a,[role="slider"],[contenteditable="true"]'))return;if(e.code==='Space'||e.key==='Enter'){e.preventDefault();advance();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 useLayoutEffect(()=>{const frame=requestAnimationFrame(()=>{if(p.cursor===0)window.scrollTo({top:0,behavior:'instant'});else if(currentRef.current)currentRef.current.scrollIntoView({block:'start',behavior:'instant'});else window.scrollTo(0,0);});return()=>cancelAnimationFrame(frame);},[chapter,p.cursor,p.answers[current?.id],p.alts[current?.id]]);
 const spoken=current?(p.alts[current.id]?current.alt:current.text||current.formula||current.rows?.map(r=>r.join('，')).join('。')):'';
 const answer=current&&p.answers[current.id]!==undefined?current.reveal:'';
 useEffect(()=>{
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();
  if(voice&&spoken){const speech=new SpeechSynthesisUtterance(plain([spoken,answer].filter(Boolean).join('。')));speech.lang='zh-CN';speech.rate=.95;window.speechSynthesis.speak(speech);}
  return()=>window.speechSynthesis.cancel();
 },[voice,spoken,answer,chapter,p.cursor]);
 async function help(step:Step){
  if(!p.alts[step.id]){update({alts:{...p.alts,[step.id]:true}});return;}
  const title=c?.sections.find(s=>s.id===step.section)?.title||step.label;
  const question=`我在学模型工坊第 ${chapter} 章《${title}》，这一句没懂：${plain(step.text||step.formula||step.rows?.map(r=>r.join(' / ')).join('；')||'')}，请用产品经理听得懂的话再讲一遍`;
  try{await navigator.clipboard.writeText(question);setNotice('已复制问题，可以粘贴到你常用的 AI。');}
  catch{setNotice('浏览器未允许复制，请选中下面的问题手动复制：'+question);}
 }
 function renderStep(step:Step,index:number){
  const active=index===p.cursor,answered=p.answers[step.id],hasAlt=p.alts[step.id],Lab=labs[chapter-1];
  return <div key={step.id} ref={active?currentRef:undefined} className={`paced-step ${active?'is-current':'is-past'} ${step.kind==='lab'?'wide-step':''}`} data-step={index} data-kind={step.kind} data-section={step.section}>
   <div className="step-meta"><span className="teacher-avatar">工</span><span>模型工坊 <span className="meta-dot">·</span> {step.label}</span><small>{active?'当前':'已讲过'} · {index+1}</small></div>
   <article className={`teacher-bubble ${step.kind==='dock'?'dock-bubble':''} ${hasAlt?'has-alt':''}`}>
    {step.kind==='dock'?<><span className="dock-icon"><Check size={18}/></span><h3>这一节你拿到了</h3><p>{step.text}</p><div className="dock-pause"><Pause size={14}/>可以在这里停，下次从这继续</div></>:
     step.kind==='lab'?<><h3>{step.text}</h3><p className="lab-hint">动手试一次，再回到讲解。{p.labDone?'这项实验已完成并记录。':'也可以先继续，稍后回看。'}</p><div className="experiment-panel"><Lab done={p.labDone} onComplete={()=>update({labDone:true})}/></div></>:
     <>{step.text&&<p>{plain(step.text)}</p>}
      {step.kind==='figure'&&<figure><img src={`${import.meta.env.BASE_URL}course/figures/${step.figure}.webp`} alt={step.label} loading="lazy"/><figcaption>示意图 · {step.label}</figcaption></figure>}
      {step.formula&&<div className="paced-formula">{step.formula}</div>}
      {step.rows&&<div className="paced-table-wrap"><table>{step.rows.map((r,i)=><tbody key={i}><tr>{r.map((cell,j)=>i===0?<th key={j}>{cell}</th>:<td key={j}>{cell}</td>)}</tr></tbody>)}</table></div>}
      {step.kind==='predict'&&<><div className="prediction-hint">先凭直觉选一个，选错也没关系。</div><div className="prediction-options">{step.options?.map((o,i)=><button key={o} disabled={answered!==undefined} onClick={()=>update({answers:{...p.answers,[step.id]:i}})}>{String.fromCharCode(65+i)}<span>{o}</span><ArrowRight size={15}/></button>)}</div></>}
      {step.section==='feynman'&&step.id.endsWith(':0')&&<textarea aria-label="我的费曼复述" placeholder="试着用自己的话讲给同事听……（自动保存在本机）" value={p.note} onChange={e=>update({note:e.target.value})}/>}
      {step.alt&&<button className="help-button" onClick={()=>help(step)}>{hasAlt?<Copy size={14}/>:<MessageCircle size={14}/>} {hasAlt?'复制问题去问 AI':'没懂，换个说法'}</button>}
     </>}
   </article>
   {step.kind==='predict'&&answered!==undefined&&<><div className="my-turn"><span>我</span><div>{step.options?.[answered]}</div></div><div className="teacher-reveal"><span>{answered===step.correct?'对，就是这个意思。':'我们换个角度看。'}</span><p>{plain(step.reveal||'')}</p></div></>}
   {hasAlt&&<div className="alt-bubble"><span className="alt-label">换个说法</span><p>{step.alt}</p><button className="help-button" onClick={()=>help(step)}><Copy size={14}/> 复制问题去问 AI</button></div>}
  </div>;
 }
 return <div className="paced-app">
  <header className="paced-header"><a className="paced-brand" href="#chapter-1" onClick={()=>chooseChapter(1)}><span className="brand-mark">模</span><b>模型工坊</b><span className="pilot-badge">v4 讲解流</span></a><div className="header-actions">{'speechSynthesis' in window&&<button className={`voice-toggle ${voice?'on':''}`} role="switch" aria-checked={voice} onClick={()=>setVoice(!voice)}><Headphones size={16}/><span>朗读{voice?'开':'关'}</span></button>}<button className="mobile-menu" onClick={()=>setMenu(!menu)} aria-expanded={menu}><BookOpen size={17}/>章节<ChevronDown size={14}/></button><a className="reader-link" href="/hhh/v3/">阅读版 ↗</a></div></header>
  <aside className={`paced-sidebar ${menu?'open':''}`}><div className="sidebar-eyebrow">造一台接话机器</div><h2>一步一步，<br/>把它组装起来。</h2><p className="sidebar-intro">一次只讲一个想法。<br/>跟得上再继续。</p><nav aria-label="课程章节">{catalog.map((item,i)=><button key={item.number} className={chapter===item.number?'selected':''} aria-current={chapter===item.number?'page':undefined} onClick={()=>chooseChapter(item.number)}><span className="chapter-number">{String(item.number).padStart(2,'0')}</span><span>{item.title}<small>{i<3?(saved.progress[item.number]?.cursor?'继续上次的讲解':'讲解流 · 可开始'):'阅读版'}</small></span>{chapter===item.number&&<i/>}</button>)}</nav><div className="sidebar-foot">第 1–3 章节奏试点<br/>全部知识，按自己的速度学。</div></aside>
  <main className="paced-main">
   <div className="pace-map"><div className="map-title"><Map size={14}/><span>机器组装进度</span><b>{chapter<=6?'01 / 能算':chapter<=9?'02 / 学准':'03 / 可用'}</b></div><div className="map-stages"><span className={chapter<=6?'active':''}>1–6 能算出下一词</span><span className={chapter>=7&&chapter<=9?'active':''}>7–9 学得准</span><span className={chapter>=10?'active':''}>10–12 可用可信</span></div>{c&&<div className="pace-status"><div className="section-dots">{c.sections.map((s,i)=><span key={s.id} title={s.title} className={i<=selectedSection?'filled':''}/>)}</div><span>{current?.section==='hook'?'从问题开始':current?.label} · 还剩 {remaining} 拍 · 约 {minutes} 分钟</span></div>}</div>
   <div className="paced-content"><div className="chapter-heading"><div className="eyebrow">第 {String(chapter).padStart(2,'0')} 章 <span>/ {c?'给一小块 → 想一下 → 再回应':'继续探索'}</span></div><h1>{catalog[chapter-1].title}</h1>{c&&<p>不用一次读完。每讲完一节，都可以停下来。</p>}</div>
    {c?<div className="conversation" aria-label="纵向讲解流">{steps.slice(0,p.cursor+1).map(renderStep)}</div>:<div className="fallback-card"><span className="fallback-icon"><BookOpen size={25}/></span><h2>这一站，我们要解决什么？</h2><p>{catalog[chapter-1].question}</p><a className="paced-primary" href="/hhh/v3/">这一章暂时用阅读版 <ArrowRight size={17}/></a><small>打开 v3 阅读版后，选择第 {chapter} 章。</small></div>}
   </div>
  </main>
  {c&&<footer className="paced-footer"><div><span>{storageError?'本机存储不可用，本次进度暂未保存':'进度已保存在这台设备'}</span><small>{current?.kind==='predict'&&p.answers[current.id]===undefined?'先选一个答案，再看解释':'空格 / 回车，也可以继续'}</small></div><button className="paced-primary" disabled={!canAdvance} onClick={advance}>{p.cursor===steps.length-1?'下一章':'继续'}<ArrowRight size={18}/></button></footer>}
  {notice&&<div className="paced-notice" role="status"><p>{notice}</p><button onClick={()=>setNotice('')}>知道了</button></div>}
 </div>;
}

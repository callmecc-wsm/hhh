import type {ChapterRecord,Course,CourseSave,Run,Lab} from './types';
import {finetuneLabs} from './finetune-labs';
import {distillLabs} from './distill-labs';
export const storageKey=(id:string)=>`model-workshop-v2-${id}`;
export const blankRecord=():ChapterRecord=>({runs:[],read:[],answers:[null,null],submitted:false,caseAnswer:null,reflection:'',rubric:[false,false,false],reflected:false,harnessEvidence:[]});
export const blankSave=(course:Course):CourseSave=>({version:2,current:0,chapters:Object.fromEntries(course.chapters.map(ch=>[ch.id,blankRecord()]))});
// This checks saved-data integrity so an interrupted write or old schema cannot
// crash the teaching UI. It is not a security boundary or a claim of mastery.
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(s=>typeof s==='string');
function validRun(v:unknown,lab?:Lab):v is Run {
 if(!object(v)||typeof v.id!=='string'||!v.id||typeof v.prediction!=='string'||v.prediction.length>1000||typeof v.observation!=='string'||v.observation.length>2000||!object(v.settings)||!Object.values(v.settings).every(finite)||!object(v.result))return false;
 const settings=v.settings;
 if(lab&&(Object.keys(settings).length!==lab.controls.length||!lab.controls.every(c=>{const n=settings[c.key];return finite(n)&&(c.options?c.options.some(o=>o.value===n):(c.min===undefined||n>=c.min)&&(c.max===undefined||n<=c.max)&&(c.step===undefined||Math.abs((n-(c.min??0))/c.step-Math.round((n-(c.min??0))/c.step))<1e-7));})))return false;
 const r=v.result;
 return typeof r.headline==='string'&&typeof r.passed==='boolean'
  &&Array.isArray(r.metrics)&&r.metrics.every(m=>object(m)&&typeof m.label==='string'&&typeof m.value==='string'&&(m.detail===undefined||typeof m.detail==='string'))
  &&strings(r.columns)&&Array.isArray(r.rows)&&r.rows.every(row=>Array.isArray(row)&&row.every(cell=>typeof cell==='string'||finite(cell)))
  &&strings(r.findings)&&(r.axis===undefined||typeof r.axis==='string')
  &&(r.series===undefined||(Array.isArray(r.series)&&r.series.length>0&&r.series.every(s=>object(s)&&typeof s.name==='string'&&Array.isArray(s.values)&&s.values.length>0&&s.values.every(finite))));
}
export function validSave(value:unknown,course:Course):value is CourseSave {
 if(!object(value)||value.version!==2||!Number.isInteger(value.current)||typeof value.current!=='number'||value.current<0||value.current>=course.chapters.length||!object(value.chapters))return false;
 const chapters=value.chapters;
 return course.chapters.every((ch,index)=>{
  const p=chapters[ch.id],lab=course.id==='finetune'?finetuneLabs[index]:course.id==='distill'?distillLabs[index]:undefined;
  if(!object(p))return false;
  return Array.isArray(p.runs)&&p.runs.length<=30&&p.runs.every(r=>validRun(r,lab))&&new Set(p.runs.map(r=>(r as Run).id)).size===p.runs.length
   &&Array.isArray(p.read)&&p.read.length<=6&&new Set(p.read).size===p.read.length&&p.read.every(n=>Number.isInteger(n)&&n>=0&&n<6)
   &&Array.isArray(p.answers)&&p.answers.length===ch.quiz.length&&p.answers.every((a,i)=>a===null||(Number.isInteger(a)&&a>=0&&a<ch.quiz[i].options.length))
   &&typeof p.submitted==='boolean'&&(p.caseAnswer===null||(typeof p.caseAnswer==='number'&&Number.isInteger(p.caseAnswer)&&p.caseAnswer>=0&&p.caseAnswer<ch.caseStudy.options.length))
   &&typeof p.reflection==='string'&&p.reflection.length<=10000&&Array.isArray(p.rubric)&&p.rubric.length===3&&p.rubric.every(v=>typeof v==='boolean')&&typeof p.reflected==='boolean'
   &&strings(p.harnessEvidence)&&p.harnessEvidence.every(v=>v.trim().length>0)&&new Set(p.harnessEvidence.map(v=>v.trim())).size===p.harnessEvidence.length;
 });
}
export function experimentComplete(p:ChapterRecord,harness:boolean){return harness?new Set(p.harnessEvidence.map(v=>v.trim()).filter(Boolean)).size>=2:p.runs.some(r=>r.result.passed&&r.observation.trim().length>=12)&&new Set(p.runs.map(r=>JSON.stringify(Object.entries(r.settings).sort(([a],[b])=>a.localeCompare(b))))).size>=2;}
export function chapterComplete(course:Course,index:number,p:ChapterRecord){const ch=course.chapters[index];return p.read.length===6&&new Set(p.read).size===6&&p.read.every(n=>Number.isInteger(n)&&n>=0&&n<6)&&experimentComplete(p,course.id==='harness')&&p.submitted&&ch.quiz.every((q,i)=>q.answer===p.answers[i])&&p.caseAnswer===ch.caseStudy.answer&&p.reflected&&p.reflection.trim().length>=60&&p.rubric.every(Boolean);}
export function downloadText(filename:string,text:string,mime='text/markdown;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function report(course:Course,save:CourseSave){return `# ${course.subtitle} · 学习记录\n\n导出时间：${new Date().toISOString()}\n\n此报告记录实验、自测和本人复述，不是自动能力认证。所有数字遵循页面标注的计算或教学情景边界。\n\n`+course.chapters.map((ch,i)=>{const p=save.chapters[ch.id];return `## ${i+1}. ${ch.title}\n\n核心问题：${ch.question}\n\n原理阅读：${p.read.length}/6；学习环节完成：${chapterComplete(course,i,p)?'是':'尚未全部完成'}\n\n`+p.runs.map((r,j)=>`### 实验 ${j+1}\n\n- 设置：${JSON.stringify(r.settings)}\n- 预测：${r.prediction||'未填写'}\n- 结果：${r.result.headline}\n${r.result.metrics.map(m=>`- ${m.label}：${m.value}`).join('\n')}\n- 我的观察：${r.observation||'未填写'}\n\n`).join('')+`### Harness 证据\n\n${p.harnessEvidence.join('\n\n')||'无'}\n\n### 独立解释\n\n${p.reflection||'尚未填写'}\n\n### 对照要点\n\n${ch.rubric.map((r,j)=>`- [${p.rubric[j]?'x':' '}] ${r}`).join('\n')}\n\n### 来源\n\n${ch.sources.map(s=>`- [${s.title}](${s.url})`).join('\n')}\n`;}).join('\n');}

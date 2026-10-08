import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const v3=JSON.parse(fs.readFileSync(root+'model-academy/lib/academy/v3-preview.json'));
const v4=JSON.parse(fs.readFileSync(root+'model-academy/lib/academy/v4-beats.json'));
const clean=s=>s.replace(/\[([^\]]+)\]\(#[^)]+\)/g,'$1').replaceAll('**','').replaceAll('`','');
let errors=[];
for(const c of v4.chapters){
 const source=v3.playable.find(x=>x.number===c.number);
 const all=[...c.hook,...c.sections.flatMap(s=>[...s.beats,{kind:'dock',text:s.takeaway}]),...c.lab.intro,{kind:'predict',text:c.lab.guess}, {kind:'lab',text:c.lab.title},...c.lab.reflection,...c.quizzes.map(q=>({kind:'predict',text:q.q,reveal:q.why})),...c.summary,...c.feynman,{kind:'say',text:c.leaving}];
 const long=all.filter(b=>!['table','formula'].includes(b.kind)&&[...b.text].length>90);
 const missing=all.filter(b=>b.mechanism&&!b.alt?.trim());
 const longAlt=all.filter(b=>b.alt&&[...b.alt].length>90);
 const covered=JSON.stringify(c.sections.map(s=>s.id))===JSON.stringify(source.sections.map(s=>s.id));
 let conserved=true;
 for(const s of c.sections){
  const old=source.sections.find(x=>x.id===s.id);
  old.blocks.forEach((b,i)=>{
   const beats=s.beats.filter(x=>x.sourceBlock===i);
   let match=true;
   if(b.type==='p')match=beats.map(x=>x.text).join('')===clean(b.text);
   if(b.type==='olist')match=b.items.every((t,j)=>beats.filter(x=>x.sourceItem===j).map(x=>x.text).join('')===clean(t));
   if(b.type==='formula')match=beats[0]?.formula===b.text;
   if(b.type==='table')match=JSON.stringify(beats[0]?.rows)===JSON.stringify(b.rows);
   if(b.type==='figure')match=beats[0]?.figure===b.id;
   if(!match){conserved=false;errors.push(`${s.id} source block ${i} not conserved`);}
  });
  const prediction=s.beats.findIndex(b=>b.kind==='predict');
  const figure=s.beats.findIndex(b=>b.kind==='figure');
  const mechanism=s.beats.findIndex(b=>b.mechanism);
  if(!(prediction>0&&prediction<figure&&figure<mechanism))errors.push(`${s.id}: example/predict/figure/mechanism order`);
 }
 for(const [name,original,beats] of [['hook',source.hookParas.join(''),c.hook],['summary',source.summary,c.summary],['feynman',source.feynman.join(''),c.feynman],['lab',source.lab.body.join(''),[...c.lab.intro,...c.lab.reflection].filter(x=>x.source)]]){
  if(clean(original)!==beats.map(b=>b.text).join(''))errors.push(`chapter ${c.number} ${name} content differs`);
 }
 const counts=c.sections.map(s=>`${s.id}:${s.beats.filter(b=>b.kind==='predict').length}`);
 console.log(`第 ${c.number} 章：${all.length} 拍（含实验、检查点、停靠与章末）；超 90 字 ${long.length}；机制缺 alt ${missing.length}；超长 alt ${longAlt.length}；section 覆盖 ${covered?'完整':'缺失'}；原文块/公式/表格 ${conserved?'完整':'缺失'}`);
 console.log('  每节 predict：'+counts.join('，'));
 if(long.length||missing.length||longAlt.length||!covered||c.sections.some(s=>!s.beats.some(b=>b.kind==='predict')))errors.push(`chapter ${c.number} failed`);
 const ids=c.sections.map(s=>s.id);
 if(!ids.includes(c.lab.afterSection)||c.quizzes.some(q=>!ids.includes(q.afterSection)))errors.push(`chapter ${c.number} invalid placement`);
 for(const b of all.filter(b=>b.kind==='predict'&&b.options))if(b.options.length<2||b.options.length>3||!b.options[b.correct]||!b.reveal)errors.push('invalid prediction');
}
if(v4.chapters.map(c=>c.number).join(',')!=='1,2,3')errors.push('pilot chapter coverage');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log('PASS：15/15 节；先猜→图→机制顺序正确；正文、数字、公式、表格、实验说明与章末内容无删减。');

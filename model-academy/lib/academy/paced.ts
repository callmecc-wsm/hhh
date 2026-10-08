import content from './v4-beats.json';
export type Beat = {
 kind:string; text:string; alt?:string; mechanism?:boolean; figure?:string; formula?:string;
 rows?:string[][]; options?:string[]; correct?:number; reveal?:string;
};
export type Step=Beat & {id:string;section:string;label:string};
export type Chapter=typeof content.chapters[number];
export const chapters=content.chapters;
export const catalog=content.catalog;
export function stepsFor(c:Chapter):Step[]{
 const steps:Step[]=[];
 const add=(bs:Beat[],section:string,label:string)=>bs.forEach((b,i)=>steps.push({...b,id:`${section}:${label}:${i}`,section,label}));
 add(c.hook,'hook','这章要解决的问题');
 c.sections.forEach(s=>{
  add(s.beats,s.id,s.title);
  if(c.lab.afterSection===s.id){
   add([{kind:'predict',text:c.lab.guess,options:c.lab.options,correct:c.lab.correct,reveal:c.lab.reveal}],s.id,'先猜，再动手');
   add(c.lab.intro,s.id,'实验准备');
   add([{kind:'lab',text:c.lab.title}],s.id,'动手验证');
   add(c.lab.reflection,s.id,'回看实验');
  }
  c.quizzes.filter(q=>q.afterSection===s.id).forEach((q,i)=>add([{kind:'predict',text:q.q,options:['对','错'],correct:q.answer?0:1,reveal:q.why}],s.id,`检查点 ${i+1}`));
  add([{kind:'dock',text:s.takeaway}],s.id,'这一节你拿到了');
 });
 add(c.summary,'summary','把这一章串起来');
 add(c.feynman,'feynman','费曼复述');
 add([{kind:'leaving',text:c.leaving}],'leaving','留给下一章的问题');
 return steps;
}
export const storageKey='model-academy-v4-pilot';
export type Progress={cursor:number;answers:Record<string,number>;alts:Record<string,boolean>;labDone:boolean;note:string};
export type Saved={chapter:number;progress:Record<number,Progress>};
export const emptyProgress=():Progress=>({cursor:0,answers:{},alts:{},labDone:false,note:''});
export function readSaved():Saved{
 try{
  const raw=JSON.parse(localStorage.getItem(storageKey)||'null');
  const progress:Record<number,Progress>={};
  for(const c of chapters){
   const p=raw?.progress?.[c.number];
   if(p&&Number.isInteger(p.cursor))progress[c.number]={
    cursor:Math.max(0,Math.min(stepsFor(c).length-1,p.cursor)),
    answers:Object.fromEntries(Object.entries(p.answers||{}).filter(([,v])=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<3)) as Record<string,number>,
    alts:Object.fromEntries(Object.entries(p.alts||{}).filter(([,v])=>v===true)) as Record<string,boolean>,
    labDone:p.labDone===true,note:typeof p.note==='string'?p.note:''
   };
  }
  return {chapter:raw?.chapter>=1&&raw.chapter<=12?Math.floor(raw.chapter):1,progress};
 }catch{return {chapter:1,progress:{}};}
}

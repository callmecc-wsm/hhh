import type {Chapter, Course, Quiz} from './types';
type CaseInput=[string,string,string[],number,string[]];
type QuestionInput=[string,string[],number,string];
// Keep the order stable between visits, while avoiding a repeated correct-answer position.
function placeAnswer<T>(items:T[],answer:number,target:number):{items:T[];answer:number} {
  const order=items.map((_,i)=>i);
  [order[answer],order[target]]=[order[target],order[answer]];
  return {items:order.map(i=>items[i]),answer:target};
}
export function chapter(id:string,title:string,question:string,brief:string,lessons:string[],formula:string,trap:string,caseInput:CaseInput,questions:QuestionInput[],reflection:string,rubric:string[],sources:{title:string;url:string}[]):Chapter {
  const [caseTitle,situation,options,answer,feedback]=caseInput;
  if(lessons.length!==6||questions.length!==2||options.length!==3||feedback.length!==options.length||!Number.isInteger(answer)||answer<0||answer>=options.length) throw new Error(`章节 ${id} 的结构不完整`);
  const seed=Array.from(id).reduce((n,c)=>n+c.charCodeAt(0),0);
  const quiz:Quiz[]=questions.map(([q,options,answer,why],i)=>{
    if(options.length!==3||!Number.isInteger(answer)||answer<0||answer>=options.length||!q||!why) throw new Error(`章节 ${id} 的诊断题 ${i+1} 不完整`);
    const reordered=placeAnswer(options,answer,(seed+i)%options.length);
    return {q,options:reordered.items,answer:reordered.answer,why};
  });
  const pairedOptions=options.map((option,i)=>({option,feedback:feedback[i]}));
  const caseOrder=placeAnswer(pairedOptions,answer,(seed+2)%options.length);
  const concepts=lessons.map(l=>{
    const parts=l.split('|');
    if(parts.length!==3||parts.some(p=>!p.trim())) throw new Error(`章节 ${id} 的概念需要标题、解释与具体例子`);
    const [title,body,example]=parts;
    return {title,body,example};
  });
  return {id,title,question,brief,concepts,formula,trap,caseStudy:{title:caseTitle,situation,options:caseOrder.items.map(o=>o.option),answer:caseOrder.answer,feedback:caseOrder.items.map(o=>o.feedback)},quiz,reflection,rubric,sources};
}
export const sourceReadingNote='以下为延伸阅读，未在本次构建中逐页在线核验。论文支持具体方法，不证明本工坊的模拟结果；滚动更新的文档、项目源码和服务条款请核对实际使用版本。';
export const ftSources=[{title:'LoRA 原始论文',url:'https://arxiv.org/abs/2106.09685'},{title:'QLoRA 原始论文',url:'https://arxiv.org/abs/2305.14314'},{title:'DPO 原始论文',url:'https://arxiv.org/abs/2305.18290'},{title:'Hugging Face TRL：SFT Trainer',url:'https://huggingface.co/docs/trl/sft_trainer'}];
export const kdSources=[{title:'Distilling the Knowledge in a Neural Network',url:'https://arxiv.org/abs/1503.02531'},{title:'Sequence-Level Knowledge Distillation',url:'https://arxiv.org/abs/1606.07947'},{title:'Distilling Step-by-Step',url:'https://arxiv.org/abs/2305.02301'},{title:'Anthropic 商业条款（使用前核对当前版本）',url:'https://www.anthropic.com/legal/commercial-terms'}];
export const harnessSources=[{title:'Pi agent-core 源码（延伸阅读，未锁定版本）',url:'https://github.com/badlogic/pi-mono/tree/main/packages/agent'},{title:'Pi coding-agent 源码（延伸阅读，未锁定版本）',url:'https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent'},{title:'Anthropic：Building effective agents',url:'https://www.anthropic.com/research/building-effective-agents'},{title:'JSON Schema：对象与属性',url:'https://json-schema.org/understanding-json-schema/reference/object'}];
export type {Course};

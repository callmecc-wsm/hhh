export const softmax = (xs: number[], temperature = 1) => {
  const scaled = xs.map(x => x / Math.max(temperature, 0.01));
  const max = Math.max(...scaled);
  const e = scaled.map(x => Math.exp(x - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map(x => x / sum);
};
export const entropy = (p: number[]) => -p.reduce((s, x) => s + (x > 0 ? x * Math.log(x) : 0), 0);
export const sample = (p: number[], r: number) => {
  let sum = 0;
  for (let i = 0; i < p.length; i++) { sum += p[i]; if (r < sum) return i; }
  return p.length - 1;
};
export function topP(p: number[], threshold: number) {
  const order = p.map((v, i) => ({v, i})).sort((a, b) => b.v-a.v);
  let sum = 0; const keep = new Set<number>();
  for (const {v, i} of order) { keep.add(i); sum += v; if (sum >= threshold) break; }
  return p.map((v, i) => keep.has(i) ? v / sum : 0);
}
export const fmt = (x: number, n = 2) => Number.isFinite(x) ? x.toFixed(n) : '超出范围';
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const softplus = (x: number) => Math.max(0,x)+Math.log1p(Math.exp(-Math.abs(x)));
export type Word = {tokens:string[], count:number};
export const corpus = ():Word[] => [['low',5],['lower',2],['newest',6],['widest',3]].map(([s,n])=>({tokens:[...String(s),'▁'],count:Number(n)}));
export function pairs(words:Word[]) {
  const map=new Map<string,number>();
  words.forEach(w=>w.tokens.slice(0,-1).forEach((t,i)=>{const k=JSON.stringify([t,w.tokens[i+1]]);map.set(k,(map.get(k)||0)+w.count);}));
  return [...map.entries()].map(([k,count])=>({pair:JSON.parse(k) as string[],count})).sort((a,b)=>b.count-a.count||a.pair.join('').localeCompare(b.pair.join('')));
}
export function mergePair(words:Word[],pair:string[]):Word[] {
  return words.map(w=>{const tokens:string[]=[];for(let i=0;i<w.tokens.length;i++){if(w.tokens[i]===pair[0]&&w.tokens[i+1]===pair[1]){tokens.push(pair.join(''));i++;}else tokens.push(w.tokens[i]);}return {...w,tokens};});
}
export function attention(q:number[]) {
  const keys=[[2,0,0,0],[1,1,0,0],[0,2,0,0]],values=[[2,0],[0,2],[1,1]];
  const scores=keys.map(k=>k.reduce((s,x,i)=>s+x*q[i],0)/2), weights=softmax(scores);
  return {keys,values,scores,weights,out:[0,1].map(j=>weights.reduce((s,w,i)=>s+w*values[i][j],0))};
}
export type OptState={w:number,m:number,v:number,t:number};
export function optimizerStep(s:OptState,lr:number,method:string,decay=0.01):OptState {
  const g=2*(s.w-3),t=s.t+1;
  if(method==='SGD')return {...s,t,w:s.w-lr*g};
  const m=.9*s.m+.1*g;
  if(method==='Momentum')return {...s,m,t,w:s.w-lr*m};
  const v=.999*s.v+.001*g*g;
  const update=(m/(1-.9**t))/(Math.sqrt(v/(1-.999**t))+1e-8);
  return {w:s.w-lr*update-lr*decay*s.w,m,v,t};
}
export function memoryEstimate(p:number,gpus:number,zero:number,seq:number,batch:number,checkpoint:boolean) {
  const params=p*1e9;
  const stateBytes=params*(zero===3?16/gpus:zero===2?2+14/gpus:16);
  const width=Math.sqrt(params/384), layers=32;
  const activationBytes=seq*batch*width*layers*2*12*(checkpoint?.25:1);
  return {state:stateBytes/2**30,activation:activationBytes/2**30,total:(stateBytes+activationBytes)/2**30};
}
export const tinyVocab=['小猫','小狗','喜欢','坐在','鱼','骨头','地毯','。'];
export const tinyTrain=[[0,2,4,7],[1,2,5,7],[0,3,6,7],[1,3,6,7]];
export function tinyLoss(w:number[][],data=tinyTrain) {
  let l=0,n=0;for(const seq of data)for(let i=0;i<seq.length-1;i++){l-=Math.log(softmax(w[seq[i]])[seq[i+1]]);n++;}return l/n;
}
export function tinyStep(w:number[][],lr:number) {
  const g=w.map(row=>row.map(()=>0));let n=0;
  for(const seq of tinyTrain)for(let i=0;i<seq.length-1;i++){const p=softmax(w[seq[i]]);p.forEach((v,j)=>g[seq[i]][j]+=v-(j===seq[i+1]?1:0));n++;}
  return w.map((row,i)=>row.map((v,j)=>v-lr*g[i][j]/n));
}

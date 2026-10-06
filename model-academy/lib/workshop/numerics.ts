export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const sum = (x: number[]) => x.reduce((a,b)=>a+b,0);
export const mean = (x: number[]) => sum(x)/Math.max(1,x.length);
export const round = (x: number, digits=2) => Number(x.toFixed(digits));
export function softmax(x: number[], temperature=1) {
  if (!Number.isFinite(temperature) || temperature<=0) throw new RangeError('温度必须是有限正数');
  if (!x.length || x.some(v=>!Number.isFinite(v))) throw new RangeError('logits 必须是非空有限数值列表');
  // Subtract before dividing so a small temperature cannot overflow the maximum logit.
  const m=Math.max(...x),a=x.map(v=>Math.exp((v-m)/temperature)),s=sum(a);
  return a.map(v=>v/s);
}
// 0 log 0 contributes zero. Positive target mass at p=0 correctly has infinite loss.
export const crossEntropy = (q: number[],p: number[]) => -sum(q.map((v,i)=>v===0?0:v*Math.log(p[i])));
export const kl = (q: number[],p: number[]) => sum(q.map((v,i)=>v===0?0:v*(Math.log(v)-Math.log(p[i]))));
export const sigmoid = (x: number) => 1/(1+Math.exp(-x));
export const softplus = (x: number) => Math.max(x,0)+Math.log1p(Math.exp(-Math.abs(x)));
export function wilson(correct:number,n:number) { if(!n)return [0,1];const z=1.96,p=correct/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,r=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [clamp(c-r),clamp(c+r)]; }
export function linearFit(steps:number,lr:number,noise:number,replay:number) {
  // Actual gradient descent on a tiny two-feature logistic classifier.
  const original=[[1,0,1],[-1,0,0],[.8,.2,1],[-.8,-.2,0]];
  const domain=[[0,1,1],[0,-1,0],[.2,.8,1],[-.2,-.8,0]];
  const data=domain.map((r,i)=>[r[0],r[1],i<noise?1-r[2]:r[2]]);
  for(let i=0;i<replay;i++) data.push(original[i%original.length]);
  let w=[2,-.4],b=0;const losses:number[]=[],general:number[]=[],target:number[]=[];
  const loss=(d:number[][])=>mean(d.map(([x,y,t])=>{const z=w[0]*x+w[1]*y+b;return t?softplus(-z):softplus(z);}));
  for(let k=0;k<=steps;k++) {losses.push(loss(data));general.push(loss(original));target.push(loss(domain));if(k===steps)break;const g=[0,0,0];for(const [x,y,t] of data){const e=sigmoid(w[0]*x+w[1]*y+b)-t;g[0]+=e*x;g[1]+=e*y;g[2]+=e;}w=w.map((v,i)=>v-lr*g[i]/data.length);b-=lr*g[2]/data.length;}
  return {w,b,losses,general,target,probabilities:domain.map(([x,y])=>sigmoid(w[0]*x+w[1]*y+b))};
}
export function distillFit(steps:number,lr:number,temperature:number,alpha:number,teacher=[3,1,0,-1]) {
  let z=teacher.map(()=>0);const history:number[]=[],objective:number[]=[],q=softmax(teacher,temperature);
  for(let k=0;k<=steps;k++){
    const p=softmax(z,temperature),hard=softmax(z),divergence=kl(q,p);
    history.push(divergence);
    // Hard-label supervision uses T=1, while the soft KL is scaled by T².
    objective.push(alpha*temperature**2*divergence+(1-alpha)*-Math.log(hard[0]));
    if(k===steps)break;
    z=z.map((v,i)=>v-lr*(alpha*temperature*(p[i]-q[i])+(1-alpha)*(hard[i]-(i===0?1:0))));
  }
  return {teacher:q,student:softmax(z,temperature),serving:softmax(z),history,objective,logits:z};
}

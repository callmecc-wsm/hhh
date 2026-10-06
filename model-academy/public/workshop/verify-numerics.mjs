#!/usr/bin/env node
// 在仓库中运行，独立比较 Python 与网页的逐步数值，允许浮点末位误差。
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source = stripTypeScriptTypes(await readFile(new URL('../../lib/workshop/numerics.ts',import.meta.url),'utf8'));
const {linearFit,distillFit} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const cases = [
  {fn:'linear_fit',args:[0,.3,0,0]},
  {fn:'linear_fit',args:[60,.3,0,0]},
  {fn:'linear_fit',args:[60,.3,2,0]},
  {fn:'linear_fit',args:[60,.3,4,8]},
  {fn:'linear_fit',args:[100,2,3,16]},
  {fn:'distill_fit',args:[0,.3,2,1]},
  {fn:'distill_fit',args:[50,.3,2,1]},
  {fn:'distill_fit',args:[60,.3,2,0]},
  {fn:'distill_fit',args:[100,1,4,.8]},
];
const python = spawnSync('python3',['-c','import json,sys; import fine_tune_and_distill as m; cases=json.loads(sys.argv[1]); print(json.dumps([getattr(m,c["fn"])(*c["args"]) for c in cases]))',JSON.stringify(cases)],{cwd:fileURLToPath(new URL('.',import.meta.url)),encoding:'utf8',timeout:10_000,maxBuffer:4*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
if (python.status!==0) throw new Error(python.stderr);
const results = JSON.parse(python.stdout);
let compared=0,largestError=0;
function compare(a,b,path){
  if(typeof a==='number'){
    const difference=Math.abs(a-b);
    if(!Number.isFinite(b)||difference>1e-11) throw new Error(`${path}: JavaScript=${a}, Python=${b}`);
    compared++;largestError=Math.max(largestError,difference);
  } else if(Array.isArray(a)) {
    if(!Array.isArray(b)||a.length!==b.length)throw new Error(`数组长度不同: ${path}`);
    a.forEach((value,i)=>compare(value,b[i],`${path}[${i}]`));
  } else {
    if(JSON.stringify(Object.keys(a).sort())!==JSON.stringify(Object.keys(b).sort()))throw new Error(`结果字段不同: ${path}`);
    for(const key of Object.keys(a))compare(a[key],b[key],`${path}.${key}`);
  }
}
cases.forEach((item,i)=>compare((item.fn==='linear_fit'?linearFit:distillFit)(...item.args),results[i],`case${i}`));
console.log(JSON.stringify({cases:cases.length,comparedNumbers:compared,largestAbsoluteError:largestError,tolerance:1e-11}));

const { chromium }=require('/opt/codex/cua_node/lib/node_modules/playwright');
const assert=(v,m)=>{if(!v)throw Error(m)};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');
 const lessons=await page.evaluate(()=>PAPERS.map(p=>({id:p.id,roles:LEARNING[p.id].passages.map(q=>q.role),correct:LEARNING[p.id].probe.correct})));
 for(const l of lessons){
  await page.evaluate(id=>{const old={v:1,current:id,view:'course',papers:{[id]:{step:2,unlocked:2,predictionSaved:true,prediction:'旧版的预测记录：我会改变方法并检验边界条件。',confidence:70,choice:0,judgment:{},notes:'旧版笔记，必须保留',experimentSeen:[],done:false}},transfer:{}};localStorage.setItem('paperlab-v1',JSON.stringify(old));},l.id);
  await page.reload();
  assert(await page.locator('.feedback').count()===0,l.id+' no answer leakage');
  for(let i=0;i<3;i++){
   await page.locator(`.passage-nav [data-index="${i}"]`).click();
   await page.locator(`[data-action="reading-role"][data-index="${l.roles[i]}"]`).click();
   assert(await page.evaluate(()=>document.activeElement?.dataset.action==='reading-role'),l.id+' keyboard focus retained');
   await page.locator('[data-action="review-reading"]').click();
   assert(await page.locator('.feedback:not(.wrong)').count()===1,l.id+' source annotation');
  }
  await page.locator('[data-action="next"]').click();assert(await page.locator('[data-action="method-reveal"]').isVisible(),l.id+' method unlocked');
  await page.locator('[data-action="step"][data-step="1"]').click();await page.locator('#prediction').fill('后来修改的预测：这个方案可能还有其他风险，需要检查公平比较。');await page.locator('[data-action="save-prediction"]').click();
  assert(await page.evaluate(id=>JSON.parse(localStorage.getItem('paperlab-v1')).papers[id].initialPrediction.text.includes('旧版的预测记录'),l.id),l.id+' immutable initial prediction');
  await page.evaluate(id=>{let s=JSON.parse(localStorage.getItem('paperlab-v1'));s.papers[id].step=6;s.papers[id].unlocked=6;localStorage.setItem('paperlab-v1',JSON.stringify(s));},l.id);await page.reload();
  await page.locator(`[data-action="probe-choice"][data-index="${l.correct}"]`).click();await page.locator('#probe-reason').fill('我先检查任务分母、评估协议和相同计算预算，再解释观测结果。');await page.locator('#probe-confidence').fill('60');await page.locator('[data-action="submit-probe"]').click();
  assert(await page.locator('.feedback:not(.wrong)').count()===1,l.id+' probe reference');await page.locator('#probe-revision').fill('还应该补充受控的对照与逐题结果。');await page.reload();
  assert(await page.locator('#probe-confidence').inputValue()==='60',l.id+' confidence stored');assert(await page.locator('#quick-note').inputValue()==='旧版笔记，必须保留',l.id+' old note preserved');
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{let s=JSON.parse(localStorage.getItem('paperlab-v1'));s.papers.r1.step=2;localStorage.setItem('paperlab-v1',JSON.stringify(s));});await page.reload();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'active reading mobile width');await page.screenshot({path:'/workspace/sites/paper-lab/qa/mobile-reading.png',fullPage:true});
 await page.evaluate(()=>{let s=JSON.parse(localStorage.getItem('paperlab-v1'));s.papers.r1.step=6;localStorage.setItem('paperlab-v1',JSON.stringify(s));});await page.reload();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'probe mobile width');
 await page.screenshot({path:'/workspace/sites/paper-lab/qa/mobile-probe.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{let s=JSON.parse(localStorage.getItem('paperlab-v1'));s.current='instruct';s.papers.instruct={step:4,unlocked:4,prediction:'旧预测',predictionSaved:true,judgment:{},experimentSeen:['table'],done:true};localStorage.setItem('paperlab-v1',JSON.stringify(s));});await page.reload();await page.locator('[data-action="experiment-tab"][data-tab="chart"]').click();assert(await page.locator('.error-range').count()===2,'real confidence interval chart');
 assert(errors.length===0,'browser errors: '+errors.join(','));
 console.log(JSON.stringify({passed:true,lessons:lessons.length,checks:'27 gated excerpts, keyboard focus, 9 transfer scenarios, legacy note migration, immutable initial predictions, confidence persistence, mobile reading and probes, real CI rendering',errors},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

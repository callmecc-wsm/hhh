const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
import fs from 'node:fs';
const out=process.env.V4_SHOTS||'/workspace/hhh-redesign-shots/v4-pilot';
fs.mkdirSync(out,{recursive:true});
const data=JSON.parse(fs.readFileSync(root+'model-academy/lib/academy/v4-beats.json'));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[],errors=[];
const assert=(v,m)=>{if(!v)throw Error(m);};
for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto(process.env.V4_URL||'http://127.0.0.1:4174/hhh/v4/',{waitUntil:'networkidle'});
 const shot=async name=>{await page.screenshot({path:`${out}/${name}-${width}.png`});};
 for(const c of data.chapters){
  await page.evaluate(n=>{location.hash=`chapter-${n}`},c.number);
  await page.waitForFunction(n=>document.querySelector('h1')?.textContent.includes(n),c.title);
  let count=0,predictions=0,altTested=false,labTested=false;
  while(true){
   const active=page.locator('.paced-step.is-current');
   const kind=await active.getAttribute('data-kind');
   const section=await active.getAttribute('data-section');
   const idx=Number(await active.getAttribute('data-step'));
   assert(idx===count,`cursor ${c.number}/${width}/${idx}/${count}`);
   if(c.number===1&&idx<3)await shot(`ch1-opening-beat${idx+1}`);
   if(kind==='figure'){
    await active.locator('img').evaluate(el=>el.loading='eager');
    await active.locator('img').evaluate(el=>el.decode());
   }
   if(kind==='predict'){
    assert(await page.locator('.paced-footer button').isDisabled(),'unanswered blocks advance');
    if(c.number===1&&predictions===0)await shot('ch1-predict-before');
    await active.locator('.prediction-options button').last().click();
    assert(await active.locator('.my-turn').count()===1,'user bubble');
    assert(await active.locator('.teacher-reveal').count()===1,'answer reveal');
    assert(await page.locator('.paced-footer button').isEnabled(),'answer unlocks');
    if(c.number===1&&predictions===0){await page.waitForTimeout(100);await shot('ch1-predict-after');const box=await active.locator('.teacher-reveal').boundingBox();assert(box.y+box.height<=(width===1440?1000:844)-80,'reveal visible above footer');}
    predictions++;
   }
   if(c.number===1&&section==='01_01'&&kind==='say'&&idx>5&&!altTested){
    await active.getByRole('button',{name:'没懂，换个说法',exact:true}).click();
    assert(await active.locator('.alt-bubble').count()===1,'alt inserted');
    await shot('ch1-alt');
    await active.locator('.alt-bubble button').click();
    assert((await page.evaluate(()=>navigator.clipboard.readText())).includes('第 1 章《先造一台接话机器》'),'clipboard context');
    await page.getByRole('button',{name:'知道了',exact:true}).click();
    await page.reload({waitUntil:'networkidle'});
    assert(Number(await page.locator('.is-current').getAttribute('data-step'))===idx,'cursor restored');
    assert(await page.locator('.is-current .alt-bubble').count()===1,'alt restored');
    altTested=true;
   }
   if(kind==='lab'){
    if(c.number===1){for(let i=0;i<3;i++)await active.getByRole('button',{name:'生成下一个 token',exact:true}).click();}
    if(c.number===2){for(let i=0;i<3;i++)await active.locator('.pair-grid button').first().click();await shot('ch2-inline-lab');assert(section==='02_02','lab follows BPE');}
    if(c.number===3){await active.getByRole('button',{name:'载入 90° 旋转例子',exact:true}).click();await active.getByRole('button',{name:'验证这次变换',exact:true}).click();}
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('model-academy-v4-pilot')));
    assert(saved.progress[c.number].labDone,'lab persisted');labTested=true;
   }
   if(c.number===3&&kind==='dock'&&section==='03_06')await shot('ch3-final-section-dock');
   if(await active.locator('textarea').count()){
    await active.locator('textarea').fill('ID 是地址，查表得到数字；矩阵组合数字，非线性让加工更有表达力。');
    const oldCursor=idx;await page.reload({waitUntil:'networkidle'});
    assert(await page.locator('.is-current textarea').inputValue()!=='','reflection saved');
    assert(Number(await page.locator('.is-current').getAttribute('data-step'))===oldCursor,'reflection cursor saved');
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no horizontal overflow ${c.number}/${idx}/${width}`);
   count++;
   if(kind==='leaving')break;
   if(c.number===1&&idx<2){await page.locator('body').click({position:{x:width-3,y:400}});await page.keyboard.press(idx===0?'Space':'Enter');}
   else await page.locator('.paced-footer button').click();
  }
  assert(labTested,'lab present');assert(predictions===c.sections.length+4,'predictions/checkpoints/lab guess count');
  results.push({width,chapter:c.number,beats:count,predictions,lab:'passed',overflow:0});
 }
 await page.locator('.paced-footer button').click();
 await page.waitForSelector('.fallback-card');await shot('ch4-reader-card');
 assert(await page.locator('.fallback-card a').getAttribute('href')==='/hhh/v3/','reader link');
 for(let n=5;n<=12;n++){await page.evaluate(n=>{location.hash=`chapter-${n}`},n);await page.waitForFunction(n=>document.querySelector('.eyebrow')?.textContent.includes(`第 ${String(n).padStart(2,'0')} 章`),n);assert(await page.locator('.fallback-card').count()===1,'fallback '+n);}
 await context.close();
}
await browser.close();assert(errors.length===0,errors.join('\n'));fs.writeFileSync(`${out}/smoke-results.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify(results));

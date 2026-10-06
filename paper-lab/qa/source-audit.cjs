const fs = require('fs');
global.window={};
require('../dist/data.js');
require('../dist/learning.js');
// PDF extraction can insert line-end hyphenation. Matching ignores whitespace and hyphens,
// while still requiring the quote to occur on its explicitly cited PDF page.
const normalize=s=>s.toLowerCase().replace(/[\s\-\u00ad]+/g,'');
let count=0;
for(const p of window.PAPERS){
  const id=p.id==='r1'?'r1-v1':p.id;
  const pages=fs.readFileSync(`${__dirname}/../research/${id}.txt`,'utf8').split('\f');
  const rawPath=`${__dirname}/../research/${id}-raw.txt`;
  const raw=fs.existsSync(rawPath)?fs.readFileSync(rawPath,'utf8').split('\f'):[];
  for(const passage of window.LEARNING[p.id].passages){
    const quote=normalize(passage.quote);
    if(!normalize(pages[passage.page-1]||'').includes(quote)&&!normalize(raw[passage.page-1]||'').includes(quote))throw Error(`${p.id}: quote not found on page ${passage.page}`);
    count++;
  }
}
console.log(`${count} excerpts verified on their cited PDF pages.`);

import assert from 'node:assert/strict';
import {mkdtemp, readdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

// Node 24 strips types. A temporary mirror resolves browser-style local imports
// without adding a test-only dependency to the teaching application.
const directory=await mkdtemp(join(tmpdir(),'workshop-storage-'));
let checks=0;
try {
  const source=new URL('../lib/workshop/',import.meta.url);
  for(const name of await readdir(source))if(name.endsWith('.ts')) {
    const content=(await readFile(new URL(name,source),'utf8')).replace(/from '(\.\/[^']+)'/g,"from '$1.ts'");
    await writeFile(join(directory,name),content);
  }
  const load=name=>import(pathToFileURL(join(directory,name)).href);
  const {blankSave,validSave,experimentComplete,chapterComplete}=await load('storage.ts');
  const {courses}=await load('courses.ts');
  const {finetuneLabs,initialSettings}=await load('finetune-labs.ts');
  const {distillLabs}=await load('distill-labs.ts');
  const test=(label,fn)=>{fn();checks++;console.log(`PASS ${label}`);};
  for(const course of courses)test(`blank ${course.id} restores`,()=>assert.equal(validSave(blankSave(course),course),true));
  const course=courses.find(course=>course.id==='finetune');
  const fresh=()=>{
    const save=blankSave(course),settings=initialSettings(finetuneLabs[0]);
    save.chapters.f1.runs=[{id:'run-1',prediction:'预测',observation:'保留一条独立观察',settings,result:finetuneLabs[0].run(settings)}];
    return save;
  };
  for(const course of courses.filter(c=>c.id!=='harness'))test(`all 12 generated ${course.id} records restore`,()=>{
    const save=blankSave(course),labs=course.id==='finetune'?finetuneLabs:distillLabs;
    course.chapters.forEach((chapter,i)=>{const settings=initialSettings(labs[i]);save.chapters[chapter.id].runs=[{id:`run-${i}`,settings,result:labs[i].run(settings),prediction:'',observation:''}];});
    assert.equal(validSave(save,course),true);
  });
  for(const [name,index,key,value,expected] of [
    ['reject fractional epoch',6,'epoch',1.5,false],
    ['reject off-grid gradient steps',4,'steps',10.5,false],
    ['accept floating-point slider step',4,'lr',0.35000000000000003,true],
  ])test(name,()=>{
    const save=blankSave(course),lab=finetuneLabs[index],settings=initialSettings(lab),result=lab.run(settings);
    settings[key]=value;
    save.chapters[course.chapters[index].id].runs=[{id:'step-check',prediction:'',observation:'',settings,result}];
    assert.equal(validSave(save,course),expected);
  });
  const invalid=[
    ['null metric',save=>save.chapters.f1.runs[0].result.metrics=[null]],
    ['null curve',save=>save.chapters.f1.runs[0].result.series=[null]],
    ['empty curves',save=>save.chapters.f1.runs[0].result.series=[]],
    ['empty curve samples',save=>save.chapters.f1.runs[0].result.series=[{name:'loss',values:[]}]],
    ['nonfinite curve sample',save=>save.chapters.f1.runs[0].result.series=[{name:'loss',values:[NaN]}]],
    ['nonfinite table value',save=>save.chapters.f1.runs[0].result.rows=[[Infinity]]],
    ['null table row',save=>save.chapters.f1.runs[0].result.rows=[null]],
    ['null run',save=>save.chapters.f1.runs=[null]],
    ['duplicate run ID',save=>save.chapters.f1.runs.push(structuredClone(save.chapters.f1.runs[0]))],
    ['missing setting',save=>delete save.chapters.f1.runs[0].settings.task],
    ['invalid setting option',save=>save.chapters.f1.runs[0].settings.task=200],
    ['unknown setting',save=>save.chapters.f1.runs[0].settings.old=1],
    ['duplicate read entries',save=>save.chapters.f1.read=[0,0,0,0,0,0]],
    ['out-of-range read entry',save=>save.chapters.f1.read=[6]],
    ['too many read entries',save=>save.chapters.f1.read=[0,1,2,3,4,5,6]],
    ['invalid quiz answer',save=>save.chapters.f1.answers=[99,0]],
    ['invalid case answer',save=>save.chapters.f1.caseAnswer=99],
    ['duplicate evidence',save=>save.chapters.f1.harnessEvidence=['trace','trace']],
    ['whitespace-only evidence',save=>save.chapters.f1.harnessEvidence=['   ']],
    ['duplicate evidence with whitespace',save=>save.chapters.f1.harnessEvidence=['trace',' trace ']],
    ['null chapter',save=>save.chapters.f1=null],
    ['noninteger chapter index',save=>save.current=0.5],
    ['unrecognized version',save=>save.version=1],
  ];
  for(const [name,mutate]of invalid)test(`reject ${name} without throwing`,()=>{const save=fresh();mutate(save);assert.equal(validSave(save,course),false);});
  test('duplicate settings with different key order are not an experiment comparison',()=>{
    const p=fresh().chapters.f1;p.runs[0].observation='这段观察的字符足够支持完成记录';p.runs.push({...p.runs[0],id:'run-2',settings:{method:0,task:0}});
    assert.equal(experimentComplete(p,false),false);
  });
  test('duplicate Harness evidence does not mark comparison complete',()=>{const p=fresh().chapters.f1;p.harnessEvidence=['x',' x '];assert.equal(experimentComplete(p,true),false);});
  test('reflection flag alone is not a completed explanation',()=>{
    const p=fresh().chapters.f1;p.read=[0,1,2,3,4,5];p.answers=course.chapters[0].quiz.map(q=>q.answer);p.submitted=true;p.caseAnswer=course.chapters[0].caseStudy.answer;p.reflected=true;p.reflection='';
    assert.equal(chapterComplete(course,0,p),false);
  });
  console.log(`${checks} storage integrity checks passed`);
} finally { await rm(directory,{recursive:true,force:true}); }

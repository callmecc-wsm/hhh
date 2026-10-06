#!/usr/bin/env node
// 在仓库中运行：node public/workshop/export-handbook.mjs
// 从课程源文件生成讲义，减少网页和下载资料的内容漂移。需要 Node >= 22.13。
import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const sourceRoot = new URL('../../lib/workshop/', import.meta.url);
const cache = new Map();
async function moduleURL(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const pending = (async () => {
    let source = stripTypeScriptTypes(await readFile(file, 'utf8'), {mode:'transform', sourceUrl:file.href});
    const matches = [...source.matchAll(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g)];
    for (const match of matches.reverse()) {
      const dependency = new URL(match[2].endsWith('.ts') ? match[2] : `${match[2]}.ts`, file);
      const url = await moduleURL(dependency);
      source = source.slice(0, match.index) + match[1] + url + match[3] + source.slice(match.index + match[0].length);
    }
    return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  })();
  cache.set(file.href, pending);
  return pending;
}
async function load(name) { return import(await moduleURL(new URL(name, sourceRoot))); }
const [{courses}, {finetuneLabs,initialSettings}, {distillLabs}, harness, {sourceReadingNote}, {glossary}] = await Promise.all([
  load('courses.ts'), load('finetune-labs.ts'), load('distill-labs.ts'), load('harness-engine.ts'), load('content.ts'), load('glossary.ts'),
]);
const escape = value => String(value).replaceAll('|','\\|').replaceAll('\n','<br>');
const table = (columns, rows) => ['| '+columns.map(escape).join(' | ')+' |','| '+columns.map(()=>'---').join(' | ')+' |',...rows.map(row=>'| '+row.map(escape).join(' | ')+' |'),''].join('\n');
const lines = ['# 模型工坊完整讲义', '', '**范围**：微调、蒸馏、Agent Harness 三课。已有的从零训练课程请从学习首页进入。', '', '**来源**：由仓库当前课程与实验定义自动导出。公式计算、真实微型训练、固定情景与本地状态机各有明确边界；不含真实模型调用或商业效果承诺。', '', '**读法**：先答预测与案例，再看参考。参考答案是本例的判断依据，不是开放问题的唯一措辞。', '', '## 学习路线', '', table(['课程','章节','阶段'], courses.map(course=>[course.subtitle,course.chapters.length,course.phases.join(' → ')]))];
lines.splice(8,0,`**参考资料边界**：${sourceReadingNote}`,'');
for (const course of courses) {
  lines.push(`## ${course.subtitle}：${course.title}`, '', course.description, '');
  for (const [index, chapter] of course.chapters.entries()) {
    lines.push(`### ${chapter.title}`, '', `**本章问题**：${chapter.question}`, '', `**学习任务**：${chapter.brief}`, '', table(['概念','机制','具体例子'], chapter.concepts.map(c=>[c.title,c.body,c.example])), `**关系或公式**：${chapter.formula}`, '', `**常见误解**：${chapter.trap}`, '');
    const labs = course.id==='finetune'?finetuneLabs:course.id==='distill'?distillLabs:null;
    if (labs) {
      const lab = labs[index];
      if (!lab) throw new Error(`缺少实验：${course.id}/${chapter.id}`);
      lines.push(`**实验**：${lab.title}`, '', `**情景**：${lab.context}`, '', `**数据类型**：${lab.mode}`, '', `**假设与边界**：${lab.assumptions}`, '', `**任务**：${lab.goal}`, '', '**运行前**：写下你准备改变的一个条件、预计变化的指标及原因。', '', table(['变量','默认值','范围或选项','作用'], lab.controls.map(c=>[c.label,c.options?.find(o=>o.value===c.initial)?.label??`${c.initial}${c.unit??''}`,c.options?c.options.map(o=>`${o.value}=${o.label}`).join('；'):`${c.min}–${c.max}，步长 ${c.step}`,c.help])), `**提示**：${lab.hint}`, '');
      const result = lab.run(initialSettings(lab));
      lines.push('<details>', '<summary>默认参数的运行结果：请先预测，再展开核对</summary>', '', '**说明**：默认设置可能故意未达练习条件；这份结果不等于推荐配置。', '', result.headline, '', table(['指标','数值','说明'], result.metrics.map(m=>[m.label,m.value,m.detail??''])), table(result.columns,result.rows), ...result.findings.map(f=>`- ${f}`), '', '</details>', '');
    } else {
      const cases = harness.scenarios.filter(scene=>scene.lesson===index);
      lines.push('**实验类型**：本地状态机。脚本模型提出预先编写的请求，工具修改内存模拟世界；不是实时模型决策。', '', table(['故障情景','任务','发生什么','要核对的证据'], cases.map(scene=>[scene.title,scene.request,scene.description,scene.success])), '**对照任务**：先运行当前配置，写下最早偏离目标的事件；再补一个相关模块，重跑同一情景。退款审批必须逐次检查对象与金额。', '');
    }
    lines.push(`**决策案例**：${chapter.caseStudy.title}`, '', chapter.caseStudy.situation, '', ...chapter.caseStudy.options.map((o,i)=>`- ${String.fromCharCode(65+i)}. ${o}`), '', '**检验理解**', '');
    for (const [qIndex, quiz] of chapter.quiz.entries()) lines.push(`**问题 ${qIndex+1}**：${quiz.q}`, '', ...quiz.options.map((o,i)=>`- ${String.fromCharCode(65+i)}. ${o}`), '');
    lines.push('**用自己的话解释**：'+chapter.reflection, '', '**自查依据**：'+chapter.rubric.join('；')+'。这些是解释线索，不是自动能力认证。', '', '<details>', '<summary>案例与测验参考：独立作答后查看</summary>', '', `**案例选择**：${String.fromCharCode(65+chapter.caseStudy.answer)}. ${chapter.caseStudy.options[chapter.caseStudy.answer]}`, '', table(['选择','反馈'], chapter.caseStudy.options.map((option,i)=>[option,chapter.caseStudy.feedback[i]])), ...chapter.quiz.map((quiz,i)=>`- **问题 ${i+1}**：${String.fromCharCode(65+quiz.answer)}. ${quiz.options[quiz.answer]}。${quiz.why}`), '', '</details>', '', '**延伸阅读**', '', ...chapter.sources.map(source=>`- [${source.title}](${source.url})`), '');
  }
}
lines.push('## Harness 模块速查', '', table(['模块','职责','执行时要看的东西'], harness.modules.map(([id,title,description])=>[id,title,description])), '## 实践资料', '', '- [学习指南与源代码阅读路线](learning-guide.md)', '- [Python 最小 Harness](mini_harness.py)', '- [Harness 故障回归测试](test_mini_harness.py)', '- [微调与蒸馏微型训练](fine_tune_and_distill.py)', '- [梯度与训练对照测试](test_training.py)', '', '**延伸任务**：把一个课堂案例改写成你熟悉的业务；先提出可能失效的条件，再设计一个可以证伪自己判断的对照。');
lines.push('', '## 术语释义与回顾', '', '**读法**：遇到术语时，先用例子理解，再回到相关章节。回顾问题请先合上材料作答。', '');
const chapterNames = new Map(courses.flatMap(course=>course.chapters.map(chapter=>[chapter.id,`${course.subtitle} · ${chapter.title}`])));
for(const entry of glossary) {
  lines.push(`**${entry.term}**`, '', entry.plain, '', table(['要点','内容'],[
    ['别名',entry.aliases.join('、')], ['机制',entry.mechanism], ['例子',entry.example], ['边界',entry.boundary],
    ['关联章节',entry.relatedChapters.map(id=>chapterNames.get(id)??id).join('；')], ['回顾问题',entry.reviewQuestion],
  ]));
}
const output = new URL('complete-handbook.md', import.meta.url);
await writeFile(output, lines.join('\n')+'\n');
console.log(JSON.stringify({output:fileURLToPath(output),courses:courses.length,chapters:courses.reduce((n,c)=>n+c.chapters.length,0),glossary:glossary.length,characters:lines.join('\n').length}));

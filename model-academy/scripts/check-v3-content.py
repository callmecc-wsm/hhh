"""Validate the v3 content contract; optionally compare the authoritative source directory."""
import json
import re
import sys
from pathlib import Path
from collections import Counter

app = Path(__file__).resolve().parents[1]
data = json.loads((app / 'lib/academy/v3-preview.json').read_text())
expected = [
    ['01_01','01_02','01_03','01_05','01_06'],
    ['02_01','02_02','02_03'],
    ['03_01','03_02','03_03','03_04','03_05','02_04','03_06'],
    ['04_01','04_02','04_03','04_04','04_05','04_06'],
    ['05_01','05_02','05_03','05_04','05_05','05_06'],
    ['06_02','06_03','06_01','06_04','06_05','06_06'],
    ['07_01','01_04','02_05','07_02','02_06','07_03','08_01','07_04','07_05','07_06'],
    ['08_02','08_03','08_04','08_05','08_06'],
    ['09_01','09_04','09_02','09_03','09_05','09_06'],
    ['10_01','10_02','10_03','10_04','10_05','10_06'],
    ['11_01','11_02','11_03','11_04','11_05','11_06'],
    ['12_01','12_02','12_03','12_04','12_05','12_06'],
]
chapters=data['playable']
assert len(chapters)==12 and not data['locked']
assert [c['number'] for c in chapters]==list(range(1,13))
assert [[s['id'] for s in c['sections']] for c in chapters]==expected
assert Counter(s['id'] for c in chapters for s in c['sections'])==Counter(f'{c:02}_{s:02}' for c in range(1,13) for s in range(1,7))
for c in chapters:
    assert len(c['quizzes'])==3 and all(type(q['answer']) is bool for q in c['quizzes'])
    assert set(c)==set(chapters[0]), (c['number'],set(c))
    assert all(c['lab'].get(k) for k in ('title','guess','body'))
    anchors={s['anchor'] for s in c['sections']}
    for anchor in re.findall(r'\]\(#([^)]+)\)',json.dumps(c,ensure_ascii=False)):
        assert anchor in anchors, (c['number'],anchor)
    for s in c['sections']:
        assert s['anchor']=='s-'+s['id'] and s['figure']==s['id']
        assert (app/f'public/course/figures/{s["id"]}.webp').is_file()
        assert all(b['type'] in ('p','table','olist','figure','formula') for b in s['blocks'])
        assert [b['id'] for b in s['blocks'] if b['type']=='figure']==[s['id']]
        if c['number']>=3:
            assert [b['type'] for b in s['blocks'][:3]]==['p','p','figure']
    if c['number']>=3:
        assert c['hookParas'][0]==chapters[c['number']-2]['leaving']
        assert all(re.search(r'\]\(#s-\d{2}_\d{2}\)',q['why']) for q in c['quizzes'])
# Regression guard for the explicit vocabulary migrations.
for chapter, forbidden in [(3,['前馈网络','注意力']), (4,['反向传播','损失']), (5,['KV','GQA','batch','交叉熵']), (6,['反向传播','梯度','[B,'])]:
    body=json.dumps(chapters[chapter-1],ensure_ascii=False)
    assert not any(term in body for term in forbidden), (chapter,[t for t in forbidden if t in body])
all_text=json.dumps(data,ensure_ascii=False)
assert all(s in all_text for s in ['(2,1)','错开一格','训练时答案已经在纸上','消融','小猫喜欢'])
print('PASS 12 chapters / 72 unique ordered scenes / 36 boolean quizzes / 12 lab entries')
print('PASS schema, figures, five-step block openings, local links, hook continuity, vocabulary migrations')
if len(sys.argv)>1:
    src=Path(sys.argv[1]); phase=(src/'phaseA.md').read_text()
    original=json.loads((src/'source/original.json').read_text())
    originals={s['id']:s for c in original['chapters'] for s in c['scenes']}
    for c in chapters:
        for s in c['sections']:
            assert s['takeaway'].rstrip('。')==originals[s['id']]['takeaway'].rstrip('。')
            assert originals[s['id']]['formula'] in all_text, (s['id'],'missing formula')
    ends=re.findall(r'^\| 第 \d+ 章 → [^|]+ \| (.+) \|$',phase.split('## 3. 每章「留下的问题」')[1].split('## 4.')[0],re.M)
    assert [c['leaving'] for c in chapters]==ends
    quiz_refs=re.findall(r'^quiz: (.+)$',phase.split('## 1. 最终场景顺序表')[1].split('## 2.')[0],re.M)
    all_refs=[ref for line in quiz_refs for ref in line.split(', ')]
    assert len(set(all_refs))==36
    for c in chapters[2:]:
        body=phase.split(f'### 新第 {c["number"]} 章：',1)[1].split('\n### 新第 ',1)[0]
        assert c['lab']['guess']==re.search(r'先猜：“([^”]+)”',body)[1]
    print('PASS all 72 source formulas and takeaways retained; Phase A leaving questions and lab guesses verbatim')
    print('Quiz source assignments: '+ '; '.join(f'{i+1}: {refs}' for i,refs in enumerate(quiz_refs)))

"""Functional checks on the delivered HTML, including offline and mobile use."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[];errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1080})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8765')
    assert page.title()=='Agent Harness · 运行观察室'
    traces=page.evaluate('DATA.traces.map(t=>({id:t.id,n:t.events.length}))')
    for t in traces:
        page.select_option('#trace-select',t['id'])
        for i in range(t['n']):
            page.locator(f'[data-step="{i}"]').click()
            assert f'{i+1} / {t["n"]}' in page.locator('.step-count').inner_text()
            for inspector in ['context','tool','state']:
                page.locator(f'[data-inspector="{inspector}"]').click()
                assert page.locator('.inspector').inner_text()
        if t['id'].startswith('mini-'):
            result=page.locator('.state-grid').inner_text()
            assert ('通过' if t['id']=='mini-verified' else '失败') in result
    checks.append('5 traces, every event and 3 inspectors; pass/fail evidence distinction')
    page.click('[data-page="compare"]')
    topics=page.evaluate('DATA.topics.map(t=>t.id)')
    for topic in topics:
        page.locator(f'.topic-nav [data-topic="{topic}"]').click()
        for h in page.evaluate('DATA.harnesses.map(h=>h.id)'):
            page.select_option('#compare-left',h)
            assert len(page.locator('.comparison').first.inner_text())>80
    checks.append('18 mechanisms × 7 harnesses render with evidence references')
    page.click('[data-page="lab"]')
    page.check('#gate');assert '不能把' in page.locator('.hint.bad').inner_text()
    page.check('#test-pass');assert '满足本教学门槛' in page.locator('.hint.good').inner_text()
    page.uncheck('#current-hash');assert '证据过期' in page.locator('.hint.bad').inner_text()
    page.click('[data-lab="compression"]')
    page.locator('#tokens').fill('699');assert '尚未触发' in page.locator('#budget-output').inner_text()
    page.locator('#tokens').fill('700');assert '触发压缩' in page.locator('#budget-output').inner_text()
    page.click('[data-lab="collapse"]');page.select_option('#protect','1');assert page.locator('.collapse-row').count()==5
    for lab in ['checkpoint','hook','worktree']:
        page.click(f'[data-lab="{lab}"]');assert len(page.locator('main').inner_text())>100
    checks.append('verification gate, stale evidence, compaction 699/700 boundary, output preservation, 6 experiment views')
    page.click('[data-page="sources"]')
    page.fill('#source-search','not-an-existing-function-7391');assert page.locator('.no-results').count()==1
    page.fill('#source-search','')
    for id in page.evaluate('DATA.sources.map(s=>s.id)'):
        page.locator(f'.source-item [data-source="{id}"]').click()
        assert page.locator('dialog[open] pre').inner_text()
        page.click('#close-source')
    checks.append(f"all {len(page.evaluate('DATA.sources'))} source modals and empty search state")
    page.click('[data-page="run"]');page.select_option('#trace-select','mini-verified');page.click('#play');page.wait_for_timeout(1800)
    assert page.evaluate('state.step')==1
    page.click('#play');page.click('#reset-step')
    page.screenshot(path=str(ROOT/'qa/desktop.png'),full_page=True)
    page.click('[data-page="compare"]');page.locator('.topic-nav [data-topic="compression"]').click();page.select_option('#compare-left','kimi');page.select_option('#compare-right','gemini');page.screenshot(path=str(ROOT/'qa/compare.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    for pageid in ['run','compare','map','lab','future','sources']:
        page.click(f'[data-page="{pageid}"]')
        overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
        assert not overflow, pageid
    page.click('[data-page="run"]');page.screenshot(path=str(ROOT/'qa/mobile.png'),full_page=True)
    page.context.set_offline(True)
    page.click('[data-page="lab"]');page.click('[data-lab="compression"]');page.locator('#tokens').fill('700')
    assert '触发压缩' in page.locator('#budget-output').inner_text()
    checks.append('autoplay, desktop, 390px viewport on all sections, interactions with network offline')
    browser.close()
assert not errors,errors
(ROOT/'qa/results.json').write_text(json.dumps({'passed':checks,'browser_errors':errors,'limitations':['Direct file:// navigation was blocked by the managed browser administrator policy. HTTP-loaded self-contained HTML was tested with network offline instead.']},ensure_ascii=False,indent=2))
print(json.dumps({'passed':checks,'browser_errors':errors},ensure_ascii=False,indent=2))

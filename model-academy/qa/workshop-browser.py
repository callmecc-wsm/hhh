#!/usr/bin/env python3
"""Repeatable browser acceptance tests for the four learning routes.

Run after starting Vite: python qa/workshop-browser.py --url http://127.0.0.1:5173
Uses an isolated browser profile. Results are evidence, not learner assessment.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright


ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "screenshots"
OBSERVATION = "只改变一个条件后，比较两次记录中的结果差异，再结合机制解释原因，避免同时改多个条件。"
REFLECTION = "这个机制的作用是把输入条件转化为可观察的结果。我们需要先保留基线，每次只改变一个条件，比较结果并寻找原因。实验只在明确的假设内有效，真实任务还要用独立数据验证，不能把模拟结果当成上线承诺。"


class Suite:
    def __init__(self, page: Page, url: str):
        self.page = page
        self.url = url.rstrip("/")
        self.results: list[dict] = []
        self.errors: list[str] = []
        page.on("pageerror", lambda error: self.errors.append(str(error)))
        page.on("console", lambda message: self.errors.append(message.text) if message.type == "error" else None)

    def check(self, name, action):
        started = time.monotonic()
        before = len(self.errors)
        try:
            evidence = action()
            if len(self.errors) > before:
                raise AssertionError("Browser error: " + "; ".join(self.errors[before:]))
            result = {"name": name, "status": "passed", "evidence": evidence}
            print(f"PASS {name}", flush=True)
        except Exception as error:
            result = {"name": name, "status": "failed", "error": str(error)}
            self.screenshot("failure-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"))
            print(f"FAIL {name}: {error}", flush=True)
        result["seconds"] = round(time.monotonic() - started, 2)
        self.results.append(result)

    def screenshot(self, name):
        SHOTS.mkdir(exist_ok=True)
        self.page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=False)

    def click_text(self, text, exact=False):
        target = self.page.get_by_role("button", name=text, exact=exact)
        if target.count() == 0:
            target = self.page.get_by_role("tab", name=text, exact=exact)
        if target.count() == 0:
            target = self.page.get_by_role("link", name=text, exact=exact)
        target.first.click()

    def course(self, course_id):
        chapter = {"finetune": "f1", "distill": "d1", "harness": "h1"}.get(course_id, "")
        self.page.goto(self.url + "/#/" + course_id + ("/" + chapter if chapter else ""))
        self.page.wait_for_timeout(150)

    def tab(self, name):
        self.page.get_by_role("tab", name=name, exact=True).click()

    def numeric_experiment(self):
        """Observe a real input/output cycle using the public experiment controls."""
        p = self.page
        p.get_by_label("先猜一猜：结果会怎么变？").fill("先保留基线，再改变单一输入条件，预计可观察结果随之变化。")
        p.get_by_role("button", name="运行并记录", exact=True).click()
        expect(p.locator(".ws-result")).to_be_visible()
        first_headline = p.locator(".ws-result-title").inner_text()
        p.get_by_label("你观察到了什么？").fill(OBSERVATION)
        settings = p.locator(".ws-controls select, .ws-controls input[type=range]")
        assert settings.count() > 0, "Experiment has no settings"
        changed = settings.first
        if changed.evaluate("e => e.tagName") == "SELECT":
            values = changed.locator("option").evaluate_all("es => es.map(e => e.value)")
            old = changed.input_value()
            changed.select_option(next(value for value in values if value != old))
        else:
            changed.focus()
            old = changed.input_value()
            changed.press("ArrowRight")
            if changed.input_value() == old:
                changed.press("ArrowLeft")
        expect(p.get_by_text("设置已改变，下面仍是已记录结果", exact=True)).to_be_visible()
        p.get_by_role("button", name="运行并记录", exact=True).click()
        p.get_by_label("你观察到了什么？").fill(OBSERVATION + "第二次运行提供了新的对照。")
        expect(p.locator(".ws-record-bar")).to_contain_text("2 组不同设置")
        p.get_by_role("button", name="比较实验", exact=True).click()
        expect(p.locator(".ws-comparison tbody tr")).to_have_count(2)
        p.get_by_role("button", name="第 1 次", exact=True).click()
        expect(p.locator(".ws-result-title")).to_have_text(first_headline)
        expect(p.get_by_label("你观察到了什么？")).to_have_value(OBSERVATION)
        with p.expect_download() as download:
            p.get_by_role("button", name="导出数据", exact=True).click()
        data = json.loads(Path(download.value.path()).read_text())
        assert len(data) == 2 and data[0]["observation"] == OBSERVATION
        p.reload()
        expect(p.locator(".ws-record-bar")).to_contain_text("2 次运行")
        return {"runs": len(data), "distinct_settings": len({json.dumps(run["settings"], sort_keys=True) for run in data}),
                "observation_restored": OBSERVATION in json.dumps(data, ensure_ascii=False),
                "download": download.value.suggested_filename}

    def form_labels(self):
        unnamed = self.page.locator("input:not([type=hidden]), textarea, select").evaluate_all("""elements => elements.filter(e => {
            const hidden = !e.getClientRects().length;
            const named = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.labels?.length;
            return !hidden && !named;
        }).map(e => ({tag:e.tagName, type:e.type, id:e.id, placeholder:e.placeholder}))""")
        assert not unnamed, unnamed
        return "All visible fields have associated labels"

    def learning_cycle(self, course):
        p = self.page
        chapter = course["chapters"][0]
        self.tab("理解原理")
        for _ in range(5):
            p.get_by_role("button", name="记录已读，下一节", exact=True).click()
        p.get_by_role("button", name="记录本节已读", exact=True).click()
        expect(p.get_by_role("button", name="本节已记录", exact=True)).to_be_visible()
        self.tab("判断与迁移")
        submit = p.get_by_role("button", name="核对判断与理由", exact=True)
        expect(submit).to_be_disabled()
        for i, quiz in enumerate(chapter["quiz"]):
            p.locator(f'input[name="quiz-{chapter["id"]}-{i}"]').nth((quiz["answer"] + 1) % len(quiz["options"])).check()
        submit.click()
        expect(p.locator(".ws-quiz .ws-feedback.revisit")).to_have_count(2)
        for i, quiz in enumerate(chapter["quiz"]):
            p.locator(f'input[name="quiz-{chapter["id"]}-{i}"]').nth(quiz["answer"]).check()
        submit.click()
        expect(p.locator(".ws-quiz .ws-feedback.correct")).to_have_count(2)
        case = p.locator(f'input[name="case-{chapter["id"]}"]')
        case.nth((chapter["caseStudy"]["answer"] + 1) % case.count()).check()
        expect(p.locator(".ws-case-study .ws-feedback.revisit")).to_be_visible()
        case.nth(chapter["caseStudy"]["answer"]).check()
        expect(p.locator(".ws-case-study .ws-feedback.correct")).to_be_visible()
        self.tab("独立解释")
        explanation = p.get_by_label("用自己的话解释")
        explanation.fill("简短解释")
        p.get_by_role("button", name="展开对照要点", exact=True).click()
        for checkbox in p.locator(".ws-rubric input[type=checkbox]").all():
            checkbox.check()
        save = p.get_by_role("button", name="记录解释与自评", exact=True)
        expect(save).to_be_disabled()
        explanation.fill(REFLECTION)
        expect(p.locator(".ws-rubric input:checked")).to_have_count(0)
        for checkbox in p.locator(".ws-rubric input[type=checkbox]").all():
            checkbox.check()
        save.click()
        expect(p.get_by_role("button", name="已记录独立解释与自评", exact=True)).to_be_visible()
        p.reload()
        self.tab("独立解释")
        expect(explanation).to_have_value(REFLECTION)
        expect(p.get_by_role("button", name="已记录独立解释与自评", exact=True)).to_be_visible()
        return {"read": 6, "wrong_answers_corrected": 2, "case_corrected": True,
                "short_reflection_rejected": True, "reflection_restored": True}

    def exports(self, course_id):
        p = self.page
        p.get_by_role("button", name="资料与记录", exact=True).click()
        with p.expect_download() as report_download:
            p.get_by_role("button", name="导出学习报告", exact=True).click()
        report_text = Path(report_download.value.path()).read_text()
        assert REFLECTION in report_text, "Report omitted learner reflection"
        assert report_text.count("\n## ") == 12, "Report did not cover 12 chapters"
        with p.expect_download() as backup_download:
            p.get_by_role("button", name="备份进度", exact=True).click()
        backup_text = Path(backup_download.value.path()).read_text()
        backup = json.loads(backup_text)
        assert backup["course"] == course_id
        p.locator("input[type=file]").set_input_files({"name": "restore.json", "mimeType": "application/json", "buffer": backup_text.encode()})
        expect(p.get_by_text("本课进度已从文件恢复。", exact=True)).to_be_visible()
        p.locator("input[type=file]").set_input_files({"name": "invalid.json", "mimeType": "application/json", "buffer": b'{"course":"wrong","save":null}'})
        expect(p.get_by_text("文件不是当前课程的有效进度。", exact=True)).to_be_visible()
        p.get_by_role("button", name="关闭资料面板", exact=True).click()
        return {"report_bytes": len(report_text.encode()), "backup_bytes": len(backup_text.encode()), "valid_import": True, "invalid_import_rejected": True}

    def chapters(self, course):
        p = self.page
        headings = []
        nav = p.get_by_role("navigation", name="章节目录", exact=True)
        expect(nav.get_by_role("link")).to_have_count(12)
        for chapter in course["chapters"]:
            nav.get_by_role("link", name=re.compile(re.escape(chapter["title"]))).click()
            expect(p.locator(".ws-chapter-heading h1")).to_have_text(chapter["title"])
            if course["id"] != "harness":
                p.get_by_role("button", name="运行并记录", exact=True).click()
                expect(p.locator(".ws-result")).to_be_visible()
                assert "NaN" not in p.locator(".ws-result").inner_text()
            self.tab("理解原理")
            expect(p.locator(".ws-principle-index button")).to_have_count(6)
            self.tab("判断与迁移")
            expect(p.locator(".ws-quiz")).to_have_count(2)
            self.tab("动手与观察")
            headings.append(chapter["title"])
        return {"chapters": len(headings), "all_chapter_titles_matched": True, "default_numeric_runs": 12 if course["id"] != "harness" else 0}

    def damaged_storage(self):
        p = self.page
        key = "model-workshop-v2-finetune"
        original = p.evaluate("key => localStorage.getItem(key)", key)
        try:
            for value in ['{broken json', json.dumps({"version": 2, "current": 0, "chapters": {}})]:
                p.evaluate("([key,value]) => localStorage.setItem(key,value)", [key, value])
                self.course("finetune")
                expect(p.locator(".ws-storage-error")).to_be_visible()
                expect(p.get_by_role("button", name="运行并记录", exact=True)).to_be_visible()
                assert p.evaluate("key => localStorage.getItem(key)", key) == value, "Damaged record was silently overwritten"
            return {"non_json": "recovered", "invalid_schema": "recovered", "original_damaged_bytes_preserved": True}
        finally:
            p.evaluate("([key,value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key,value)", [key, original])

    def original_course(self):
        self.course("train")
        p = self.page
        expect(p.locator(".chapter-nav")).to_have_count(12)
        for tab in ["原理手册", "交互实验", "自测与复述"]:
            p.get_by_role("tab", name=re.compile(tab)).click()
            expect(p.get_by_role("tabpanel").filter(visible=True)).to_be_visible()
        for i in range(12):
            p.locator(".chapter-nav").nth(i).click()
            expect(p.locator(".chapter-heading h1")).not_to_be_empty()
        return "Original 12 chapters and all 3 learning tabs open"

    def overflow(self):
        sizes = self.page.evaluate("""() => ({viewport: innerWidth, document: document.documentElement.scrollWidth,
            offenders: [...document.querySelectorAll('body *')].filter(e => {
              const r=e.getBoundingClientRect(); const style=getComputedStyle(e);
              return r.width>0 && r.right>innerWidth+2 && style.position!=='fixed'
                && !e.closest('.ws-table-scroll');
            }).slice(0,12).map(e => ({tag:e.tagName, cls:e.className, width:Math.round(e.getBoundingClientRect().width)}))})""")
        assert sizes["document"] <= sizes["viewport"] + 2, sizes
        return sizes

    def keyboard(self):
        self.page.evaluate("document.activeElement?.blur()")
        reached = []
        for _ in range(18):
            self.page.keyboard.press("Tab")
            reached.append(self.page.evaluate("""() => { const e=document.activeElement; return {
                tag:e.tagName, label:e.getAttribute('aria-label')||e.textContent?.trim().slice(0,80),
                outline:getComputedStyle(e).outlineStyle, visible: !!(e.offsetWidth||e.offsetHeight||e.getClientRects().length)
            }}"""))
        assert any(item["tag"] in ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"] for item in reached), reached
        assert all(item["visible"] for item in reached), reached
        return reached

    def write_results(self):
        result = {"url": self.url, "tests": self.results, "browser_errors": self.errors,
                  "passed": sum(item["status"] == "passed" for item in self.results),
                  "failed": sum(item["status"] == "failed" for item in self.results)}
        (ROOT / "browser-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(json.dumps({"passed": result["passed"], "failed": result["failed"], "browser_errors": len(self.errors)}), flush=True)
        return result


def load_courses():
    with tempfile.TemporaryDirectory() as directory:
        for source in (ROOT.parent / "lib" / "workshop").glob("*.ts"):
            text = re.sub(r"from '(\./[^']+)'", r"from '\1.ts'", source.read_text())
            (Path(directory) / source.name).write_text(text)
        runner = Path(directory) / "manifest.mjs"
        runner.write_text("import {courses} from './courses.ts'; console.log(JSON.stringify(courses));")
        return json.loads(subprocess.check_output(["node", str(runner)], text=True))


def run(suite: Suite):
    courses = load_courses()
    suite.check("home-load", lambda: suite.page.goto(suite.url).status)
    suite.check("four-course-entry", lambda: expect(suite.page.locator(".ws-course-card")).to_have_count(4))
    suite.check("desktop-horizontal-layout", suite.overflow)
    suite.check("keyboard-focus", suite.keyboard)
    suite.screenshot("home-desktop")
    suite.page.set_viewport_size({"width": 360, "height": 800})
    suite.check("mobile-horizontal-layout", suite.overflow)
    suite.screenshot("home-mobile")
    suite.page.set_viewport_size({"width": 1440, "height": 1000})
    suite.check("original-course-regression", suite.original_course)
    for course in courses:
        name = course["id"]
        suite.course(name)
        if name != "harness":
            suite.check(f"{name}-experiment-records-compare-refresh-export", suite.numeric_experiment)
        suite.check(f"{name}-learning-cycle", lambda c=course: suite.learning_cycle(c))
        suite.check(f"{name}-exports-and-import", lambda name=name: suite.exports(name))
        suite.check(f"{name}-12-chapters", lambda c=course: suite.chapters(c))
        suite.check(f"{name}-desktop-layout", suite.overflow)
        suite.check(f"{name}-form-labels", suite.form_labels)
        suite.screenshot(f"{name}-desktop")
        suite.page.set_viewport_size({"width": 360, "height": 800})
        suite.check(f"{name}-mobile-layout", suite.overflow)
        suite.screenshot(f"{name}-mobile")
        suite.page.set_viewport_size({"width": 1440, "height": 1000})
    suite.check("damaged-storage-recovery", suite.damaged_storage)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:5173")
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    args = parser.parse_args()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium, headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True,
            reduced_motion="reduce", locale="zh-CN")
        page = context.new_page()
        page.set_default_timeout(7000)
        suite = Suite(page, args.url)
        try:
            run(suite)
        finally:
            result = suite.write_results()
            browser.close()
    return 1 if result["failed"] or result["browser_errors"] else 0


if __name__ == "__main__":
    sys.exit(main())

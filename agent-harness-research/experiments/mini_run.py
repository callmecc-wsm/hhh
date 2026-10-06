"""Actual upstream DefaultAgent + LocalEnvironment; scripted model, real shell/files.
Run with the research venv. No external model call or credentials required.
"""
import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from minisweagent.agents.default import DefaultAgent
from minisweagent.environments.local import LocalEnvironment
from minisweagent.models.test_models import DeterministicModel, make_output

OUT = Path(__file__).resolve().parents[1] / "evidence"
all_runs = []
for scenario in ["false_completion", "verified", "test_failure_ignored"]:
    with tempfile.TemporaryDirectory(prefix="harness-mini-") as work:
        wd = Path(work)
        (wd / "calc.py").write_text("def add(a, b):\n    return a - b\n")
        (wd / "test_calc.py").write_text("from calc import add\nassert add(2, 3) == 5\nprint('PASS: add(2,3) == 5')\n")
        commands = ["cat calc.py"]
        if scenario == "verified":
            commands += ["sed -i 's/a - b/a + b/' calc.py", f"{sys.executable} test_calc.py"]
        if scenario == "test_failure_ignored":
            commands += [f"{sys.executable} test_calc.py"]
        commands += ["printf 'COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT\\n完成了：加法已修复。\\n'"]
        requests, events = [], []

        class RecorderModel(DeterministicModel):
            def query(self, messages, **kw):
                requests.append(copy.deepcopy(messages))
                events.append({"type": "model_input", "round": len(requests), "messages": copy.deepcopy(messages)})
                result = super().query(messages, **kw)
                events.append({"type": "model_output", "round": len(requests), "message": copy.deepcopy(result)})
                return result

        class RecorderEnv(LocalEnvironment):
            def execute(self, action, *args, **kw):
                events.append({"type": "tool_start", "action": action})
                try:
                    result = super().execute(action, *args, **kw)
                    events.append({"type": "tool_result", "result": result, "artifact": (wd / "calc.py").read_text()})
                    return result
                except Exception as exc:
                    events.append({"type": "control_signal", "signal": type(exc).__name__, "artifact": (wd / "calc.py").read_text()})
                    raise

        model = RecorderModel(outputs=[make_output("执行下一步", [{"command": c}], cost=0) for c in commands], cost_per_call=0)
        agent = DefaultAgent(model, RecorderEnv(cwd=work), system_template="修复代码并验证。", instance_template="{{task}}", cost_limit=0, step_limit=10)
        result = agent.run("修复 add(2, 3) 返回错误的问题。")
        verification = subprocess.run([sys.executable, "test_calc.py"], cwd=work, text=True, capture_output=True)
        all_runs.append({"scenario": scenario, "kind": "real upstream harness; scripted model; real local commands", "events": events, "requests": requests, "trajectory": agent.serialize(), "run_result": result, "external_verification": {"returncode": verification.returncode, "stdout": verification.stdout, "stderr": verification.stderr}, "final_file": (wd / "calc.py").read_text()})
OUT.joinpath("mini-traces.json").write_text(json.dumps(all_runs, ensure_ascii=False, indent=2))
print(json.dumps([{k:r[k] for k in ['scenario','run_result','external_verification']} for r in all_runs],ensure_ascii=False,indent=2))

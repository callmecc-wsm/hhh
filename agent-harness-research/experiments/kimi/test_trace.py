"""Instrument actual KimiSoul; only the model provider and UI sink are controlled.
conftest.py is copied, unchanged, from the pinned upstream tests/conftest.py.
"""
import asyncio
import json
import subprocess
import sys
from pathlib import Path
import pytest
from kosong.chat_provider.mock import MockChatProvider, MockStreamedMessage
from kosong.message import TextPart, ToolCall, Message
from kimi_cli.llm import LLM
from kimi_cli.soul import run_soul
from kimi_cli.soul.agent import Agent
from kimi_cli.soul.context import Context
from kimi_cli.soul.compaction import SimpleCompaction, should_auto_compact
from kimi_cli.soul.kimisoul import KimiSoul
from kimi_cli.soul.toolset import KimiToolset
from kimi_cli.tools.shell import Shell
from kimi_cli.utils.aioqueue import QueueShutDown

OUT = Path(__file__).resolve().parents[2] / "evidence"

@pytest.mark.asyncio
async def test_real_kimi_false_completion(runtime, tmp_path):
    requests, events = [], []
    Path("calc.py").write_text("def add(a,b):\n    return a-b\n")
    Path("test_calc.py").write_text("from calc import add\nassert add(2,3)==5\n")

    class Recorder(MockChatProvider):
        async def generate(self, system_prompt, tools, history):
            requests.append({"system_prompt":system_prompt,"tools":[t.model_dump(mode='json') for t in tools],"history":[m.model_dump(mode='json') for m in history]})
            if len(requests)==1:
                return MockStreamedMessage([ToolCall(id="call_test",function=ToolCall.FunctionBody(name="Shell",arguments=json.dumps({"command":f"{sys.executable} test_calc.py"})))])
            return MockStreamedMessage([TextPart(text="完成了：加法已修复。")])

    runtime.llm = LLM(chat_provider=Recorder([]),max_context_size=100000,capabilities=set())
    toolset = KimiToolset()
    toolset.add(Shell(runtime.approval,runtime.environment,runtime))
    context = Context(tmp_path / "context.jsonl")
    soul = KimiSoul(Agent(name="Controlled experiment",system_prompt="修复 add；必须运行测试并确认通过。",toolset=toolset,runtime=runtime),context=context)
    async def ui(wire):
        q=wire.ui_side(merge=True)
        while True:
            try:
                e=await q.receive()
                events.append({"type":type(e).__name__,"data":e.model_dump(mode='json') if hasattr(e,'model_dump') else str(e)})
            except QueueShutDown:return
    await run_soul(soul,"修复 add(2,3)",ui,asyncio.Event())
    check=subprocess.run([sys.executable,'test_calc.py'],capture_output=True,text=True)
    data={"kind":"actual KimiSoul + KimiToolset + Shell; scripted provider; test fixture yolo=True", "requests":requests,"events":events,"context":[m.model_dump(mode='json') for m in context.history],"persisted":context.file_backend.read_text(),"external_verification":{"returncode":check.returncode,"stderr":check.stderr},"final_file":Path('calc.py').read_text()}
    OUT.joinpath('kimi-trace.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    assert len(requests)==2 and check.returncode==1
    assert context.history[-1].role=='assistant'

@pytest.mark.asyncio
async def test_compaction_and_context_revert(tmp_path):
    history=[Message(role='user',content='约束：不能改公开 API。'),Message(role='assistant',content='旧调查结果。'),Message(role='user',content='现在修复加法。'),Message(role='assistant',content='准备执行。')]
    prepared=SimpleCompaction().prepare(history)
    ctx=Context(tmp_path/'checkpoint.jsonl')
    await ctx.append_message(history[0]); await ctx.checkpoint(False)
    file=tmp_path/'actual-file.txt';file.write_text('after edit')
    await ctx.append_message(history[1]); await ctx.revert_to(0)
    restored=Context(ctx.file_backend); await restored.restore()
    data={"kind":"actual upstream functions, no summarization LLM called","thresholds":[{"tokens":n,"compact":should_auto_compact(n,1000,trigger_ratio=.8,reserved_context_size=300)} for n in [699,700,799,800]],"before":[x.model_dump(mode='json') for x in history],"summary_request":prepared.compact_message.model_dump(mode='json'),"preserved":[x.model_dump(mode='json') for x in prepared.to_preserve],"reverted_history":[x.model_dump(mode='json') for x in restored.history],"file_after_revert":file.read_text()}
    OUT.joinpath('kimi-compaction.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    assert file.read_text()=='after edit' and len(restored.history)==1

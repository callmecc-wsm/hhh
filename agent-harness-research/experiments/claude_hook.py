"""Run only the public Ralph Stop hook, not Claude Code's proprietary loop."""
import json, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
hook=ROOT/'repos/claude-code/plugins/ralph-wiggum/hooks/stop-hook.sh'
results=[]
for label, text, iteration in [('continue','完成了，但没有 promise 标记。',1),('promise','<promise>DONE</promise>',1),('limit','还没完成。',3)]:
    with tempfile.TemporaryDirectory(prefix='harness-hook-') as d:
        wd=Path(d);(wd/'.claude').mkdir()
        state=wd/'.claude/ralph-loop.local.md'
        state.write_text(f'---\niteration: {iteration}\nmax_iterations: 3\ncompletion_promise: "DONE"\n---\n修复加法并通过测试。\n')
        transcript=wd/'transcript.jsonl';transcript.write_text(json.dumps({'role':'assistant','message':{'content':[{'type':'text','text':text}]}},separators=(',',':'))+'\n')
        r=subprocess.run(['bash',str(hook)],input=json.dumps({'transcript_path':str(transcript)}),cwd=d,capture_output=True,text=True)
        results.append({'scenario':label,'model_text':text,'returncode':r.returncode,'stdout':r.stdout,'stderr':r.stderr,'state_exists_after':state.exists(),'verification_run_by_hook':False})
(ROOT/'evidence/claude-hook.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(json.dumps(results,ensure_ascii=False,indent=2))

import json, shutil, os
from pathlib import Path
from content import HARNESS, TOPICS, FUTURE

ROOT=Path(__file__).parent
def read(name):return json.loads((ROOT/'evidence'/name).read_text())
SOURCES=read('sources.json');ids={x['id'] for x in SOURCES}
for t in TOPICS:
    for row in t['rows'].values():
        assert set(row['refs'])<=ids,(t['id'],row)
def event(kind,title,why,raw,request=None,refs=None,artifact=None):
    return dict(kind=kind,title=title,why=why,raw=raw,request=request,refs=refs or [],artifact=artifact)
traces=[]
for run in read('mini-traces.json'):
    names={'verified':'修复并验证','false_completion':'直接声称完成','test_failure_ignored':'忽略失败的测试'}
    events=[];request=None;artifact='def add(a, b):\n    return a - b\n'
    for e in run['events']:
        k=e['type']
        if k=='model_input':
            request={'messages':e['messages'],'tools':[],'note':'测试用 DeterministicModel 接口输入；不是外部 API payload。'}
            title=f"第 {e['round']} 次模型输入";why='把当前完整 messages 交给模型。上一轮工具观察若已追加，就会出现在这一次输入里。';refs=['mi-loop']
        elif k=='model_output':
            title='模型提出动作';why='这里是预设的模型响应。Harness 尚未执行命令，assistant 文本不能证明动作发生。';refs=['mi-loop']
        elif k=='tool_start':
            title='执行真实 shell';why='LocalEnvironment 启动本地子进程。此配置没有额外 OS sandbox，cwd 是独立临时目录。';refs=['mi-exec','mi-shell']
        elif k=='tool_result':
            title='工具返回观察';why='退出码与输出回注为新消息。非零退出码是模型可以看到的失败事实，不会自动使用户目标永久失败或强制修复。';refs=['mi-exec'];artifact=e['artifact']
        else:
            title='捕获 Submitted，结束循环';why='当前命令 stdout 首行命中提交标记且命令退出码为 0。检查的是提交命令，不是 test_calc.py。';refs=['mi-stop'];artifact=e['artifact']
        events.append(event(k,title,why,e,request,refs,artifact))
    v=run['external_verification'];events.append(event('verify','独立验收 '+('通过' if v['returncode']==0 else '失败'),'这一步由研究脚本在 Agent.run 返回后执行，不属于原 Harness 的自动停止门槛。',v,request,['mi-stop'],artifact))
    traces.append(dict(id='mini-'+run['scenario'],name='mini · '+names[run['scenario']],harness='mini',scope='真实 DefaultAgent + 真实 shell/文件；模型响应预设。',result=run['run_result']['exit_status'],verified=v['returncode']==0,events=events,persistence='实验末尾导出轨迹 JSON。此 run 未配置 DefaultAgent.output_path，不声称每步已落盘。'))

k=read('kimi-trace.json');events=[];request=None
for e in k['events']:
    typ=e['type'];d=e['data']
    if typ=='StatusUpdate':continue
    if typ=='StepBegin':
        n=d['n'];r=k['requests'][n-1];request={'system_prompt':r['system_prompt'],'tools':r['tools'],'messages':r['history']}
        events.append(event('model_input',f'第 {n} 次模型输入','直接在 provider.generate 边界记录；system、tools 与 history 分开。',r,request,['ki-step']))
    else:
        mapping={'TurnBegin':('input','打开 Turn','用户输入进入 Soul。'), 'ToolCall':('model_output','模型请求 Shell','tool name、arguments、call id 来自预设 provider。'), 'ToolResult':('tool_result','真实测试返回错误','Kimi 的 Shell 已执行真实 Python 测试，结果 is_error=true。'), 'TextPart':('model_output','模型声称完成','第二次请求已经包含失败观察，但脚本模型仍给出终结文本。'), 'TurnEnd':('control_signal','本轮正常结束','无 tool calls 路径可以结束；这里并没有运行成功验收门槛。')}
        if typ in mapping:
            kind,title,why=mapping[typ];events.append(event(kind,title,why,e,request,['ki-shell','ki-stop'],k['final_file']))
events.append(event('verify','独立验收失败','Agent 返回后再运行真实 test_calc.py，错误依旧。',k['external_verification'],request,['ki-stop'],k['final_file']))
traces.append(dict(id='kimi',name='Kimi · 失败后仍结束',harness='kimi',scope=k['kind'],result='TurnEnd / no_tool_calls 路径',verified=False,events=events,persistence='真实 Context JSONL 已导出；界面只显示录制结果，不在浏览器执行 shell。'))

d=read('deepseek-trace.json');events=[];request=None;step=0
for e in d['events']:
    typ=e['type'];data=e['data']
    if typ=='step/start':
        step=data['step'];r=d['requests'][step-1];request=r
    kinds={'turn/start':'input','step/start':'context','system/message':'context','user/message':'context','request/header':'context','request/context':'context','assistant/message':'model_output','tool/call':'tool_start','tool/result':'tool_result','step/end':'state','turn/end':'control_signal'}
    if typ not in kinds:continue
    descriptions={'request/header':'工具 schema 与模型路由作为 request header 记录。','assistant/message':'完整 assistant stream 结算为一条事件。失败尝试另记为 assistant/attempt。','tool/result':'verify 是受控工具，返回 FAIL 文本；本测试未执行真实 shell。','turn/end':'reason.kind=completed 表示控制循环结束；并没有把 FAIL 自动转换成阻止交付。','step/start':'开始下一步；右侧请求来自 MockAdapter 实际接收的冻结对象。'}
    events.append(event(kinds[typ],typ,descriptions.get(typ,'这是实际 SessionEvent，按日志序号展示；不是重画的假日志。'),e,request,['ds-loop','ds-request','ds-stop']))
traces.append(dict(id='deepseek',name='DeepSeek · 事件如何变成请求',harness='deepseek',scope=d['kind'],result='turn/end: completed',verified=None,events=events,persistence='该实验装配内存 SessionStore，未挂载文件 persistence 插件；事件在实验末尾导出 JSON。'))

DATA=dict(harnesses=HARNESS,topics=TOPICS,future=FUTURE,sources=SOURCES,traces=traces,revisions=read('revisions.json'),experiments={
 'kimi':read('kimi-compaction.json'),'gemini':read('gemini-collapse.json'),'claude':read('claude-hook.json'),'git':read('git-worktree.json')},meta={'date':'2026-10-05','sourceCount':len(SOURCES),'tests':['Kimi 上游：63 passed','DeepSeek 上游：103 passed','Kimi 自建因果实验：2 passed','DeepSeek 自建 trace：1 passed'],'limitations':['无线上模型调用、无模型排名、无误完成率统计。','Codex 与 OpenCode 未运行完整核心；Gemini 为函数级执行。','Claude Code 私有循环和各家 Cloud 控制面没有假装可见。','Anthropic 多个官方文档/工程文章 URL 在本环境返回 HTTP 403；相关结论改用可获取的官方公开源码与 changelog。','源码取自获取时的各仓库 HEAD 并固定 SHA，不宣称这些 HEAD 都是稳定发行版。','独立临时目录不是 sandbox；测试中真实命令只作用于实验目录。']})
template=(ROOT/'site/template.html').read_text()
template=template.replace('/*__CSS__*/',(ROOT/'site/style.css').read_text()).replace('/*__JS__*/',(ROOT/'site/app.js').read_text())
html=template.replace('/*__DATA__*/',json.dumps(DATA,ensure_ascii=False).replace('</','<\\/'))
site=ROOT/'dist';site.mkdir(exist_ok=True)
(site/'index.html').write_text(html)
if os.environ.get('LAB_INSTALL_DIR'):
    target=Path(os.environ['LAB_INSTALL_DIR']);target.mkdir(parents=True,exist_ok=True)
    shutil.copy2(site/'index.html',target/'index.html')
(ROOT/'evidence/research-data.json').write_text(json.dumps(DATA,ensure_ascii=False,indent=2))
print(f'{len(html.encode())} bytes; {len(TOPICS)} mechanisms; {len(traces)} traces')

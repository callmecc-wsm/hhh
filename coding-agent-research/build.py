from pathlib import Path
import markdown,re,html,json,base64

ROOT=Path(__file__).parent
raw=(ROOT/'research.md').read_text()
parts=re.split(r'^## (.+)$',raw,flags=re.M)
sections={parts[i]:parts[i+1] for i in range(1,len(parts),2)}

def md(s):
 out=markdown.markdown(s,extensions=['tables','fenced_code'])
 out=re.sub(r'\[S(\d+)\]',r'<a class="cite" href="#source-\1" aria-label="查看来源 S\1">[\1]</a>',out)
 out=re.sub(r'<table>', '<div class="table-scroll" tabindex="0"><table>',out).replace('</table>','</table></div>')
 return out

def detail(title,key,opened=False):
 return '<details class="deep"'+(' open' if opened else '')+'><summary>'+title+'</summary><div class="detail-body">'+md(sections[key])+'</div></details>'

objects=[]
for line in sections['19 个对象：哪些特殊，哪些只是工程做得更早'].splitlines():
 if line.startswith('|'):
  cols=[x.strip() for x in line.strip('|').split('|')]
  if len(cols)==3 and cols[1] in ['A','B','C']:objects.append(cols)
qs=[]
for line in sections['十个问题，明确作答'].splitlines():
 if line.startswith('|'):
  cols=[x.strip() for x in line.strip('|').split('|')]
  if len(cols)==3 and cols[0] not in ['问题','---']:qs.append(cols)

intro=parts[0].split('\n',1)[1]
sources=md(sections['证据索引与研究边界'])
sources=re.sub(r'<strong>S(\d+)</strong>',r'<strong id="source-\1">S\1</strong>',sources)

task_table=sections['先理解任务，才能理解产品']
task_table=task_table[task_table.index('| 任务结构'):task_table.index('**关键因果')]

object_rows=''.join('<tr data-category="'+c+'"><td>'+html.escape(n)+'</td><td><span class="tag '+c+'">'+c+'</span></td><td>'+html.escape(t)+'</td></tr>' for n,c,t in objects)
question_rows=''.join('<details class="question"><summary><span>'+html.escape(q)+'</span>'+markdown.markdown(a).removeprefix('<p>').removesuffix('</p>')+'</summary><p>'+html.escape(why)+'</p></details>' for q,a,why in qs)

content=f'''
<section id="judgment" class="hero">
<p class="dateline">研究截至 2026 年 10 月 5 日　｜　预测至 2030 年</p>
<h1>Coding Agent<br>会被通用 Agent 吞并吗？</h1>
<p class="thesis">专业产品会留下。<br><span>通用入口会融合，</span><span>工程责任会分层。</span></p>
<p>未来 2～4 年，“帮你写代码”的独立产品会收缩。能理解既有系统、验证变更、控制上线并持续维护的专业平台，会继续被工程团队单独评估和采购。</p>
<div class="layers" aria-label="未来产品结构示意">
 <div class="layer intent"><b>通用工作入口</b><span>目标 · 业务上下文 · 跨工具协作</span></div>
 <div class="connector">向下委派目标，向上交付证据</div>
 <div class="layer shared"><b>共享执行底座</b><span>规划 · 记忆 · 调度 · 沙箱 · 权限</span></div>
 <div class="specialties"><div class="layer software"><b>软件工程执行层</b><span>程序语义 · 测试 · 集成 · 发布</span></div><div class="layer other"><b>其他领域执行层</b><span>财务 · 设计 · 研究 · 运营</span></div></div>
</div>
<p class="caption">结构预测：独立的专业类别，不要求独立聊天框、独立模型或独立公司。</p>
</section>

<section id="structure">
<h2>先看任务的结构</h2>
<p class="lead">决定自治程度的，是状态能否隔离、结果能否验证、后果能否恢复。</p>
<p>Coding 是工作领域，Work 是任务范围，Computer Use 是操作方式。三者不在同一条分类轴上。</p>
{md(task_table)}
<div class="causal"><b>可复制的环境</b><span>→</span><b>低成本试错</b><span>→</span><b>执行式反馈</b><span>→</span><b>持续修正</b></div>
<p>软件经常具备这条反馈链，因此先成为 Agent 的训练场。通用工作也会采用同样的方法。</p>
<p class="callout">“测试稳定通过”只说明这些断言成立。它不等于全部需求正确，更不等于上线安全。财务对账有时比前端交互需求更确定。</p>
{detail('展开任务结构的完整推理','先理解任务，才能理解产品')}
</section>

<section id="objects">
<h2>19 个对象，多数是通用系统问题</h2>
<div class="classification"><div><span class="tag A">A</span><b>软件语义</b><p>源码、类型与可执行行为的对应关系；其他对象里的软件专用机制。</p></div><div><span class="tag B">B</span><b>通用约束</b><p>状态、并行、验证、权限、恢复与长任务。软件工程把它们做得更早。</p></div><div><span class="tag C">C</span><b>可替换的包装</b><p>Git 协议与操作、PR 页面。界面能隐藏，其治理作用仍需保留。</p></div></div>
<p>专业产品不需要“每项机制都独有”。一组高密度、相互耦合的机制，就能形成专业系统。</p>
<details class="deep"><summary>逐项查看 19 个对象的判断</summary><div class="detail-body">
<div class="filter" aria-label="筛选分类"><button class="selected" data-filter="all" aria-pressed="true">全部 19</button><button data-filter="A" aria-pressed="false">A 软件语义 1</button><button data-filter="B" aria-pressed="false">B 通用约束 16</button><button data-filter="C" aria-pressed="false">C 历史包装 2</button></div>
<p class="caption">按底层问题给一个主类；行内保留次级语义。A 的专用机制也存在于多个 B 类对象中。</p>
<div class="table-scroll" tabindex="0"><table id="object-table"><thead><tr><th>对象</th><th>主类</th><th>保留与迁移</th></tr></thead><tbody>{object_rows}</tbody></table></div>
<p>Git 与 PR 既是历史包装，也是当前互操作和组织治理协议。预测期内，隐藏操作比替换整个生态更经济。</p>
</div></details>
</section>

<section id="case">
<h2>同一个 Bug，不同的是固定了多少坐标</h2>
<p class="lead">真实任务：Astropy 的嵌套模型误判了变量依赖。</p>
<p>两个独立线性模型，直接组合正确；嵌套后却被报告为相互依赖。原始 <a href="https://github.com/astropy/astropy/issues/12906">Issue #12906</a> 与 <a href="https://github.com/astropy/astropy/pull/12907/files">修复 #12907</a> 可查。</p>
<div class="bug-demo"><div><small>应该保留的独立关系</small><div class="matrix" aria-label="对角为真，非对角为假"><i>1</i><i class="zero">0</i><i class="zero">0</i><i>1</i></div></div><div class="bug-text">只改变组合的嵌套方式<br><b>独立关系不应改变</b></div><div><small>Bug 错误报告的关系</small><div class="matrix wrong" aria-label="四项全为真"><i>1</i><i>1</i><i>1</i><i>1</i></div></div></div>
<p class="caption">简化显示完整结果矩阵右下方 2×2 部分。1 表示依赖，0 表示独立。</p>
<div class="step-tabs" role="group" aria-label="选择任务阶段"><button data-step="0" class="selected" aria-pressed="true">接任务</button><button data-step="1" aria-pressed="false">建环境</button><button data-step="2" aria-pressed="false">改与验</button><button data-step="3" aria-pressed="false">交付</button></div>
<div class="case-grid" aria-live="polite"><div><h3>已配置 Coding Harness</h3><p id="coding-state"></p></div><div><h3>尚未配置工程适配的通用 Agent</h3><p id="general-state"></p></div></div>
<p class="caption">同模型、同预算、同工具授权下的机制推演；未实际运行两款产品做对照实验。</p>
<div class="state-line"><b>有效工作状态</b><span>源码快照</span><span>依赖与工具链</span><span>验证条件</span><span>外部状态</span><span>授权范围</span></div>
<p>通用 Agent 加载相同工程适配后，两条路线会收敛。<b>这证明适配可复用，没有证明适配可省去。</b></p>
{detail('展开真实任务与状态空间分析','一次真实任务：状态空间到底差在哪里')}
</section>

<section id="chain">
<h2>Agent 接手链条，人定义生效条件</h2>
<div class="chain"><div><b>目标</b><span>需求与约束</span></div><div><b>计划</b><span>定位与分解</span></div><div><b>实现</b><span>修改 ⇄ 测试</span></div><div><b>集成</b><span>审查 ⇄ CI</span></div><div><b>发布</b><span>灰度与部署</span></div><div><b>运行</b><span>观察与恢复</span></div></div>
<div class="chain-gates"><span>人：定义目标、预算、验收</span><span>策略：证据、权限、风险额度</span><span>反馈：回到计划和修复</span></div>
<p class="lead">全链路执行会成为标准能力。全链路授权仍由组织决定。</p>
<p>人不必手拆每个改动，但必须划分责任。Agent 可生成执行计划；它不能凭空决定公司愿意牺牲多少兼容性、收入和维护成本。</p>
<p class="callout">生成越来越便宜后，瓶颈移向验证、集成与上线。应比较“一个被接受且在线上成立的变更总成本”，包括人工审查、返工与故障。</p>
{detail('展开三个闭环、长任务机制与成本约束','软件生产链：人的工作向哪里移动')}
<h3 class="subheading">你提出的十个问题</h3>
<div class="questions">{question_rows}</div>
<div class="contract"><h3>两层之间，交付一份“变更契约”</h3><p><b>输入：</b>基线、目标、限制、预算与权限。</p><p><b>输出：</b>变更、可复现验证、已知风险、上线与恢复条件。</p><p>通用 Agent 不必理解每个工程细节，必须能请求、检查并持续追踪这份契约。</p></div>
</section>

<section id="bets">
<h2>公司下注的，是不同的控制位置</h2>
<p>模型能力会扩散。更持久的位置，来自掌握目标、运行环境、变更记录或验证证据。</p>
<div class="bet-map">
<div><h3>先掌握用户目标</h3><p><b>OpenAI、Anthropic、TRAE、通用 Work Agent</b></p><p>从通用上下文调度软件能力；Coding 同时是通向数字工作的入口。</p><span>成立条件：跨工具工作不丢失状态、权限和工程深度。</span></div>
<div><h3>先掌握软件交付</h3><p><b>Cursor、Cognition</b></p><p>从项目、代码、环境走向持续的软件生产；专业深度支撑独立采购。</p><span>成立条件：模型趋同时，仍能降低验证、集成和运行成本。</span></div>
<div><h3>先掌握协作与准入</h3><p><b>GitHub Copilot</b></p><p>让不同 Agent 都进入企业已有的代码、检查、权限与合并体系。</p><span>成立条件：软件变更仍需要共同的记录与治理平台。</span></div>
<div><h3>先控制执行环境，或开放它</h3><p><b>Replit、Google、OpenHands / Cline</b></p><p>Replit 把创建与运行连起来；Google 多入口分发；开放路线把模型、界面与执行拆开。</p><span>这是三条不同路线，分别押注环境控制、分发与可替换性。</span></div>
</div>
<p class="caption">战略地图为研究推断，不是内部路线图。每家公司会占据多个位置，图示突出其最有解释力的选择。</p>
{detail('逐家公司展开：事实、下注与成立条件','每家公司真正押注什么')}
</section>

<section id="evolution">
<h2>入口逐渐合并，约束继续存在</h2>
<p>切换年份，观察能力向通用层迁移。以下为方向性预测，不表示测得的市场份额。</p>
<div class="year-tabs" role="group" aria-label="演化年份"><button data-year="2026" class="selected" aria-pressed="true">2026 <small>观察</small></button><button data-year="2027" aria-pressed="false">2027 <small>预测</small></button><button data-year="2028" aria-pressed="false">2028 <small>预测</small></button><button data-year="2030" aria-pressed="false">2030 <small>预测</small></button></div>
<div class="evolution-grid" aria-live="polite"><div><h3>人看到的入口</h3><p id="year-entry"></p></div><div><h3>通用执行底座</h3><p id="year-common"></p></div><div class="persist"><h3>仍需软件特化</h3><p>程序语义、工具链、变更集成、测试适用性、发布兼容与生产反馈。</p></div></div>
<p id="year-role" class="year-role"></p>
<p>repo 会从顶层任务单位，变成 Project 内的工程材料与治理边界。IDE 变成按需打开的检查与调试视图。Git、PR、CI 很可能仍在系统下面工作。</p>
{detail('展开 2026→2030 产品形态与迁移清单','2026 → 2030：迁移的是能力，留下的是约束')}
</section>

<section id="forks">
<h2>改变约束，自治边界就会移动</h2>
<p>这个模拟只表达因果，不预测概率。选择任务的两个条件：</p>
<div class="scenario-controls"><label>验收条件<select id="verification"><option value="clear">可独立、可重复地验证</option><option value="weak">模糊或主要依赖主观判断</option></select></label><label>外部后果<select id="consequence"><option value="low">可隔离，失败容易恢复</option><option value="high">触及共享生产状态，恢复困难</option></select></label></div>
<div class="scenario-output" aria-live="polite"><h3 id="scenario-title"></h3><p id="scenario-cause"></p><p id="scenario-product"></p></div>
<p class="lead">最大的反方：专业能力仍存在，但已便宜到不足以支撑独立产品。</p>
<p>如果通用平台仅靠可替换的标准组件，就能在真实企业中达到相同交付质量与总成本，企业还普遍取消独立工程 Agent 采购，那么本研究的主判断就被推翻。</p>
{detail('展开可证伪标准与关键分叉','什么会推翻这个判断')}
</section>

<section id="evidence">
<h2>事实与预测分开阅读</h2>
<p>这份研究使用 23 组证据，关键结论依据官方路线、工程材料、开源实现、原始 Issue 和独立实验。公司“下注”与未来形态是分析推断。</p>
<p>没有进行跨产品效果实测；没有用搜索摘要或厂商自报效率给产品排名。真实 Issue 的双路线展示是机制推演。</p>
<details class="deep" id="sources-details"><summary>查看全部来源、日期和证据边界</summary><div class="detail-body sources">{sources}</div></details>
<div class="downloads"><a href="data:text/markdown;base64,{base64.b64encode(raw.encode()).decode()}" download="coding-agent-research.md">下载完整文字稿</a><button id="print">打印 / 保存 PDF</button></div>
<p class="caption">交互页为单文件，无外部脚本依赖，可离线打开。深入推理可展开查看，完整文字稿已嵌入下载链接。</p>
</section>
'''

css='''
:root{--ink:#18283c;--muted:#53677d;--paper:#fff;--canvas:#f3f6fa;--line:#dce3ec;--blue:#2d5295;--teal:#087e83;--copper:#9c5125;--purple:#664bb3}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:28px}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.85 "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif}a{color:var(--blue);text-underline-offset:3px}button,select{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,summary:focus-visible,select:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--teal);outline-offset:4px}button{border:1px solid var(--line);background:white;color:var(--ink);padding:7px 14px;border-radius:6px}button.selected{background:var(--blue);border-color:var(--blue);color:white}button:hover{border-color:var(--blue)}p{margin:14px 0}b,strong{font-weight:650}h1,h2,h3{line-height:1.35}h1{font-size:46px;letter-spacing:-1.5px;margin:26px 0 24px;max-width:900px}h2{font-size:29px;letter-spacing:-.5px;margin:0 0 24px}h3{font-size:18px;margin:0 0 14px}main{width:min(990px,calc(100% - 300px));margin:0 50px 0 245px}section{padding:65px 0;border-bottom:1px solid var(--line);scroll-margin-top:20px}section.hero{padding-top:65px}section>p{max-width:800px}.dateline,.caption{font-size:13px;color:var(--muted)}.thesis{font-size:28px;font-weight:600;line-height:1.6;letter-spacing:-.5px;margin:0 0 22px}.lead{font-size:20px;line-height:1.7;font-weight:550}.sidebar{position:fixed;left:0;top:0;height:100vh;width:205px;background:var(--canvas);padding:36px 22px;display:flex;flex-direction:column;border-right:1px solid var(--line)}.sidebar .brand{font-size:18px;font-weight:700;line-height:1.5;margin:0 0 32px}.sidebar nav{display:grid;gap:9px}.sidebar a{text-decoration:none;font-size:14px;color:var(--muted);padding:6px 9px;border-left:3px solid transparent}.sidebar a.active{color:var(--blue);border-color:var(--blue);background:#e8eef8}.sidebar .bottom{margin-top:auto;font-size:12px;line-height:1.7;color:var(--muted)}.layers{margin-top:32px;display:grid;gap:8px}.layer{border-radius:7px;padding:18px 22px;display:flex;justify-content:space-between;align-items:center;gap:18px}.layer b{font-size:18px;white-space:nowrap}.layer span{font-size:14px}.layer.intent{background:#e5edf9;color:#214681}.layer.shared{background:#dff1ef;color:#08656a}.layer.software{background:#2d5295;color:#fff;flex-direction:column;align-items:start;gap:7px}.layer.other{background:var(--canvas);color:var(--muted);flex-direction:column;align-items:start;gap:7px}.specialties{display:grid;grid-template-columns:1fr 1fr;gap:8px}.connector{text-align:center;color:var(--muted);font-size:12px;line-height:1.5;padding:2px}.table-scroll{overflow:auto;margin:25px 0;border-top:2px solid #a9b8cc}table{border-collapse:collapse;font-size:14px;width:100%;line-height:1.8}th,td{padding:13px 15px;vertical-align:top;text-align:left;border-bottom:1px solid var(--line)}th{font-size:13px;color:var(--muted);background:var(--canvas);font-weight:650}td:first-child{font-weight:550;min-width:112px}td p{margin:0}.causal{display:flex;align-items:center;gap:16px;padding:22px 0;flex-wrap:wrap;color:var(--teal);font-size:16px}.causal span{color:#8da2b8}.callout{border-left:4px solid var(--teal);background:#f0f8f7;padding:18px 22px;font-size:16px}.deep{margin:25px 0;border:1px solid var(--line);border-radius:7px;overflow:hidden}.deep>summary{padding:15px 20px;background:var(--canvas);font-weight:600;cursor:pointer;font-size:15px}.deep[open]>summary{border-bottom:1px solid var(--line)}.detail-body{padding:9px 23px 23px;font-size:15px}.detail-body>.table-scroll{margin:18px -8px}.cite{font-size:12px;text-decoration:none;vertical-align:super;margin-left:3px}.classification{display:grid;grid-template-columns:1fr 1.3fr 1fr;gap:24px;padding:22px 0}.classification b{margin-left:9px;font-size:18px}.classification p{font-size:15px;color:var(--muted);margin-top:12px}.tag{display:inline-flex;width:30px;height:30px;justify-content:center;align-items:center;border-radius:50%;font-size:14px;font-weight:700}.tag.A{color:var(--purple);background:#efebfa}.tag.B{color:var(--teal);background:#e4f3f2}.tag.C{color:var(--copper);background:#faf0e9}.filter{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.filter button{font-size:13px;padding:5px 10px}#object-table td:first-child{min-width:175px;font-size:13px}#object-table td:last-child{min-width:280px}.bug-demo{display:grid;grid-template-columns:1fr 1.2fr 1fr;align-items:center;gap:20px;background:var(--canvas);padding:26px;text-align:center}.bug-demo small{font-size:13px;color:var(--muted)}.matrix{width:114px;margin:15px auto 0;display:grid;grid-template-columns:1fr 1fr;gap:5px}.matrix i{font-style:normal;background:var(--blue);color:white;line-height:44px;border-radius:3px}.matrix i.zero{background:#e3e9f2;color:#53677d}.matrix.wrong i{background:#9c5125}.bug-text{font-size:15px}.step-tabs,.year-tabs{display:flex;gap:6px;margin:27px 0 15px;flex-wrap:wrap}.step-tabs button{font-size:14px}.case-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;min-height:168px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:23px 0}.case-grid p{font-size:15px;margin-bottom:0}.case-grid h3{font-size:16px;color:var(--blue)}.state-line{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:27px 0}.state-line>b{font-size:14px;margin-right:7px}.state-line>span{background:var(--canvas);padding:5px 10px;border:1px solid var(--line);font-size:13px;border-radius:4px}.chain{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid var(--line);margin-top:30px;border-radius:8px;overflow:hidden}.chain>div{position:relative;padding:21px 8px 18px;text-align:center;background:var(--canvas);border-right:1px solid var(--line)}.chain>div:nth-child(n+3){background:#e9eff9}.chain b{display:block;font-size:17px}.chain span{display:block;font-size:12px;color:var(--muted);margin-top:6px}.chain-gates{display:flex;gap:20px;justify-content:space-between;color:var(--muted);font-size:12px;line-height:1.6;margin:14px 0 30px}.subheading{font-size:22px;margin:40px 0 20px}.question{border-bottom:1px solid var(--line);padding:17px 0}.question>summary{display:block;cursor:pointer;font-size:15px;line-height:1.85;padding-right:25px;position:relative}.question>summary:after{content:'+';position:absolute;right:3px;top:0;color:var(--blue);font-size:23px}.question[open]>summary:after{content:'−'}.question>summary>span{display:block;font-size:17px;font-weight:600;margin-bottom:5px}.question summary strong{font-weight:500;color:var(--blue)}.question p{font-size:14px;color:var(--muted);border-left:2px solid var(--line);padding-left:15px}.bet-map{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line);border-left:1px solid var(--line);margin:25px 0}.bet-map>div{padding:24px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.bet-map h3{color:var(--blue);font-size:20px}.bet-map p{font-size:15px;margin:12px 0}.bet-map span{display:block;color:var(--muted);font-size:13px;line-height:1.8}.year-tabs button{flex:1;font-size:22px;padding:12px 7px}.year-tabs small{font-size:12px;margin-left:8px}.evolution-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:21px 0}.evolution-grid>div{padding:23px 18px;background:var(--canvas);border-top:3px solid #a5b8d3;min-height:198px}.evolution-grid h3{font-size:16px}.evolution-grid p{font-size:15px;margin-bottom:0}.evolution-grid .persist{background:#e7eef9;border-color:var(--blue)}.year-role{padding:15px 18px;background:#edf7f6;color:#0c696e;font-size:15px}.scenario-controls{display:grid;grid-template-columns:1fr 1fr;gap:25px;padding:20px 0}.scenario-controls label{font-size:14px;font-weight:600}.scenario-controls select{display:block;width:100%;margin-top:8px;padding:12px 30px 12px 12px;border:1px solid #b7c6d8;border-radius:6px;background:white;color:var(--ink);font-size:14px}.scenario-output{padding:25px;background:var(--canvas);border-left:4px solid var(--blue);margin:12px 0 30px;min-height:210px}.scenario-output h3{font-size:21px}.scenario-output p{font-size:15px}#scenario-product{color:var(--blue)}.sources li{margin-bottom:17px;font-size:13px;overflow-wrap:anywhere}.sources ul{padding-left:21px}.downloads{display:flex;gap:14px;align-items:center;margin-top:28px;font-size:14px}.downloads>a{padding:7px 0}.detail-body code,td code{font-size:.9em;white-space:normal;word-break:break-word}.detail-body p>code{background:var(--canvas);display:inline-block;padding:6px 10px}footer{font-size:12px;color:var(--muted);padding:30px 0 50px}body:has(#sources-details[open]) .sources{scroll-margin-top:40px}
.thesis>span{display:inline-block}.contract{margin-top:30px;padding:23px 25px;background:#eaf1fb;border-left:4px solid var(--blue)}.contract p{font-size:15px;margin:9px 0}
@media(min-width:1450px){main{margin-left:calc(50% - 435px)}}
@media(max-width:1000px){.sidebar{width:180px;padding:25px 15px}main{width:calc(100% - 220px);margin-left:200px;margin-right:20px}h1{font-size:39px}.classification{gap:15px;grid-template-columns:1fr}.classification p{margin:5px 0 13px}.chain{grid-template-columns:repeat(3,1fr)}.chain>div{border-bottom:1px solid var(--line)}.evolution-grid{grid-template-columns:1fr}.evolution-grid>div{min-height:unset}.bet-map>div{padding:18px}.case-grid{gap:17px}.layer{flex-direction:column;align-items:start;gap:4px}.bug-demo{padding:20px 10px;gap:6px}.bug-text{font-size:13px}.year-tabs small{display:block;margin:0}}
@media(max-width:700px){html{scroll-padding-top:10px}.sidebar{position:relative;width:100%;height:auto;padding:17px 20px;border-right:0;border-bottom:1px solid var(--line)}.sidebar .brand{margin:0 0 12px;font-size:16px}.sidebar nav{display:flex;gap:7px;overflow:auto;white-space:nowrap}.sidebar a{font-size:12px;padding:5px 8px;border-left:0;border-bottom:2px solid transparent}.sidebar .bottom{display:none}main{width:auto;margin:0 20px}section,section.hero{padding:38px 0}h1{font-size:30px;letter-spacing:-.7px}h2{font-size:25px}.thesis{font-size:24px}.dateline{font-size:11px}.specialties{grid-template-columns:1fr}.lead{font-size:18px}.layer{padding:17px 18px}.classification{padding-bottom:0}.causal{gap:10px;font-size:13px}.case-grid{grid-template-columns:1fr;min-height:245px}.bug-demo{grid-template-columns:1fr 1fr}.bug-text{grid-column:1 / -1;grid-row:2}.bug-demo>div:last-child{grid-column:2;grid-row:1}.bug-demo small{font-size:12px}.matrix{width:96px}.matrix i{line-height:38px}.detail-body{padding:8px 14px 17px}.detail-body table{min-width:620px}.deep>summary{padding:14px;font-size:14px}.bet-map{grid-template-columns:1fr}.chain-gates{gap:10px;font-size:11px}.scenario-controls{grid-template-columns:1fr;gap:16px}.scenario-output{padding:20px;min-height:270px}.table-scroll table{min-width:600px}.classification b{font-size:17px}footer{padding-bottom:25px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
@media print{.sidebar,.downloads,.filter,.step-tabs,.year-tabs,.scenario-controls{display:none!important}main{margin:0;width:100%;max-width:none}body{font-size:10pt;line-height:1.6}h1{font-size:27pt}h2{font-size:19pt}h3{font-size:12pt}section,section.hero{padding:20px 0;break-inside:auto}p{margin:9px 0}.table-scroll{overflow:visible}table{font-size:9pt}.table-scroll table{min-width:0!important}th,td{padding:8px}tr{break-inside:avoid}.deep{border:0}.deep>summary{padding:8px 0;background:none}.detail-body{padding:0}details:not([open])>div,details:not([open])>p{display:block!important}.caption{font-size:9pt}.sources li{font-size:8pt}.hero .layers{break-inside:avoid}.scenario-output{min-height:0}.evolution-grid>div{min-height:0}a{text-decoration:none;color:inherit}}
'''

js='''
const steps=[
 ['Issue 已绑定源码基线、工作目录与项目约束。可以从一个确定的起点开始。','先找项目、版本、代码位置和授权范围。仅有自然语言问题，还不能确定要改变哪个状态。'],
 ['在指定工具链安装依赖、执行基线测试。环境错误与产品错误能被区分。','需要发现安装和运行方法；补齐工具链与基线后，才能形成同样的复现实验。'],
 ['比较嵌套与非嵌套结果，修改矩阵组合逻辑，加入回归测试并检查受影响情形。','模型也能定位和修复；但必须主动建立同样的执行式验收，不能停在文字解释或修改截图。'],
 ['交付源码基线、diff、测试证据，继续进入 review 与 CI。','若要达到相同标准，补齐版本、证据与集成流程。加载相同适配后，两条路线趋同。']
];
const years={
 '2026':['Chat、IDE、CLI、专用 App 并存，任务开始共享。','文件、连接器、沙箱、计划与长任务已出现在多类产品中。','已观察：人仍大量补上下文、纠偏并审查结果。'],
 '2027':['人用 Chat 发起与纠偏，用任务台、预览和 diff 检查结果。','会话状态与运行环境更多复用，代码只是任务的一种交付物。','预测：人更集中于验收条件、高风险变更和失败任务。'],
 '2028':['Project 组织目标与上下文，跨 repo、应用和文档调度任务。','持久任务图、事件唤醒、审批与凭据代理成为平台能力。','预测：专业产品主要凭验证、企业运行环境与发布控制收费。'],
 '2030':['用户通常直接表达目标，系统按任务加载专业能力。','通用工作空间承载共享执行底座，领域能力可嵌入或独立采购。','预测：软件生产专业平台仍在，IDE 成为按需打开的检查与调试视图。']
};
const scenarios={
 'clear-low':['最容易自治：明确、可隔离的交付','任务能在副本中反复试错，并通过独立标准判断进展。计划、实现与修复可以连续推进。','产品形态：通用入口 + 可复用专业适配。例：明确 Bug、临时脚本、规则化对账。'],
 'clear-high':['可以自动执行，但需生产准入机制','正确性较可判断，但共享状态和不可逆后果限制生效。需要灰度、权限、监控与补偿。','产品形态：通用编排 + 强专业控制层。例：支付修复、数据库迁移、真实资金结算。'],
 'weak-low':['低风险探索，人类持续给反馈','试错便宜，却缺少稳定验收标准。更多自动迭代不一定更接近人的意图。','产品形态：协作式工作空间 + 预览和反馈。例：设计方向、早期产品原型。'],
 'weak-high':['最难自治：判断与后果都难封闭','既不能充分验证，又难恢复。提升模型能力仍需补充外部证据、明确责任和授权。','产品形态：人类主导的决策 + 专业执行支持。例：重大架构迁移、对外重大承诺。']
};
function selectButtons(selector,value,attr){document.querySelectorAll(selector).forEach(b=>{let yes=b.dataset[attr]===value;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',yes?'true':'false')})}
function setStep(i){document.getElementById('coding-state').textContent=steps[i][0];document.getElementById('general-state').textContent=steps[i][1];selectButtons('[data-step]',String(i),'step')}
function setYear(y){const d=years[y];document.getElementById('year-entry').textContent=d[0];document.getElementById('year-common').textContent=d[1];document.getElementById('year-role').textContent=d[2];selectButtons('[data-year]',y,'year')}
function setScenario(){const k=document.getElementById('verification').value+'-'+document.getElementById('consequence').value;const d=scenarios[k];['scenario-title','scenario-cause','scenario-product'].forEach((id,i)=>document.getElementById(id).textContent=d[i])}
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>setStep(Number(b.dataset.step))));
document.querySelectorAll('[data-year]').forEach(b=>b.addEventListener('click',()=>setYear(b.dataset.year)));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{const f=b.dataset.filter;document.querySelectorAll('#object-table tbody tr').forEach(r=>r.hidden=f!=='all'&&r.dataset.category!==f);selectButtons('[data-filter]',f,'filter')}));
['verification','consequence'].forEach(id=>document.getElementById(id).addEventListener('change',setScenario));
function revealAnchor(){const id=location.hash.slice(1);if(id.startsWith('source-')){document.getElementById('sources-details').open=true;requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({block:'center'}))}}
document.querySelectorAll('a.cite').forEach(a=>a.addEventListener('click',()=>{document.getElementById('sources-details').open=true}));window.addEventListener('hashchange',revealAnchor);
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+e.target.id))}}),{rootMargin:'-5% 0px -65% 0px'});document.querySelectorAll('main>section').forEach(s=>observer.observe(s));
let beforePrint=[];window.addEventListener('beforeprint',()=>{beforePrint=[...document.querySelectorAll('details')].map(d=>[d,d.open]);beforePrint.forEach(([d])=>d.open=true);document.querySelectorAll('#object-table tbody tr').forEach(r=>r.hidden=false)});window.addEventListener('afterprint',()=>beforePrint.forEach(([d,o])=>d.open=o));document.getElementById('print').addEventListener('click',()=>window.print());
setStep(0);setYear('2026');setScenario();revealAnchor();
'''

nav=[('judgment','主判断'),('structure','任务结构'),('objects','19 个对象'),('case','真实任务'),('chain','生产链与十问'),('bets','战略下注'),('evolution','2026→2030'),('forks','分叉与反证'),('evidence','证据索引')]
navigation=''.join('<a href="#'+i+'">'+t+'</a>' for i,t in nav)
page='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coding Agent 会被通用 Agent 吞并吗？｜系统研究</title><style>'+css+'</style></head><body><aside class="sidebar"><div class="brand">Coding Agent<br>的产品边界</div><nav aria-label="研究导航">'+navigation+'</nav><div class="bottom">事实截至 2026-10-05<br>未来形态为研究判断<br>交互图为因果示意</div></aside><main>'+content+'<footer>面向人类理解的系统研究 · 2026-10-05</footer></main><script>'+js+'</script></body></html>'
(ROOT/'index.html').write_text(page)
print(json.dumps({'html_bytes':len(page.encode()),'objects':len(objects),'questions':len(qs),'categories':{c:sum(x[1]==c for x in objects) for c in ['A','B','C']}},ensure_ascii=False))

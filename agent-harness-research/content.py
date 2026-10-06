"""Human learning content. All comparative claims carry source IDs and scope."""
HARNESS=[
 dict(id='codex',name='OpenAI Codex',tag='策略与执行环境分层',depth='核心调用链阅读；未编译运行 Rust 核心',chain=['cx-entry','cx-loop','cx-input','cx-prompt','cx-retry','cx-route','cx-policy','cx-follow','cx-stop'],insight='一次模型请求是一个 StepContext 的快照。工具列表、权限、执行环境和历史各有独立状态；它们不是一段 system prompt 就能替代的。',limit='开源 CLI/core 不等于托管 Cloud 控制面。云任务调度、worker 租约与故障恢复实现未公开核实。'),
 dict(id='claude',name='Claude Code',tag='闭源循环，公开接缝可观察',depth='SDK、sandbox、插件源码；实际运行公开 Stop hook',chain=['cl-transport','cl-control','cl-options','cl-sandbox','cl-hook','cl-log'],insight='Python SDK 将选项变成 Claude CLI 参数，并与 CLI 交换控制消息。SDK 的 query 并不是重新实现了 Claude Code 的模型循环。',limit='未读取或运行 Claude Code 私有核心；不能由 SDK 字段、changelog 或 Ralph 插件推导其完整调度与压缩算法。'),
 dict(id='kimi',name='Kimi Code / CLI',tag='集中式 Soul + 可替换 provider',depth='实际运行 KimiSoul / Shell；63 项上游测试',chain=['ki-loop','ki-step','ki-kosong','ki-toolset','ki-shell','ki-restore','ki-stop','ki-hooks'],insight='KimiSoul 管步骤、压缩与停止；Kosong 管 provider 流和工具回调；Kaos 抽象执行环境。checkpoint 与文件系统不是同一份状态。',limit='实测使用脚本化 provider 和测试 fixture 的 yolo=True；不代表线上模型成功率或全部权限模式。'),
 dict(id='deepseek',name='DeepSeek Harness',tag='插件组合 + 事件日志派生请求',depth='核心插件实跑 trace；103 项上游测试',chain=['ds-loop','ds-prompt','ds-request','ds-retry','ds-parallel','ds-pipeline','ds-stop','ds-persist'],insight='包括 agent loop 本身在内的能力都由 Cordis 插件装配。模型可见输入从 session events 派生；持久事实、实时事件和 UI 流分开。',limit='当前版本为 pre-stable。实测是核心插件组合，未启动完整 headless/web profile；不能把单元组合当成产品 E2E。'),
 dict(id='gemini',name='Gemini CLI',tag='流事件 + 显式工具状态机',depth='核心链阅读；实际执行输出折叠函数',chain=['ge-client','ge-turn','ge-input','ge-schema','ge-scheduler','ge-policy','ge-next'],insight='Turn 把 provider stream 转为 CLI 事件；Scheduler 管验证、审批、执行。没有工具调用后，还可能用 nextSpeaker 检查决定继续。',limit='只运行源码级纯函数实验，未运行带模型调用的完整 CLI。nextSpeaker 检查不是测试验收。'),
 dict(id='opencode',name='OpenCode',tag='Provider 适配 + 持久 session',depth='核心循环、压缩、权限、worktree 源码阅读',chain=['oc-loop','oc-llm','oc-process','oc-permission','oc-compact','oc-worktree'],insight='每轮重新查询过滤压缩后的消息，结合模型 finish reason 和实际 tool parts 判定是否继续，避免 provider 的 stop 与工具调用不一致。',limit='本次未运行 OpenCode。worktree 管理与权限询问的存在，不能证明每条执行路径都有 OS sandbox。'),
 dict(id='mini',name='mini-SWE-agent',tag='把最小控制循环暴露出来',depth='真实 DefaultAgent + LocalEnvironment；3 条完整 trace',chain=['mi-loop','mi-exec','mi-shell','mi-stop'],insight='模型选动作，环境返回观察，历史持续增长，退出信号终止。它是理解复杂 Harness 之前最清晰的参照。',limit='选用 LocalEnvironment 与测试用 DeterministicModel；框架还有其他模型适配器和 Docker 等环境，不能据此概括所有配置。'),
]

TOPICS=[]
def topic(id,title,lead,flow,risk,rows):
    TOPICS.append(dict(id=id,title=title,lead=lead,flow=flow,risk=risk,rows={key:dict(text=text,refs=refs.split(),kind=kind) for key,text,refs,kind in rows}))

topic('loop','Agent loop','一次用户 turn 可以包含许多次 model step；工具结果是下一次请求的新输入。',
 ['接受用户输入并打开 turn','组装请求、消费模型输出流','有工具就执行并回注观察','仍欠工具续答／有新输入／hook 阻止停止，就进入下一步'],
 '模型输出中的“完成了”只是内容；结束循环取决于 Harness 的控制条件。',[
 ('codex','submission_loop 接收操作；run_turn 管外层循环；run_sampling_request 管单次响应流。needs_follow_up 结合模型后续需求与 pending input，停止前运行 hooks。','cx-entry cx-loop cx-follow cx-stop','source'),
 ('kimi','KimiSoul 的循环依次做 step limit、压缩、checkpoint、_step。_step 调 kosong.step，等待 tool_results，再 _grow_context；有工具返回 None 继续，无工具返回 StepOutcome。','ki-loop ki-step ki-stop','source'),
 ('deepseek','turn() → preStep() → step()。每一步在日志里打开 step/start、提交 assistant/tool 结果、关闭 step/end；输入 inbox 还有工作时继续。','ds-loop ds-stop','source'),
 ('gemini','GeminiClient.sendMessageStream → Turn.run → GeminiChat；工具调度由 Scheduler 管理。流结束且无工具时可能调用 nextSpeaker，再发送 Please continue.。','ge-client ge-turn ge-scheduler ge-next','source'),
 ('opencode','SessionPrompt.runLoop 每轮读 session 消息，处理 subtask / compaction，再调用 SessionProcessor。结束必须既有合适的 finish reason，又没有待续 tool parts。','oc-loop oc-process','source'),
 ('mini','DefaultAgent.run 的 while True 调 step → query → execute_actions。异常可转为观察或 exit；finally 保存轨迹，最后一条 role=exit 时退出。','mi-loop mi-exec','source'),
 ('claude','公开 SDK 启动 CLI 子进程并处理双向协议。真正决定下一次模型请求的 Claude Code 核心循环在本次材料中不可见。','cl-transport cl-control','unknown')])

topic('input','每轮 model input','请求是历史的一个投影，还带系统指令、工具定义和生成配置。UI 上看到的完整聊天不一定等于它。',
 ['选定本轮有效历史','恢复必要的环境与指令','加入当前可见工具及生成参数','序列化成 provider 的请求格式'],
 '抓 UI 文本无法还原完整请求；工具 schema、增量更新、隐藏摘要和被截断的观察都会影响行为。',[
 ('codex','build_prompt 明确构造 input、base_instructions、tools、parallel_tool_calls、output_schema。增量工具模式下 tools 字段为空，工具由历史更新提供；不能据此断言模型没有工具。','cx-prompt cx-history','source'),
 ('kimi','kosong.step 的四个核心输入是 request_chat_provider、agent.system_prompt、agent.toolset 和 effective_history；provider 负责转换到具体 API。实测已记录这四层中的可序列化内容。','ki-step ki-kosong','source'),
 ('deepseek','prepareRequest 完成 request/header 与上下文记录后，调用 session.deriveMessages()，冻结 message 和 request。日志是请求重建的基础，不是仅用于 UI 的旁路。','ds-request ds-prompt','source'),
 ('gemini','GeminiChat 请求里 systemInstruction、tools 和 contents 分开。Gemini 的 role/parts 与 OpenAI 的 role/tool-call 表达不同，职责可以比较，字段不能直接对应。','ge-input ge-schema','source'),
 ('opencode','LLM.run 先做 provider-specific request preparation，再调用 AI SDK streamText。其工具和消息转换属于 Harness 适配层。','oc-llm','source'),
 ('mini','DefaultAgent.query 把 self.messages 交给 model.query；实际 API 包装由模型类实现。本实验逐轮拷贝了 messages，能看到工具观察如何使输入增长。','mi-loop','source'),
 ('claude','SDK 能设置 system_prompt、工具和 agent 等选项，但 CLI 内部最终 API 请求的精确拼装不能由这些参数单独确定。','cl-transport cl-options','unknown')])

topic('instructions','指令与 repo context','“来源”“API role”“优先级”“可执行权限”是四个不同问题。仓库文件不是天然的 system 指令。',
 ['发现配置及仓库指令文件','按产品规则合并与限额','渲染到对应 role / prompt section','后续变更按快照或增量更新'],
 '提示词要求模型守规矩是软约束；真正的能力限制仍要在工具执行处验证。',[
 ('codex','当前实现把 AGENTS.md 渲染为 contextual user fragment；权限、开发者指令等有独立 section。AgentsMdState 比较前后快照，必要时发替换或撤销通知。','cx-input cx-agents','source'),
 ('kimi','load_agents_md 从 project root 到 work_dir 合并 .kimi/AGENTS.md 与 AGENTS.md。BuiltinSystemPromptArgs 含仓库指令、目录、shell、skills；这部分进入 system 模板。','ki-agents ki-builtins','source'),
 ('deepseek','SystemPrompt 服务组装分段指令和工具；request 的实际角色历史由 Session 投影。agent-instructions 是独立插件，行为可由 profile 组合改变。','ds-prompt ds-architecture','source'),
 ('gemini','getCoreSystemPrompt(config, systemMemory) 形成 systemInstruction；环境历史另行构造。应区分系统记忆、普通 history 和 provider 配置。','ge-input ge-system','source'),
 ('opencode','循环读消息，LLM request preparation 组合系统提示、agent 与 provider 参数；上下文不是仅由最近一条 user 文本组成。','oc-loop oc-llm','source'),
 ('mini','run 只默认渲染 system_template 与 instance_template。repo context 是否出现由模板、模型动作或额外配置决定；没有统一强制的 AGENTS.md 注入。','mi-loop','source'),
 ('claude','SDK 公开 system_prompt 和可选配置来源，changelog 记录 CLAUDE.md 重复加载、compaction 恢复问题。能确认行为面，不能据此重建全部优先级与 token 排列。','cl-transport cl-memory cl-log','unknown')])

topic('compression','压缩、淘汰与总结','预算超限的解法至少有三种：截短观察、移除旧内容、用模型总结。它们损失的信息不同。',
 ['计量当前请求与预留输出预算','先处理过大的工具输出／附件','在安全边界切分旧历史和保留尾部','生成摘要并重建下一轮请求'],
 '摘要是新的模型输出，可能丢掉否定约束、失败证据或待办；上下文变短不代表状态已安全保存。',[
 ('codex','history 对模型可见 tool output 做截断，但保留 full rollout。compact 有本地摘要与不同 remote 能力路径；本地实现组合 user messages、summary，再按阶段重注入初始上下文。没有一个对所有 provider 恒定的阈值。','cx-history cx-compact cx-loop','source'),
 ('kimi','触发条件是 tokens ≥ window×ratio 或 tokens+reserved ≥ window。SimpleCompaction 默认保护尾部 2 个 user/assistant 锚点及其后消息；旧历史送另一次无工具模型调用，摘要以 user 消息回注。','ki-compact ki-summary','source'),
 ('deepseek','compaction-basic 是 pre-step / request-error 插件：pressure 与 context-overflow 路径不同，先可选 prune，再 summary；表面节点被替换，历史事件仍可回放。请求预算还包括路由后的 envelope。','ds-compact ds-request','source'),
 ('gemini','存在旧 functionResponse 折叠、工具输出落文件、summary+保留尾部多种机制。源码默认折叠保护最近 3 个工具响应 turn，并豁免 read_file 等检索工具；空摘要或膨胀摘要可判失败。','ge-collapse ge-compress','source'),
 ('opencode','prune 扫描旧 tool parts，保护最近 token 区域和部分工具，标记 compacted；另有 compaction agent 生成摘要并可自动继续。这两步不是同一算法。','oc-compact oc-loop','source'),
 ('mini','DefaultAgent 的这条路径只累加 messages，没有自动摘要模块。step/cost/time limit 是停止预算，不能当成 context 压缩。','mi-loop','source'),
 ('claude','官方 changelog 确認自动压缩、恢复和不同模型窗口设置；精确阈值、摘要 prompt 与淘汰顺序未从私有核心验证。','cl-log','unknown')])

topic('schemas','tool schema','工具定义告诉模型“可以请求什么”；模型返回的 arguments 仍必须按不可信输入处理。',
 ['注册内置／外部工具','按能力与可见性选择 schema','传给 provider 或增量上下文','返回 tool name + arguments + call id'],
 '隐藏 schema 不等于撤销执行权限；模型也可能猜中工具名或返回旧 schema 的参数。',[
 ('codex','ToolRouter 维护可见 spec；build_prompt 在普通模式把 model_visible_specs 放入 tools，增量模式通过历史更新。实际执行仍走 registry/handler。','cx-prompt cx-route cx-tools','source'),
 ('kimi','KimiToolset.tools 暴露各工具 base schema；Kosong 在 generate 时拿工具表。Toolset 同时保有 handler 和隐藏工具集合。','ki-toolset ki-kosong','source'),
 ('deepseek','ToolRuntime 将模型可见声明与执行实现分开，支持 native / PTC 等展示模式；pipeline 仍在执行处做 guard，不能把 schema 过滤当授权。','ds-tools ds-pipeline ds-prompt','source'),
 ('gemini','tool registry 的声明包装成 functionDeclarations，setTools 更新 GeminiChat；ToolCall 的构建／验证与执行调度分开。','ge-schema ge-scheduler','source'),
 ('opencode','准备后的 tools 交给 streamText；对模型拼错名称等错误存在 experimental_repairToolCall 路径。repair 是结构恢复，不是安全授权。','oc-llm','source'),
 ('mini','框架支持 native toolcall 和文本动作适配器。此研究的 DeterministicModel 直接输出 extra.actions，因此本实验不测模型能否遵守 JSON schema。','mi-loop mi-exec','source'),
 ('claude','SDK 支持工具控制与 MCP 配置；公开 transport 构造 CLI 参数。CLI 最终发送给模型的 schema 枚举与裁剪在本次材料中未知。','cl-control cl-transport','unknown')])

topic('dispatch','tool call 调度','“模型允许 parallel tool calls”和“这些工具真的安全并行执行”不是同一个开关。',
 ['把流里的调用绑定到本轮工具表','校验参数与执行资格','按并行／独占策略调度','保留 call id 并把结果写回历史'],
 '同文件并发编辑、结果乱序、取消后孤儿进程，是调度器必须处理的真实问题。',[
 ('codex','ToolCallRuntime 对支持并行的工具拿 RwLock 读锁，其他工具拿写锁；回调保留最初 StepContext，避免后来工具列表变化导致路由漂移。','cx-parallel cx-route','source'),
 ('kimi','Kosong 识别 tool call 后交给 toolset.handle；KimiToolset 持有当前 step 的任务与重复调用状态，Soul 在增长历史前等待结果。','ki-kosong ki-toolset ki-step','source'),
 ('deepseek','executeToolCalls 按 live execution mode 组并行池或独占屏障；执行可以重叠，但按模型调用顺序提交结果。取消停止新增，等待已开始调用收尾，未开始调用补结果。','ds-parallel','source'),
 ('gemini','Scheduler 把连续的可并行调用组成 active batch，经策略／审批进入 ready 状态后执行。队列、active 和 completed batch 是显式状态。','ge-scheduler ge-policy','source'),
 ('opencode','Tool execute 由 streamText 与处理器配合，持续更新 session 中的 tool parts；该路径不是靠 assistant 文本里写“执行了”来推进状态。','oc-llm oc-process','source'),
 ('mini','execute_actions 使用列表推导按顺序调用 env.execute；这种简单串行语义便于检查，吞吐与复杂控制能力有限。','mi-exec','source'),
 ('claude','SDK 的控制请求 handler 可异步处理 permission/MCP 等回调；不能把它等同于 Claude Code 内部工具并行调度算法。','cl-control','unknown')])

topic('permission','shell / 文件 / 网络权限','权限决定“这项动作是否获准”；sandbox 决定“获准后，进程最多能碰到哪里”。',
 ['识别动作与参数','应用管理规则、用户授权、会话授权','必要时申请明确授权','执行处再次约束目标与能力'],
 '自动批准只省去询问，不会自动建立隔离；路径限制也不能替代网络或凭据限制。',[
 ('codex','ToolOrchestrator 统一审批、sandbox 选择、attempt 和特定拒绝恢复。网络审批有单独生命周期；shell 工具上的批准不能推导所有 MCP 服务都获准。','cx-policy','source'),
 ('kimi','Shell 调用 Approval.request 后才运行命令。yolo/afk、已有授权、用户响应属于审批状态；本地 Kaos 执行本身不等于内核 sandbox。','ki-shell ki-approval','source'),
 ('deepseek','ToolRuntime 的 pre/execute/post 管道连接策略；执行 guard 是独立约束。sandbox-local 负责进程限制，插件树决定哪些策略实际加载。','ds-pipeline ds-sandbox ds-architecture','source'),
 ('gemini','Scheduler 调用 checkPolicy 获得 allow/deny/ask，再进入审批与执行状态。LinuxSandboxManager 是另一层运行隔离。','ge-policy ge-sandbox','source'),
 ('opencode','Permission.ask 对 permission+patterns 求 allow/deny/ask；批准缓存和 deny 都在此处理。当前阅读的 shell 路径使用进程 spawner，不能以存在 permission 服务就声称有内核隔离。','oc-permission oc-llm','source'),
 ('mini','选用的 LocalEnvironment 直接 subprocess.Popen(shell=True)，继承环境并设置 cwd/timeout，没有交互审批或本地 OS sandbox 的实现。容器环境是另一个可选 backend。','mi-shell','source'),
 ('claude','SDK can_use_tool 是双向控制回调，公开 sandbox-runtime 则落实文件／网络限制。这说明审批和隔离处于不同层；私有 CLI 的所有策略组合未审计。','cl-control cl-network cl-sandbox','source')])

topic('sandbox','sandbox 与环境','隔离必须落实到执行能力：子进程、挂载、网络、凭据，而不是目录名或提示词。',
 ['建立工作目录和运行时','生成 filesystem/network 限制','包装进程启动参数或远程执行请求','观察实际拒绝与退出状态'],
 'worktree 是协作隔离，不是安全隔离；远程 MCP 的副作用发生在服务端，也不受本地 shell sandbox 自动保护。',[
 ('codex','开源 sandbox 层提供平台选择与命令包装；调用方通过 ToolOrchestrator 传权限和执行环境。具体限制随平台／profile 变化，本次没有运行隔离穿透测试。','cx-sandbox cx-policy','source'),
 ('kimi','本次追踪到的 Shell → Kaos 环境抽象，不是通用 OS confinement。不要从 approval=true、不同 session 或 SSH backend 推断出安全隔离。','ki-shell ki-approval','source'),
 ('deepseek','sandbox-local 的平台链：Linux bwrap 再 Landlock、macOS Seatbelt、Windows restricted-token/ACL；功能探测不可用时 fail closed。Windows 的 partial enforcement 被源码明确记录。','ds-sandbox','source'),
 ('gemini','独立 LinuxSandboxManager 负责 Linux sandbox 路径，另有 macOS / Windows backend。存在实现不等于所有用户配置都启用。','ge-sandbox','source'),
 ('opencode','worktree 代码创建 Git 工作树和启动脚本。它把文件与分支工作流拆开，不提供 OS 级禁止访问兄弟目录的保证。','oc-worktree','source'),
 ('mini','LocalEnvironment 是本地 shell；选择 Docker/Singularity 等环境能改变执行位置与限制。这是 environment 接口的职责，不由 DefaultAgent while loop 保证。','mi-shell mi-loop','source'),
 ('claude','公开 sandbox-runtime 有 HTTP/SOCKS 代理、域名过滤及平台 wrapping；本次阅读了实现，没有声称验证 Claude Code 部署时的每个默认策略。','cl-sandbox cl-network','source')])

topic('extensions','MCP / plugin / skill','MCP 是外部能力协议，plugin 是装配与扩展单位，skill 是按需加载的任务知识与流程；三者会相互包含。',
 ['安装或发现扩展','加载说明、资源或连接服务','形成模型可见 context / schema','执行时回到同一权限与观测层'],
 '一段 SKILL.md 的规则不等于强制执行；MCP 提供连接也不证明服务端授权正确。',[
 ('codex','core registry 可以装入 MCP/app 工具，context builder 同时装入插件相关指令。工具可延迟暴露；plugin/skill/context 不必与 tools 字段一一对应。','cx-tools cx-input cx-prompt','source'),
 ('kimi','KimiSoul 在 turn 初始化阶段等待 deferred MCP loading；skills 目录信息进入 prompt。真正工具调用仍由 toolset/Kosong 执行。','ki-loop ki-builtins ki-kosong','source'),
 ('deepseek','plugin 是底层结构：loop、LLM adapter、tools、persistence 都是 Cordis plugin；MCP 与 skills 是其上的能力插件。这比“插件只添加几把工具”更广。','ds-architecture ds-prompt','source'),
 ('gemini','工具声明统一进入 registry / functionDeclarations；工具执行仍走 Scheduler 和 policy。扩展来源与执行资格不能混为一谈。','ge-schema ge-policy','source'),
 ('opencode','LLM 管线支持 plugin 参与，压缩也允许插件修改 prompt；MCP/tool 接入最终仍要转成可执行工具及 session 结果。','oc-llm oc-compact','source'),
 ('mini','DefaultAgent 最小主干只依赖 Model 和 Environment 接口，未在这条代码路径内实现完整 skill/plugin/MCP 生命周期。可以外部扩展，但不是已内置的事实。','mi-loop','source'),
 ('claude','SDK options 明确把 plugins 用于 commands、agents、skills、hooks；skills 列表是 context filter，源码明确说不是 sandbox。SDK MCP/control 是另一条接缝。','cl-options cl-control','source')])

topic('state','state / session / persistence','至少要区分四种状态：模型历史、运行中控制状态、持久事件、工作目录及外部世界。',
 ['给 turn/step/tool 建身份','更新内存状态并记事件','持久化完整轨迹或可恢复记录','重启时恢复历史并处理未完成动作'],
 '保存聊天不代表保存进程；重放工具会再次产生副作用。append 返回也不一定等于 crash-safe flush。',[
 ('codex','Session / TurnContext / StepContext 分层；live context 可以截断，rollout 保留完整 payload。继续对话要恢复可见上下文，不能简单把 UI 消息原样拼回。','cx-history cx-loop cx-input','source'),
 ('kimi','Context JSONL 包含消息、usage、checkpoint 等记录，restore 重建 history 与 pending token estimate；revert_to 旋转日志后重建前缀。磁盘代码文件不在这个回退里。','ki-context ki-restore','source'),
 ('deepseek','append-only SessionEvent 是投影基准；assistant/attempt 记录失败尝试而不进入正常模型历史。Persistence 对 append、flush 和单 writer ownership 有明确不同保证。','ds-request ds-retry ds-persist','source'),
 ('gemini','ChatRecordingService 持久化会话；GeminiChat 区分完整与 curated history，后者用于合法模型请求，不能假设两者等同。','ge-record ge-history','source'),
 ('opencode','runLoop 每次从数据库取过滤压缩后的消息，processor 写入文本/tool parts、状态与完成信息。session 是一等持久对象。','oc-loop oc-process','source'),
 ('mini','DefaultAgent.save 序列化 messages、模型调用次数、费用、配置和 exit_status；run 的 finally 每步调用 save。未配置 output_path 时不会自动生成文件。','mi-loop','source'),
 ('claude','公开 SDK 有 resume/fork_session 与 session store 接口；它能搬运或恢复 CLI 会话，但内部所有运行中任务的崩溃一致性不能仅由接口推导。','cl-options cl-transport cl-store','unknown')])

topic('cloud','Cloud task 为什么能长期运行','长期运行依赖持续的执行环境、可恢复状态和调度，不是一次无限长度的模型生成。',
 ['从准备好的环境创建 task workspace','worker 反复执行 model/tool steps','长命令与后台任务由进程／job 管理','断连后客户端重新读取结果；必要时从保存状态继续'],
 '浏览器保持连接、worker 活着、任务能恢复、任务能正确完成，是四个不同保证。',[
 ('codex','当前官方 Cloud 文档：新任务使用发布环境的 prepared filesystem，各 task 有 isolated workspace；已有 task 保留修改和工具，电脑休眠时也能继续。worker 调度、lease、容灾实现仍未知。','cloud-current','official'),
 ('kimi','Shell 区分前台和后台 timeout；后台任务设施可让命令不占住一次交互。它解释进程寿命的一部分，不能据此声称拥有托管 Cloud 平台。','ki-bg ki-subagent','source'),
 ('deepseek','jobs、session-persistence 与 driver 生命周期是独立服务，可以构成长运行 worker。此次没有验证生产云端任务的 SLA、重启或队列调度。','ds-architecture ds-persist','inference'),
 ('gemini','客户端有多轮请求及会话记录能力；本地 CLI 能多轮工作，不等于已经证明某云托管系统可恢复长期任务。','ge-client ge-record','unknown'),
 ('opencode','session 存储与工作树让任务可持续；托管运行时间、调度和基础设施恢复不是所读 runLoop 的责任。','oc-loop oc-worktree','inference'),
 ('mini','循环受 step/cost/wall-time budget 限制。托管进程可以继续运行，但保存 JSON 本身不提供 worker 重启与副作用去重。','mi-loop','inference'),
 ('claude','官方 changelog 涉及 cloud session restart、后台任务和 runner 启动等行为；底层调度代码未见。本研究不把这些修复条目扩写成确定的控制面架构。','cl-log','unknown')])

topic('subagent','subagent / parallel agent','子 Agent 通常是新的控制循环和上下文，不一定是新机器、新进程或新 worktree。',
 ['定义子任务与可用工具','创建独立 session/context 和预算','安排运行、消息与取消','把结果和证据带回父任务'],
 '并行增加了上下文独立性，也增加共享文件竞争、权限继承和结果验收成本。',[
 ('codex','AgentControl.spawn_agent_internal 处理创建、配置与继承；子 Agent 有独立 thread identity。恢复子任务时会校验父环境、策略变更并收窄权限交集。这里只证明所读路径的约束，不代表完整安全审计。','cx-spawn cx-inherit','source'),
 ('kimi','ForegroundSubagentRunner 管实例与运行；有 resume、foreground/background 状态。explore 类型还可以注入 Git context，但这不是自动 worktree 隔离。','ki-subagent ki-git','source'),
 ('deepseek','Subagent 是可替换服务：in-process spawn/fork、ACP、Claude Code/Codex/SDK provider 等有不同 driver。公共接口不意味着都共享同一种运行隔离。','ds-subagent ds-architecture','source'),
 ('gemini','LocalSubagentProtocol 与 remote protocol 分开，建立子任务运行边界。不要把工具并行 batch 等同于多个自主 agent loop。','ge-agent ge-scheduler','source'),
 ('opencode','task 工具创建或继续子 session，并给子任务设置工具/权限配置。父子 session 的存在不自动证明文件系统隔离。','oc-subagent','source'),
 ('mini','DefaultAgent 没有原生 subagent scheduler。可以外部组合多个实例，但那部分编排属于新增 Harness。','mi-loop','source'),
 ('claude','SDK AgentDefinition/agents 公开子 agent 配置；changelog 可观察 worktree agents、fork 与后台行为。私有调度器和消息合并细节仍未知。','cl-options cl-worktree','unknown')])

topic('git','Git / branch / worktree','Git 负责版本与变更隔离；验证与合并需要另一个工作流来组织。',
 ['选定仓库和基准 commit','创建工作区／branch/worktree','执行变更并查看 diff','验证后决定 commit / PR / merge'],
 'worktree 仍能访问邻居目录；git 回退不能撤回已发送邮件、数据库写入等外部副作用。',[
 ('codex','当前 Cloud 为每个任务提供独立 workspace 并保存未提交修改；source core 的 loop 可以调用 Git 工具链。不能把 workspace isolation、Git branch 和 sandbox 视为同一件事。','cloud-current cx-policy','official'),
 ('kimi','collect_git_context 给新 explore 子 Agent 获取 remote/branch/dirty/log。它主要改善上下文，不等于替它创建独立分支。','ki-git','source'),
 ('deepseek','架构把 workspace、subagent 和 session fork 分层；fork 对话历史与 fork 工作目录不是同一个 API 保证。','ds-architecture ds-subagent','source'),
 ('gemini','环境与工具链可执行 Git；会话记录不替代 source control。此次未验证自动分支创建／合并策略，不作默认行为结论。','ge-record','unknown'),
 ('opencode','Worktree.setup 调 git worktree add --no-checkout，可创建分支或 detach；后续 populate/reset/bootstrap。它是显式产品工作流，源码上独立于模型 loop。','oc-worktree oc-snapshot','source'),
 ('mini','本地环境可以执行 Git，但 DefaultAgent 不强制 branch/worktree/commit 策略；这由任务、模型动作或 benchmark runner 决定。','mi-shell mi-loop','source'),
 ('claude','changelog 能确认 worktree 子 Agent 存在；本次没有运行 Claude Code worktree 工作流。','cl-worktree','official')])

topic('recovery','error / retry / rollback','重试模型请求、重试工具和撤销副作用是三件事，必须分别设计。',
 ['分类 transport / model / tool / policy 错误','保存已确认发生的事实','只重试可安全重试的阶段','必要时恢复状态或执行补偿'],
 '请求超时不证明服务端没执行；盲目重放工具可能重复写入。控制恢复不等于业务回滚。',[
 ('codex','run_sampling_request 有 ResponsesStreamRetryState；工具层另有 sandbox denial 处理。Stop hook 还能请求继续。不同层的 retry 不应合并成“失败就重跑”。','cx-retry cx-policy cx-stop','source'),
 ('kimi','_step 对可重试错误使用 tenacity 和 connection recovery；回退 checkpoint 是对话历史操作。实际测试证明 revert 后文件内容仍是 after edit。','ki-step ki-context','source'),
 ('deepseek','失败流保存 assistant/attempt，request-error waterfall 决定 retry；不完整 tool call 可以补 synthetic error result，封闭 step/turn。补日志不是重复执行，也不是撤销已执行动作。','ds-retry ds-repair ds-parallel','source'),
 ('gemini','Turn 暴露 Retry/UserCancelled 等事件；Scheduler 维护取消和结果状态。compression 失败也有不同状态，不能把它统一处理为成功后继续。','ge-turn ge-scheduler ge-compress','source'),
 ('opencode','processor 负责错误和 retry/compact/stop 回馈；Git snapshot 模块提供文件状态能力。外部副作用需要另外设计补偿。','oc-process oc-snapshot','source'),
 ('mini','FormatError 可回注并重试，连续错误有上限；工具 timeout 先杀进程组，再形成观察。最终保存轨迹并不撤销已写文件。','mi-loop mi-shell','source'),
 ('claude','公开 SDK 管控制协议异常；changelog 记录 partial-response continuation 与 reasoning-only retry。核心重试的精确条件／次数未由源码证实。','cl-control cl-log','unknown')])

topic('verification','verification 怎样发生','测试和检查只是工具能力。只有工作流把结果绑定到产物和完成条件，检查才构成验收。',
 ['先定义可观察的验收条件','针对当前产物版本运行检查','读取退出码、覆盖范围和原始结果','通过后才允许完成；失败则继续或明确阻塞'],
 '测试命令 exit 0 也可能没发现任何测试；上一次 commit 的通过结果不能证明当前 diff。',[
 ('codex','模型可调用工具检查，Stop hook 可回注阻止停止；本次所读通用循环没有对任意仓库自动推导正确验收标准。','cx-stop cx-policy','source'),
 ('kimi','Shell 把非零 exitcode 返回 ToolError；模型可以据此修复，也可能忽略。实测失败观察进入下一轮 history 后，预设模型仍说完成。Stop hook 是可加验收的位置。','ki-shell ki-step ki-hooks','source'),
 ('deepseek','tool result 会进入下一轮 derived history；turn-stopping 是扩展点。基本 loop 的 completed 不包含通用 test oracle；实测受控 FAIL 文本后仍可 completed。','ds-loop ds-stop ds-request','source'),
 ('gemini','nextSpeaker checker 的 prompt 明确只根据上一条回复判断谁接着说话；它不是对磁盘代码或测试结果的独立验收器。','ge-nextprompt ge-next','source'),
 ('opencode','结束判断参考 finish reason 和 tool parts，而非统一 repo 测试状态。可通过工具和工作流验证，但不是每次结束的自动前置条件。','oc-loop','source'),
 ('mini','LocalEnvironment._check_finished 只检查 stdout 首行的 sentinel 和这条命令 exitcode=0。实验中被提交的错误代码没有通过独立测试。','mi-stop','source'),
 ('claude','公开 Ralph Stop hook 检查 promise 文本或迭代数，没有运行代码测试。本实测只能评价这个插件，不能推广为 Claude Code 全部 verification 行为。','cl-hook','source')])

topic('completion','“任务真的完成”怎样判定','区分协议完成、过程完成和目标完成。各家默认循环通常只可靠地表达前两者的一部分。',
 ['模型本步结束','没有待工具／待输入／继续要求','stop hooks 和策略允许结束','另行判断用户验收条件是否满足'],
 '把 completed、Submitted、stop 或 HTTP 200 映射成“用户目标已实现”，会制造语义错误。',[
 ('codex','!needs_follow_up 后仍跑 stop hooks；hook 可继续。最终 turn completion 表示这次控制流程结束，不是形式化的用户目标证明。','cx-follow cx-stop','source'),
 ('kimi','no_tool_calls / tool_rejected / repeat 等是不同 stop reason；只有其中一部分有 final_message。不要在 UI 中把所有 TurnEnd 渲染成“成功”。','ki-stop ki-loop','source'),
 ('deepseek','无 tool call 返回 completed；max-tokens 单独报告，并在 turn 中保持 sticky，避免之后的正常 step 把截断结果伪装成正常完成。','ds-stop ds-loop','source'),
 ('gemini','finishReason、pendingToolCalls、nextSpeaker 和 bounded turns 一起决定交互流程；每种 stop 的语义仍需 UI 保真展示。','ge-next ge-client','source'),
 ('opencode','源码专门处理 provider 返回 stop 但还带工具调用的情况，防止循环早停。修复协议边界仍不等于目标验证。','oc-loop','source'),
 ('mini','Submitted 是由环境抛出的控制异常；与 LimitsExceeded / TimeExceeded 等 exit_status 分开。Submitted 不含“测试通过”的硬条件。','mi-loop mi-stop','source'),
 ('claude','公开 hook 能把停止转换为新的 continuation；达到迭代上限也可停止。私有默认完成策略仍未知。','cl-hook','source')])

topic('false-completion','false completion 怎样产生','最直接的来源是：模型的语言性承诺，被当成了环境中的事实。',
 ['验收标准缺失或模糊','失败证据未进入／被压缩出上下文','模型产生终结回复','Harness 正常停止，界面显示成功'],
 '多跑几轮不是充分解法。没有可靠验收器时，只会增加一次重新声称完成的机会。',[
 ('codex','推断：缺少具体 stop gate 时，正常无续答路径仍可能接受未满足目标的答案。源码证明控制点存在，本研究没有测出 Codex 的实际误完成率。','cx-stop','inference'),
 ('kimi','实测：真实 Shell 执行失败测试，观察进入 history；脚本模型直接输出完成，Soul 停止。它证明控制链允许这条路径，不证明真实 Kimi 模型经常这样做。','ki-shell ki-stop','experiment'),
 ('deepseek','实测：受控 verify 工具返回 FAIL 文本，第二轮脚本响应“完成了”，turn/end 为 completed。测试只隔离控制逻辑，不测 DeepSeek 模型能力。','ds-stop ds-request','experiment'),
 ('gemini','推断：nextSpeaker 读上一条回复时，完整却错误的“完成了”可能无需继续。源码只支持这个机制风险，不支持任何误完成频率。','ge-nextprompt','inference'),
 ('opencode','推断：finish reason 加 tool parts 能防协议早停，却无法证明任务语义成功。实际风险取决于模型与外层验收。','oc-loop','inference'),
 ('mini','实测三条路径均 Submitted：不修复、修复且测试通过、测试失败但忽略；外部验收结果分别为 1 / 0 / 1。结束状态相同，世界状态不同。','mi-stop mi-loop','experiment'),
 ('claude','实测公开 Ralph hook：输出 <promise>DONE</promise> 就接受停止，即使未提供测试证据；迭代上限也会停。仅代表该插件。','cl-hook','experiment')])

topic('boundary','模型与 Harness 的边界','模型负责提出行动、解释观察与作出判断；Harness 决定它看见什么、能做什么、怎样执行和留下何种证据。',
 ['模型提出语义计划与动作','context 层选择可见事实','permission + environment 层约束并执行','workflow + verification 层组织验收和交付'],
 '同一个模型放进不同环境、工具与验收流程，会表现为不同 Agent；不能把全部差异归因于模型 IQ。',[
 ('codex','显式 StepContext、ToolRouter 与 Orchestrator 表明模型选择不直接等于执行权；新模型也必须通过执行与权限边界。','cx-prompt cx-policy','inference'),
 ('kimi','替换 provider 后 Soul、Shell、Context 仍正常运行。我们的脚本 provider 实验正是把模型能力固定，单独观察 Harness。','ki-step ki-shell','experiment'),
 ('deepseek','LLM adapter、agent loop、session、sandbox 可分别替换；产品哲学是可组合系统，代价是组合正确性与扩展顺序更复杂。','ds-architecture ds-pipeline','inference'),
 ('gemini','专门的 nextSpeaker 与 loop detector 体现用额外控制层补偿模型不连续行为；强模型可能降低这些启发式干预需求。','ge-nextprompt ge-client','inference'),
 ('opencode','多 provider 适配和 tool repair 是兼容性工程；模型／协议趋同后部分适配会减少，session 与权限仍不可省。','oc-llm oc-loop','inference'),
 ('mini','极简 loop 将更多行为留给模型。这是一个可理解的设计取舍，不意味着环境、预算与轨迹不再需要 Harness。','mi-loop','inference'),
 ('claude','公开 SDK/插件/sandbox 体现“可配置接缝”的产品方式；核心算法不可见，所以不能用代码行数或架构整洁度对闭源核心作排名。','cl-transport cl-control cl-sandbox','inference')])

FUTURE={
 'thesis':'下一代 Harness 应该是带权限与证据的执行系统：模型可以不断变强，但它不该自行铸造授权、重写已发生事实或给自己的产物无条件签发“完成”。',
 'layers':[
  dict(name='Environment',job='提供可运行的世界',owns='文件系统、依赖、进程、网络、凭据、资源配额',input='环境快照 + 权限 profile',output='带环境身份的执行结果',invariant='workspace/worktree 与 sandbox 分开；secret 交付可审计。'),
  dict(name='Context',job='构建本轮看得见的事实',owns='指令层级、检索、预算、摘要、工具 schema、缓存前缀',input='持久事件 + repo 状态 + 当前目标',output='可重建的 model request',invariant='每条关键约束有来源；摘要不能成为唯一事实库。'),
  dict(name='Workflow',job='组织跨步、跨任务的进展',owns='目标分解、依赖、subagents、并行、恢复、交付',input='目标 + 任务状态机 + 可用能力',output='下一项待执行工作',invariant='推进任务状态必须基于已提交事件；重试遵循幂等与补偿边界。'),
  dict(name='Permission',job='决定谁能对什么做什么',owns='授权、最小能力、审批缓存、能力下放、执行 guard',input='actor + operation + resource + grants',output='allow / deny / ask + 限制',invariant='执行时校验；可见 schema、skill 指令、子 Agent 都不能绕过。'),
  dict(name='Verification',job='检验当前产物是否满足目标',owns='验收契约、测试发现、差分检查、独立评审、证据关联',input='artifact hash + acceptance criteria + checks',output='passed / failed / blocked / unknown',invariant='证据绑定产物版本、环境与时间；测试通过不升级为超出覆盖面的证明。'),
  dict(name='Event ledger',job='保存事实与因果',owns='request、tool intent/result、文件差分、checkpoint、授权、验收记录',input='所有已确认状态转换',output='UI、重建、审计、恢复投影',invariant='一项副作用有稳定 ID；日志完成不冒充副作用 exactly-once。'),
 ],
 'eaten':[
  ['格式补救','模型更稳地遵守 schema 后，repair tool-call、重提示和纠正格式的胶水可减少。','仍需输入验证；更高概率的正确不是确定性保证。'],
  ['机械步骤编排','固定 ReAct 文案、手工 chain、部分 next-speaker/重复检测启发式可能收缩。','预算、取消、超时和依赖约束仍是运行时责任。'],
  ['脆弱语义摘要','更长上下文、更好检索与原生状态处理能减少频繁摘要。','成本、来源、隐私、过期事实与可复现性不会因窗口增大消失。'],
 ],
 'stronger':[
  ['权限与隔离','模型能执行更复杂动作时，潜在影响也更大；能力必须由运行时控制。'],
  ['环境复现与可恢复执行','长任务、后台进程、更多并行提高恢复与副作用去重难度。'],
  ['证据与验收','生成代码更快后，瓶颈转向“哪些结果可以相信、交付哪一个版本”。'],
  ['上下文来源与状态一致性','更多工具、子 Agent 与持续任务会产生更多互相冲突、过期的事实。'],
 ],
 'contract':{'goal':'add(2, 3) 应返回 5，保持公开 API','artifact':'workspace tree hash / commit SHA','required_checks':['发现并运行 test_calc.py','exit_code == 0','未修改验收脚本或公开 API'],'evidence':['check command + environment + stdout/stderr','artifact hash at check time','diff review result'],'status':'passed | failed | blocked | unknown','rule':'只有所要求的证据齐备且绑定当前产物，工作流才允许 deliver'},
 'tradeoff':'这是研究者提出的架构，不是任何一家的当前完整实现。验证器也可能错；开放目标往往需要人类验收。证据驱动的完成门槛能缩小错误面，不能承诺任意任务的绝对正确。'
}

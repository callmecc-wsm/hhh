/* Short, source-checked excerpts; page numbers are PDF pages in the pinned versions. */
window.READING_ROLES = ['提出方法或主张', '报告实验结果', '限定条件或承认局限'];
window.LEARNING = {
  attention: {
    terms:['BLEU','baseline','ablation'],
    passages:[
      {section:'Abstract',page:1,role:0,quote:'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',hint:'先找动词：propose 后面描述的是一个方案，还是一项测量？',explanation:'这是方法主张。新意在整个架构怎样移除循环与卷积，不是第一次使用 attention。“simple”是作者的定性描述。'},
      {section:'Abstract',page:1,role:1,quote:'Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task',hint:'圈出数值旁边的任务和指标，别只圈 28.4。',explanation:'这是报告结果。BLEU、WMT 2014、英译德共同限定了它的含义；一句话还没有交代可比预算或不确定性。'},
      {section:'Table 3 caption',page:9,role:2,quote:'All metrics are on the English-to-German translation development set, newstest2013.',hint:'注意 development set。它和 Table 2 的测试集相同吗？',explanation:'表注限制了比较范围。消融的 newstest2013 与主表的 newstest2014 不同，25.8 与 27.3 不能直接相减来解释组件贡献。'}
    ],
    probe:{title:'同样叫 BLEU，就能相减吗？',scenario:'一篇陌生论文报告：新系统在 Test-2025 上得 31.2 BLEU；移除模块后在 Dev-2024 上得 29.8 BLEU。其他信息暂未提供。',question:'你会给“该模块带来 1.4 BLEU 提升”怎样的评价？',options:['暂不支持；先补同一评估集、同配方的配对消融','基本支持；两个结果使用了同一种指标','只有差值超过 2 BLEU 才需要核对评估集'],correct:0,explain:'指标同名不意味着条件相同。评估集变化已足以阻止这个因果归因；需要控制训练、预算与测试集。',next:'要求作者补哪两行结果，才能作出更强判断？'}
  },
  scaling:{
    terms:['cross-entropy','power law','compute'],
    passages:[
      {section:'Abstract',page:1,role:0,quote:'The loss scales as a power-law with model size, dataset size, and the amount of compute used for training',hint:'这句话描述作者要支持的一般关系；它本身列出了观测点吗？',explanation:'这是经验规律主张。把 loss 换成“智能”会扩大结论；要继续查拟合区间、约束条件和误差。'},
      {section:'§1.2',page:4,role:2,quote:'For models with a limited number of parameters, trained to convergence on sufficiently large datasets:',hint:'trained to convergence 和 sufficiently large 都是适用条件。',explanation:'参数受限公式附带训练充分、数据足够的前提。数据不足时，不能机械套用这个公式解释曲线。'},
      {section:'§1.1',page:3,role:0,quote:'We expect that larger language models will perform better and be more sample efficient than current models.',hint:'expect 和 measure 表达的证据强度一样吗？',explanation:'这是基于观察作出的预期，语气不是已测得的普适结果。Introduction 里的展望不能自动升级为实验结论。'}
    ],
    probe:{title:'一条直线可以延伸多远？',scenario:'某研究在 10M–1B 参数模型上拟合出漂亮的双对数直线，用它预测 1T 参数模型的损失，没有报告中间规模的验证。',question:'下一步最有信息量的检查是什么？',options:['比较拟合线的颜色是否突出','要求补 10B、100B 等区间外观测，并检查训练瓶颈是否变化','只要 R² 大于 0.99，就把外推当成已验证结果'],correct:1,explain:'拟合良好是观测区间内的证据。跨数量级外推应面对新数据与约束变化；高 R² 不会验证尚未观测的区域。',next:'如果新增大模型偏离曲线，你会先检查数据、计算还是拟合假设？为什么？'}
  },
  gpt3:{
    terms:['few-shot','benchmark contamination','EM'],
    passages:[
      {section:'Abstract',page:1,role:2,quote:'For all tasks, GPT-3 is applied without any gradient updates or fine-tuning',hint:'它是在限定“怎么测”，还是在告诉你“测得多好”？',explanation:'这是评估条件：不更新权重。它帮助定义本文 few-shot 的含义，本身还不是性能证据。'},
      {section:'§2.2',page:9,role:2,quote:'Unfortunately, a bug in the filtering caused us to ignore some overlaps, and due to the cost of training it was not feasible to retrain the model.',hint:'这句话会怎样改变你对测试集独立性的信心？',explanation:'作者明确承认去重遗漏。后续污染分析可以诊断影响，但不能让已经发生的训练暴露消失。'},
      {section:'Figure 3.2 caption',page:12,role:2,quote:'Note zero-shot uses a different format from one-shot and few-shot as described in the text.',hint:'shot 数变化的同时，还有什么一起变了？',explanation:'提示格式是另一个变量。分差不能全部归因于示例数量，这是图注中容易遗漏的限制。'}
    ],
    probe:{title:'查不到重复，就是没污染？',scenario:'模型在公开问答集上提高了 8 个百分点。作者的去重只排除了逐字重复题目，但训练语料包含大量网页题解。',question:'哪一项最能加强“不是记忆题解”的证据？',options:['再展示十个公开测试集上的成功案例','只扩大逐字匹配的 n-gram 长度','使用训练截止后新编、难度匹配的题目，并检查题解和语义重叠'],correct:2,explain:'精确去重会漏掉改写、答案页和间接暴露。新构造题与独立审查更有力，但还需控制题目难度，避免把分布变化误认为污染效应。',next:'你如何让新题与旧题的难度尽可能可比？'}
  },
  chinchilla:{
    terms:['IsoFLOP','compute','confound'],
    passages:[
      {section:'Abstract',page:1,role:0,quote:'the model size and the number of training tokens should be scaled equally',hint:'should 是预算分配建议。它的目标是训练最优还是服务总成本最优？',explanation:'这是在特定目标下的经验建议。“同等比例扩展”不是参数个数等于 token 个数，也不是所有部署目标都最优。'},
      {section:'§4',page:9,role:2,quote:'Both Chinchilla and Gopher have been trained for the same number of FLOPs but differ in the size of the model and the number of training tokens.',hint:'固定了 FLOPs，是否同时固定了所有训练设置？',explanation:'这是主比较的预算约束。相同 FLOPs 很重要，但仍要继续查其他配方变化，才能决定能归因到什么粒度。'},
      {section:'§4.1',page:9,role:2,quote:'We use AdamW (Loshchilov and Hutter, 2019) for Chinchilla rather than Adam',hint:'把这项改动记在“同时改变的变量”里。',explanation:'优化器也变化了。因此大规模对照首先支持配方整体，而不是一个纯粹的“只增加 token”干预。'}
    ],
    probe:{title:'训练最优，就是部署最优？',scenario:'方案 A：训练花费 100，随后每百万次请求花费 10；方案 B：训练花费 130，每百万次请求花费 4。预期服务一千万次请求，质量相当。单位相同。',question:'只按这项全生命周期成本，应该选哪个？',options:['A，总成本 100，因为训练最省','B，总成本 170，低于 A 的 200','无法计算，因为模型参数量没有给出'],correct:1,explain:'一千万次请求等于十个百万次：A = 100 + 10×10 = 200；B = 130 + 4×10 = 170。最优依赖目标函数与需求规模。',next:'当请求量很小时，选择会不会反转？求出盈亏平衡点。'}
  },
  instruct:{
    terms:['RLHF','confidence interval','proxy'],
    passages:[
      {section:'Abstract',page:1,role:1,quote:'outputs from the 1.3B parameter InstructGPT model are preferred to outputs from the 175B GPT-3',hint:'这里被测量的是偏好、正确性，还是安全？',explanation:'这是偏好评估结果。必须补上评价者和提示分布，不能替换成“所有能力都超过 175B 模型”。'},
      {section:'Figure 1 caption',page:2,role:2,quote:'Error bars throughout the paper are 95% confidence intervals.',hint:'误差条类型属于结果，还是解释结果所需的约定？',explanation:'这是统计呈现的约定。还要查构造方式和抽样单位；95% 不是对某个已得到区间赋予“参数在内的概率”。'},
      {section:'Abstract',page:1,role:2,quote:'Even though InstructGPT still makes simple mistakes',hint:'作者有没有把偏好改善等同于彻底解决问题？',explanation:'这句话承认残余错误。把部分行为改善宣传为“已经完全对齐”，超出了作者报告的证据。'}
    ],
    probe:{title:'赢得偏好，是否等于更准确？',scenario:'在 200 次人工比较中，A 有 70% 被偏好。评审主要评价表达是否清楚、友善，研究没有单独核查事实。',question:'哪一种下一步最能支持“事实准确性提高”？',options:['由独立评审按可核验事实逐项评估，并与同题基线配对比较','把偏好率从 70% 换算为正确率','增加语气友善方面的标注者数量'],correct:0,explain:'事实准确性需要相应的测量。扩大原来的样本量能减小某些抽样误差，却无法修复指标与主张不匹配。',next:'如果准确性上升但偏好下降，你如何同时报告这两个结果？'}
  },
  react:{
    terms:['CoT','EM','cherry-picking'],
    passages:[
      {section:'Abstract',page:1,role:0,quote:'generate both reasoning traces and task-specific actions in an interleaved manner',hint:'interleaved 描述的是方法结构，不是成功率。',explanation:'核心主张是交替生成推理与动作。能看见文字轨迹，不代表已经证明轨迹忠实解释内部计算。'},
      {section:'§3.3',page:6,role:1,quote:'ReAct outperforms CoT on Fever (60.9 vs. 56.3) and slightly lags behind CoT on HotpotQA (27.4 vs. 29.4).',hint:'这句话同时报告了一次胜出和一次落后。',explanation:'这是有正有负的结果。只引用前半句会夸大适用性；也别把 slightly 当成统计检验。'},
      {section:'Table 2 caption',page:6,role:2,quote:'percentages in randomly selected examples studied by human.',hint:'比例的分母是完整测试集，还是人工检查的样本？',explanation:'这里限定的是错误分析样本。样本中的某类错误为零，不能推出系统在所有情境中绝不会出现该错误。'}
    ],
    probe:{title:'十条成功轨迹，够不够？',scenario:'新 Agent 论文展示十条流畅的成功轨迹。附录写明总计尝试 100 次，只展示最终成功的案例，没有提供失败分类。',question:'你最应该补充哪一项审查？',options:['要求把十条轨迹排版得更清楚','先核对完整成功分母、筛选规则、失败类型及同预算对照','只测量成功轨迹里的平均思维链长度'],correct:1,explain:'成功样例说明“可能做到”，无法独自估计可靠性。完整分母和选择机制是关键；还需检查反复重试是否计入成本。',next:'如果成功率从 10% 提到 20%，但每题重试十倍，这算哪一种进步？'}
  },
  toolformer:{
    terms:['API','ablation','proxy'],
    passages:[
      {section:'Abstract',page:1,role:0,quote:'This is done in a self-supervised way, requiring nothing more than a handful of demonstrations for each API.',hint:'self-supervised 是否等于没有人为定义的工具和示范？',explanation:'这句话主张低标注成本的学习方式，仍然需要每个 API 的示范、接口定义和筛选策略。“self”不意味着无前提。'},
      {section:'§4.1',page:5,role:2,quote:'The same model as Toolformer, but API calls are disabled during decoding.',hint:'同一个模型，只关闭了推理时的哪项能力？',explanation:'这是消融条件，帮助区分训练后权重与推理时外部工具的贡献。禁用调用也改变了解码行为，因此分差仍需谨慎解释。'},
      {section:'§4.2',page:6,role:2,quote:'at most one API call per input',hint:'这个限制允许验证长链工具规划吗？',explanation:'每个输入最多一次调用这一范围很窄。即使单次调用表现很好，也不是多轮规划、恢复和停止策略的证据。'}
    ],
    probe:{title:'提升来自工具，还是额外训练？',scenario:'系统 A 在底座模型上追加 20B token 工具数据训练，测试时能检索；系统 B 是未继续训练的底座模型。A 更好。',question:'哪组补充对照最能拆开两种来源？',options:['找一个比 B 更小的底座','再给 A 增加一种搜索工具','加入等量普通文本继续训练，并对同一工具模型开关检索'],correct:2,explain:'普通文本继续训练控制额外训练投入；同一工具模型开关检索接近检验推理时访问的贡献。还需注意训练语料选择与解码变化。',next:'你会怎样核查工具检索库是否包含测试答案？'}
  },
  sweagent:{
    terms:['pass@1','confound','benchmark contamination'],
    passages:[
      {section:'Abstract',page:1,role:0,quote:'We investigate how interface design affects the performance of language model agents.',hint:'把研究变量圈出来：作者到底在改模型权重，还是在改界面？',explanation:'这是研究问题与方法方向。系统成绩属于模型、界面和反馈共同组成的系统，不能全归功于底座。'},
      {section:'§5',page:5,role:1,quote:'12.47% (286/2,294) of the full SWE-bench test set and 18.00% (54/300) of the Lite split.',hint:'别漏掉括号里的成功数与总题数。',explanation:'两个分数对应不同分割与分母。Lite 18% 不是完整测试集 12.47% 的“后续提升”。'},
      {section:'§5',page:5,role:2,quote:'average performance variance is relatively low, but per-instance resolution can change considerably.',hint:'平均数稳定，是否意味着每次都解决同一批问题？',explanation:'逐任务结果可以大幅变化，即使平均成功率接近。可靠性审查应保留逐任务配对信息与重复运行。'}
    ],
    probe:{title:'解决率翻倍，意味着什么？',scenario:'同一批 100 个 issue 上，系统 A 一次尝试解决 20 个；系统 B 每题最多十次，最终解决 40 个。论文只给最终成功率。',question:'下列哪个判断最稳妥？',options:['B 的单次能力已经提升一倍','最终解决数增加，但还需同预算单次结果与总成本才能比较效率','B 没有任何价值，因为用了更多次数'],correct:1,explain:'40% 是重试策略下的最终成功率，不等于单次成功率。它可以有实际价值，但应同时报告预算、成本和尝试规则。',next:'怎样设计一张表，同时保留单次能力、重试收益和成本？'}
  },
  r1:{
    terms:['pass@1','cons@64','GRPO'],
    passages:[
      {section:'Abstract',page:1,role:2,quote:'without supervised fine-tuning (SFT) as a preliminary step',hint:'回到这一句的主语：是 R1-Zero，还是所有模型？',explanation:'这句话限定 R1-Zero 在 RL 前无 SFT。Zero 仍有预训练底座，完整 R1 则另有冷启动等阶段。'},
      {section:'§1',page:3,role:1,quote:'the pass@1 score on AIME 2024 increases from 15.6% to 71.0%',hint:'任务、指标和训练阶段是结果不可省略的部分。',explanation:'这是特定评估中的表现改善。它不能独自证明推理能力从无到有，也没有隔离所有采样因素。'},
      {section:'Abstract',page:1,role:2,quote:'DeepSeek-R1, which incorporates multi-stage training and cold-start data before RL.',hint:'把它和第一段对照：两个模型的训练流程相同吗？',explanation:'R1 的训练设置不同。不要把 R1-Zero 的“无需先做 SFT”与完整 R1 的最高成绩拼在一起，构造一个论文没做过的实验。'}
    ],
    probe:{title:'答案变多了，还是答案更容易采到？',scenario:'训练后，同样预算的 pass@1 从 20% 升到 50%，pass@64 仍为 85%。作者据此声称模型新增了大量以前完全不会的解题能力。',question:'这些结果更直接支持什么？',options:['正确答案更容易被单次采到；是否扩大能力覆盖还需逐题和更充分的采样检验','已经证明没有任何能力变化','已经证明模型获得了人类式反思'],correct:0,explain:'这组观测与重新分配已有答案的采样概率相容。pass@64 不变也不是“绝无新能力”的证明：估计误差、任务难度与逐题交替都要检查。',next:'你会补哪些逐题结果，区分新增覆盖与旧题采样概率提升？'}
  }
};
window.TERMS = {
'BLEU':['翻译相似度指标','按词片段重叠等因素计算，通常越高越好。它不是“回答正确的百分比”，也不能脱离分词和评估集直接比较。'],
'baseline':['对照方法','用来回答“相对什么变好了”。有意义的基线能排除额外数据、算力或提示变化等替代解释。'],
'ablation':['消融实验','移除或替换一个组件，观察结果怎样变化。先检查是否同时改变参数量、计算量与优化难度。'],
'cross-entropy':['交叉熵损失','模型给真实下一个 token 的概率越低，惩罚越大。平均损失下降，不代表每种下游能力都等比例提升。'],
'power law':['幂律','形如 y = a·xᵇ 的关系，在双对数坐标下呈直线。拟合直线不等于任意区间都成立。'],
'compute':['计算预算','训练 FLOPs、硬件时间、推理 token 和总费用不是同一个量。比较前先写清预算怎么计。'],
'few-shot':['少样本设置','可能指提示里提供几个例子，也可能指少量标注微调。必须看论文是否更新模型参数。'],
'benchmark contamination':['基准污染','测试题、答案或相近材料进入了训练或工具知识库。精确去重通常不能排除语义或题解暴露。'],
'EM':['完全匹配率','Exact Match：按数据集的匹配规则判定答案是否与标签一致。语义正确但格式不同也可能不匹配。'],
'IsoFLOP':['等计算量比较','把总训练 FLOPs 固定，再改变模型规模与 token 数。其他配方变化仍可能产生混杂。'],
'confound':['混杂变量','与目标变量同时改变、也可能影响结果的因素。它让“提升来自哪一项改动”难以确定。'],
'RLHF':['来自人类反馈的强化学习','通常用人工偏好训练奖励模型，再优化策略。奖励分是代理信号，不等于全部人类意图。'],
'confidence interval':['置信区间','指定程序在反复抽样下的覆盖性质。先查区间构造方法、采样单位与相关性。'],
'proxy':['代理指标','为了优化或评估而使用的可测信号。代理上升并不保证真正目标改善。'],
'CoT':['思维链提示','让模型生成中间文字步骤的方法。可见过程有助于检查，但并非天然忠实于内部计算。'],
'cherry-picking':['选择性展示','只报告最好任务、最好种子或成功案例，隐藏更完整的结果和选择过程。'],
'API':['程序接口','模型通过约定格式把参数交给外部工具，并读取返回结果。能接入不等于能可靠决定何时调用。'],
'pass@1':['单次通过率','一次采样通过任务验证的概率或其估计。要查采样温度、长度、验证器以及是否跨多次样本估计。'],
'cons@64':['64 次采样的共识','生成多次再聚合答案，不等同于一次作答，也不等同于“只要某次答对”的 pass@64。'],
'GRPO':['组相对策略优化','用同一问题的一组回答的相对奖励优化策略。奖励设计、采样预算和底座能力都会影响结果。']
};

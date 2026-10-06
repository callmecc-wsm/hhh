/** Connective copy for understanding-first learning arc. Does not replace original scenes/quizzes. */
export type ChapterNarrative = {
  hookTitle: string;
  hook: string;
  intuitionTitle: string;
  intuition: string[];
  labWatch: string[];
  labBridge: string;
  fromPrevious?: string;
  toNext?: string;
  /** Transitions shown before scenes[1]…scenes[5] (length 5). */
  sceneTransitions: string[];
  takeawaysTitle: string;
};

export const THROUGH_LINE = ['接下一词', '数据与表示', '注意力与结构', '损失与优化', '训练系统', '助手与产品', '验收'] as const;

/** Map chapter index 0–11 to through-line station index. */
export const chapterStation = [0, 1, 1, 2, 2, 2, 3, 3, 4, 5, 5, 6] as const;

const DEFAULT_TRANSITIONS = [
  '接着往下看，机制的下一环会接上。',
  '条件变化之后，结论也要一起更新。',
  '把局部现象放回整条训练链里。',
  '这一步解决的问题，是后面步骤的前提。',
  '收束边界：它解释了什么，又解释不了什么。',
];

const special: Record<number, ChapterNarrative> = {
  0: {
    hookTitle: '先想清楚一件事',
    hook: '你已经用过大模型：问一句，它回一段。但它并不是先想好整段话再吐出来——而是一次只决定「下一块」是什么。这一章要弄清：这个小动作，为什么能撑起整门课。',
    intuitionTitle: '从一个你能看见的例子开始',
    intuition: [
      '想象给机器四个字：「小猫坐在」。接下来更像「地毯」，还是「窗边」？你心里大概有偏向，机器给出的也是一排可能性，而不是神秘的灵感。',
      '选中其中一个词，接回句子，再问一次「接下来呢？」——每走一步，后面的路都会变。整段回答，就是这样一块一块接出来的。',
    ],
    labWatch: [
      '每点一次「生成」，新词怎样进入上下文',
      '概率条在上下文变长后有没有重新计算',
      '温度只改变抽样松紧；参数是否更新，是后面训练章的事',
    ],
    labBridge: '你刚看见的是自回归生成：输出接回输入，下一步的条件就变了。还没改任何参数——那是训练章节的事。',
    toNext: '下一站要弄清：这些文字怎样变成可计算的训练题，分词和标签错位各自管什么。',
    sceneTransitions: [
      '机器给的不是一个拍脑袋的词，而是一整排概率。先把这件事看清楚。',
      '选定一个词之后，故事还没结束——它会回到输入里，改变下一轮的条件。',
      '生成时后文还不存在；训练时答案已经写在原文里。这两种情境要分开。',
      '把镜头拉远：十二章就是从「接下一词」走到「能当助手并验收」的十二站。',
      '最后留一个边界：预测得通顺，不等于已经学会该学会的东西——还需要另外检验。',
    ],
    takeawaysTitle: '这一章带走什么',
  },
  1: {
    hookTitle: '先想清楚一件事',
    hook: '上一站看见了「接下一词」的循环。可训练时，模型面对的并不是你刚打的那句聊天，而是大量已经写好的文字。这一站要弄清：文字怎样变成一道道可计算的训练题。',
    intuitionTitle: '从一篇文章到一串编号',
    intuition: [
      '同一句话会被切成词元（token），再映射成整数编号。编号本身没有大小语义，只是查表用的索引。',
      '把同一串编号错开一位，就得到「输入 → 下一词目标」。数据脏了、泄漏了，后面的训练再漂亮也会骗人。',
    ],
    labWatch: [
      '哪一对相邻符号频次最高，就会被合并',
      '合并一次后，相邻关系和频次为什么要重算',
      '最终词表固定后，每个符号怎样落到一个 ID',
    ],
    labBridge: '你刚走完一遍迷你 BPE：高频相邻对被合并成更大的符号。真实分词器规则更多，但「频次驱动的合并」这一核心理解已经落地。',
    fromPrevious: '上一站：接下一词的循环，以及训练与生成的差别。',
    toNext: '下一站补线性代数直觉：向量和矩阵怎样改写表示，为注意力做准备。',
    sceneTransitions: [
      '分词规则定下来之后，每个符号还要变成可学习的向量——ID 只是门口的号码牌。',
      '有了编号序列，怎样自动长出「下一词」标签？关键是错开一位。',
      '标签对了，数据本身仍可能有坑：重复、泄漏、授权与隐私。',
      '分词器自己也要训练；它不该偷看专门留给评测的文本。',
      '把数据站收束成一张清单：清理、切分、编号、错位、隔离评测。',
    ],
    takeawaysTitle: '这一章带走什么',
  },
};

export function getNarrative(index: number, summary: string, task: string, deepTitle: string): ChapterNarrative {
  if (special[index]) return special[index];
  return {
    hookTitle: '先想清楚一件事',
    hook: summary,
    intuitionTitle: deepTitle || '先建立直觉',
    intuition: [summary, `这一章的实验目标：${task}`],
    labWatch: [`完成：${task}`, '操作时对照提示，先观察再下结论', '做完后用自己的话概括刚看见的机制'],
    labBridge: '实验把抽象计算变成了可观察的变化。下面用六节原理把因果链补全。',
    fromPrevious: index > 0 ? '接着上一站继续往前走。' : undefined,
    toNext: index < 11 ? '下一站会接上这条主线的下一环。' : undefined,
    sceneTransitions: DEFAULT_TRANSITIONS,
    takeawaysTitle: '这一章带走什么',
  };
}

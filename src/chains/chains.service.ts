import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  RunnableSequence,
  RunnablePassthrough,
} from '@langchain/core/runnables';
import { config } from '../config';
@Injectable()
export class ChainsService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: config.ollama.temperature,
    think: false,
  });
  private parser = new StringOutputParser();
  async polishArticle(article: string) {
    console.log('polishArticle', article);
    // ── 多步骤链：文章润色（分析问题 → 润色文章）──────────
    // RunnableSequence：把多个步骤组合成顺序链
    // RunnablePassthrough：透传输入值（用于在分叉步骤保留原始输入）
    const analyzePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，只输出问题列表，不要其他内容'],
      ['human', '请分析以下文章，找出问题：\n\n{article}'],
    ]);
    const polishPrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，根据问题列表润色原文，保持原意。'],
      [
        'human',
        '原文：\n{article}\n\n问题：\n{issues}\n\n请输出润色后的文章：',
      ],
    ]);
    // 第一条链
    const analyzeChain = analyzePrompt.pipe(this.llm).pipe(this.parser);
    console.log('analyzeChain', analyzeChain);
    // RunnableSequence：分两步执行
    // 步骤1：同时保留 article 原文 + 调用 analyzeChain 得到 issues
    // 步骤2：把 { article, issues } 传给 polishChain 润色
    const fullChain = RunnableSequence.from([
      {
        article: new RunnablePassthrough(), // 原文直接透传
        issues: analyzeChain, // 分析链得到问题列表
      },
      polishPrompt.pipe(this.llm).pipe(this.parser),
    ]);
    const result = await fullChain.invoke({ article });
    return { original: article, polished: result };
  }
  async generateBlog(keywords: string, style: string) {
    console.log('generateBlog', keywords, style);
    // 第一步生成大纲  第二部生成正文 第三部生成seo标题
    const outlineChain = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，只输出大纲。不要正文'],
      [
        'human',
        '根据关键词"{keywords}"，写一篇{style}风格的博客大纲（3-5个章节）',
      ],
    ])
      .pipe(this.llm)
      .pipe(this.parser);

    const contentChain = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，根据大纲生成博客文章。'],
      ['human', '大纲：\n{outline}\n\n请写一篇800字以内完整博客文章'],
    ])
      .pipe(this.llm)
      .pipe(this.parser);

    const seoTitleChain = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，根据博客文章生成5哥seo标题。'],
      ['human', '博客文章：\n{content}\n\n请生成seo标题'],
    ])
      .pipe(this.llm)
      .pipe(this.parser);

    const outline = await outlineChain.invoke({ keywords, style });
    const content = await contentChain.invoke({ outline });
    const seoTitle = await seoTitleChain.invoke({ content });
    return { keywords, style, outline, content, seoTitle };
  }
  async branch(question: string) {
    console.log('branch', question);
    // 第一步 分类 技术问题  退款问题 投诉建议  其它
    const classifyChain = ChatPromptTemplate.fromMessages([
      [
        'system',
        `
        分析用户问题，只输出分类标签：
        技术问题：TECH
        退款问题：REFUND
        投诉建议：COMPLAINT
        其它：OTHER
        `,
      ],
      ['human', '问题：\n{question}\n\n'],
    ])
      .pipe(this.llm)
      .pipe(this.parser);
    // 获取分类结果
    const category = await classifyChain.invoke({ question });
    // 第二部 根据分类选择对应 System Prompt 先定义一个map
    const systemPrompts = {
      TECH: '你是技术支持，负责解决用户的技术问题',
      REFUND: '你是退款专员，负责解决用户的退款问题',
      COMPLAINT: '你是客户服务，负责解决用户的投诉和建议',
      OTHER: '你是客服，负责解决用户的其他问题',
    };

    // 第三部 根据分类选择对应 System Prompt
    const systemPrompt = systemPrompts[category as keyof typeof systemPrompts];
    // 第四部 根据分类选择对应 System Prompt
    const answerChain = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['human', '问题：\n{question}\n\n'],
    ]);
    const result = await answerChain
      .pipe(this.llm)
      .pipe(this.parser)
      .invoke({ question });
    return {
      category,
      systemPrompt,
      answer: result,
    };
  }
}

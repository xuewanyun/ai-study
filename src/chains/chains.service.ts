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
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，根据关键字和风格生成博客文章。'],
      ['human', '请根据关键字和风格生成博客文章：\n\n{keywords}\n\n{style}'],
    ]);
    const chain = prompt.pipe(this.llm).pipe(this.parser);
    const result = await chain.invoke({ keywords, style });
    return result;
  }
}

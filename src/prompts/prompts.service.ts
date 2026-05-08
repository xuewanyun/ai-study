import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import {
  ChatPromptTemplate,
  PromptTemplate,
  FewShotPromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { config } from '../config';
@Injectable()
export class PromptsService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: config.ollama.temperature,
    think: false,
  });
  // ── ChatPromptTemplate：多消息对话模板（最常用）─────────
  // fromMessages 接收 [role, content] 数组
  // role 可以是 'system' | 'human' | 'ai'
  // content 里的 {变量名} 是占位符，invoke 时替换
  async translate(text: string, targetLang: string) {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业翻译人员，只输出翻译结果，不加任何解释。'],
      ['human', '请把以下内容翻译成{targetLang}语言：\n\n{text}'],
    ]);
    // 通过pipe把 prompt 和 llm 连接起来
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    console.log('chain', chain);
    const response = await chain.invoke({ text, targetLang });
    return {
      message: text,
      targetLang,
      response: response,
    };
  }
  // promptTemplate 单消息对话模板
  async count(text: string, maxWords: number) {
    const prompt = PromptTemplate.fromTemplate(
      '用不超过{maxWords}个字总结以下内容，只输出总结：\n\n{text}',
    );
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    const response = await chain.invoke({ text, maxWords });
    return {
      message: text,
      maxWords,
      response: response,
    };
  }
  // FewShotPromptTemplate
  async classifyText(text: string) {
    const examples = [
      { input: '这个产品太棒了！', output: '正面' },
      { input: '完全不值这个价格', output: '负面' },
      { input: '还可以吧，普通', output: '中性' },
      { input: '强烈推荐！超出预期', output: '正面' },
      { input: '很失望，不会再买了', output: '负面' },
    ];
    const exampleTemplate = PromptTemplate.fromTemplate(
      '输入：{input}\n输出：{output}',
    );
    const fewShotPrompt = new FewShotPromptTemplate({
      examples,
      examplePrompt: exampleTemplate,
      inputVariables: ['input'],
      suffix: '输入：{input}\n输出：',
      prefix: '分析文本情感，只输出：正面、负面、中性之一。\n\n示例：',
    });
    const formattedPrompt = await fewShotPrompt.format({ input: text });
    const response = await this.llm.invoke(formattedPrompt);
    return {
      message: text,
      response: String(response.content).trim(),
    };
  }
}

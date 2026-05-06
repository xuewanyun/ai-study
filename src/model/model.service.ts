import { Injectable } from '@nestjs/common';
import { config } from '../config';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Response } from 'express';
@Injectable()
export class ModelService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: config.ollama.temperature,
    think: false,
  });

  // 基础聊天模型
  async baseChat(message: string) {
    const response = await this.llm.invoke([new HumanMessage(message)]);
    return {
      message: message,
      response: response.content,
      usage: response.usage_metadata,
    };
  }
  // 带系统提示词的聊天模型
  async chatWithSystemPrompt(message: string, systemPrompt: string) {
    const response = await this.llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(message),
    ]);
    return {
      message: message,
      systemPrompt,
      response: response.content,
      usage: response.usage_metadata,
    };
  }
  // 流失聊天模型
  async chatStream(message: string, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const response = await this.llm.stream([new HumanMessage(message)]);
    for await (const chunk of response) {
      if (chunk.content) {
        res.write(`data: ${JSON.stringify({ text: chunk.content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }
  // 带解析器的流失聊天模型
  async chatWithParser(message: string) {
    // 三步 prompt -ollma -parser
    const chain = this.llm.pipe(new StringOutputParser());
    const response = await chain.invoke([new HumanMessage(message)]);
    return {
      message: message,
      response: response,
    };
  }
}

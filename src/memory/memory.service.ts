import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import {
  SystemMessage,
  BaseMessage,
  HumanMessage,
  AIMessage,
} from '@langchain/core/messages';
import { Response } from 'express';
import { config } from '../config';

@Injectable()
export class MemoryService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: config.ollama.temperature,
    think: false,
  });
  private memory: Map<string, BaseMessage[]> = new Map();
  private systemMessage = new SystemMessage(
    '你是一个智能助手，能记住对话历史，根据上下文准确回答。',
  );
  // 判断是getOrCreate
  private getOrCreateMemory(sessionId: string) {
    if (!this.memory.has(sessionId)) {
      this.memory.set(sessionId, [this.systemMessage]);
    }
    return this.memory.get(sessionId);
  }
  async chat(message: string, sessionId: string) {
    const history = this.getOrCreateMemory(sessionId);
    // 将用户消息加入历史
    history?.push(new HumanMessage(message));
    // 把完整历史发给模型（包含 System + 所有历史 + 本次消息）
    // 模型看到完整上下文，能理解之前说了什么
    const response = await this.llm.invoke(history as BaseMessage[]);
    // 将模型回复加入历史
    history?.push(new AIMessage(response.content));
    return {
      sessionId,
      message,
      reply: response.content,
      turns: Math.floor((history?.length ?? 0 - 1) / 2), // 对话轮次
    };
  }
  async chatStream(message: string, sessionId: string, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const history = this.getOrCreateMemory(sessionId);
    history?.push(new HumanMessage(message));
    let fullReply = '';
    const response = await this.llm.stream(history as BaseMessage[]);
    for await (const chunk of response) {
      if (chunk.content) {
        const text = String(chunk.content);
        fullReply += text;
        res.write(`data: ${JSON.stringify({ text, sessionId })}\n\n`);
      }
    }
    history?.push(new AIMessage(fullReply));
    res.write(
      `data: ${JSON.stringify({ text: '[DONE]', turns: Math.floor((history?.length ?? 0 - 1) / 2) })}\n\n`,
    );
    res.end();
    return {
      sessionId,
      message,
      reply: fullReply,
      turns: Math.floor((history?.length ?? 0 - 1) / 2),
    };
  }
  // 查看回话历史
  history(sessionId: string) {
    const history = this.getOrCreateMemory(sessionId);
    if (!history) {
      return {
        sessionId,
        history: [],
      };
    }
    const messages = history
      .filter((m) => !(m instanceof SystemMessage))
      .map((m, index) => {
        return {
          index: index + 1,
          role: m instanceof HumanMessage ? 'user' : 'assistant',
          content: m.content,
        };
      });
    return {
      sessionId,
      history: messages,
      exists: true,
      turns: Math.floor(messages.length / 2),
    };
  }
  // 查看所有回话
  all() {
    return {
      sessionId: Array.from(this.memory.entries()).map(
        ([sessionId, history]) => {
          return {
            sessionId,
            history: history.map((m) => m.content),
          };
        },
      ),
    };
  }
}

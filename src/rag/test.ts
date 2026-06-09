// src/langgraph/supervisor.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
  Annotation,
} from '@langchain/langgraph';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { config } from '../config';
import { AGENT_TOOLS, buildToolMap } from './agent-tools';

const MAX_TOOL_ROUNDS = 5;

const SupervisorState = Annotation.Root({
  messages: MessagesAnnotation.spec.messages,
  nextAgent: Annotation<string>(),
  completedAgents: Annotation<string[]>({
    reducer: (prev, curr) => [...prev, ...curr],
    default: () => [],
  }),
});

function messageContentToString(content: BaseMessage['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'string'
          ? part
          : 'text' in part && typeof part.text === 'string'
            ? part.text
            : '',
      )
      .join('');
  }
  return String(content ?? '');
}

@Injectable()
export class SupervisorService implements OnModuleInit {
  private graph: {
    invoke: (
      input: Partial<typeof SupervisorState.State>,
      config?: { recursionLimit?: number },
    ) => Promise<typeof SupervisorState.State>;
  };

  onModuleInit() {
    const llm = new ChatOllama({
      model: config.ollama.chatModel,
      baseUrl: config.ollama.baseUrl,
      temperature: 0,
      think: false,
    });

    const supervisor = async (state: typeof SupervisorState.State) => {
      const done = state.completedAgents.length
        ? `已完成：${state.completedAgents.join('、')}`
        : '尚未调用任何 Agent';

      const res = await llm.invoke([
        new SystemMessage(`你是任务协调者，管理以下专业 Agent（各自拥有专属工具）：
- researcher：收集信息；工具：天气查询、知识检索、当前时间
- analyst：数据分析；工具：计算器、统计摘要
- writer：撰写报告；工具：字数统计、报告排版

规则：
1. 根据任务需求按需选择 Agent
2. ${done}
3. 所有必要工作完成后输出 FINISH
4. 只输出下一个 Agent 名称或 FINISH，不要其他内容

可选值：researcher | analyst | writer | FINISH`),
        ...state.messages,
      ]);

      const next = messageContentToString(res.content).trim();
      const valid = ['researcher', 'analyst', 'writer', 'FINISH'];
      const safeNext = valid.includes(next) ? next : 'FINISH';

      return {
        nextAgent: safeNext,
        messages: [new AIMessage(`[Supervisor] 下一步 → ${safeNext}`)],
      };
    };

    const routeToAgent = (state: typeof SupervisorState.State) =>
      state.nextAgent === 'FINISH' ? END : state.nextAgent;

    const runWorkerWithTools = async (
      name: string,
      systemPrompt: string,
      tools: StructuredToolInterface[],
      state: typeof SupervisorState.State,
    ) => {
      const userMsg = state.messages.find(
        (m): m is HumanMessage => m._getType?.() === 'human',
      );
      const context = state.messages
        .slice(-6)
        .map((m) => messageContentToString(m.content))
        .join('\n');

      const toolNames = tools.map((t) => t.name).join('、');
      const toolMap = buildToolMap(tools);
      const llmWithTools = llm.bindTools(tools);

      const innerMessages: BaseMessage[] = [
        new SystemMessage(
          `${systemPrompt}

你可调用以下工具：${toolNames}。
- 需要真实数据时必须先调用工具，不要编造工具未返回的内容
- 工具调用完成后，用中文给出面向用户的结论`,
        ),
        new HumanMessage(
          `原始任务：${userMsg ? messageContentToString(userMsg.content) : ''}\n\n当前上下文：\n${context}`,
        ),
      ];

      const toolTraces: string[] = [];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await llmWithTools.invoke(innerMessages);
        innerMessages.push(response);

        if (!response.tool_calls?.length) {
          const answer = messageContentToString(response.content);
          const traceBlock = toolTraces.length
            ? `\n\n[工具调用记录]\n${toolTraces.join('\n')}`
            : '';
          return {
            messages: [
              new AIMessage(`[${name}] ${answer}${traceBlock}`),
              ...toolTraces.map((t) => new AIMessage(`[${name}:tool] ${t}`)),
            ],
            completedAgents: [name],
          };
        }

        for (const toolCall of response.tool_calls) {
          const toolFn = toolMap[toolCall.name];
          if (!toolCall.id) continue;

          if (!toolFn) {
            const err = `工具「${toolCall.name}」不存在`;
            toolTraces.push(`${toolCall.name} → 错误: ${err}`);
            innerMessages.push(
              new ToolMessage({ content: err, tool_call_id: toolCall.id }),
            );
            continue;
          }

          try {
            const result = await toolFn.invoke(toolCall.args);
            const resultStr =
              typeof result === 'string' ? result : JSON.stringify(result);
            toolTraces.push(
              `${toolCall.name}(${JSON.stringify(toolCall.args)}) → ${resultStr}`,
            );
            innerMessages.push(
              new ToolMessage({
                content: resultStr,
                tool_call_id: toolCall.id,
              }),
            );
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            toolTraces.push(
              `${toolCall.name}(${JSON.stringify(toolCall.args)}) → 错误: ${errMsg}`,
            );
            innerMessages.push(
              new ToolMessage({
                content: `执行失败: ${errMsg}`,
                tool_call_id: toolCall.id,
              }),
            );
          }
        }
      }

      return {
        messages: [
          new AIMessage(
            `[${name}] 已达工具调用轮次上限，请根据已有工具结果继续。${toolTraces.length ? `\n[工具调用记录]\n${toolTraces.join('\n')}` : ''}`,
          ),
          ...toolTraces.map((t) => new AIMessage(`[${name}:tool] ${t}`)),
        ],
        completedAgents: [name],
      };
    };

    const createWorker =
      (name: string, systemPrompt: string) =>
      async (state: typeof SupervisorState.State) =>
        runWorkerWithTools(name, systemPrompt, AGENT_TOOLS[name] ?? [], state);

    this.graph = new StateGraph(SupervisorState)
      .addNode('supervisor', supervisor)
      .addNode(
        'researcher',
        createWorker(
          'researcher',
          '你是研究员，擅长收集整理信息。涉及天气、背景资料、时间戳时请使用你的工具获取数据后再总结。',
        ),
      )
      .addNode(
        'analyst',
        createWorker(
          'analyst',
          '你是分析师，擅长数据分析与逻辑推理。涉及计算或统计指标时请使用计算器与统计工具，不要心算。',
        ),
      )
      .addNode(
        'writer',
        createWorker(
          'writer',
          '你是写作专家。成稿前可用字数统计控制篇幅，用排版工具生成 Markdown 报告结构。',
        ),
      )
      .addEdge(START, 'supervisor')
      .addConditionalEdges('supervisor', routeToAgent, {
        researcher: 'researcher',
        analyst: 'analyst',
        writer: 'writer',
        [END]: END,
      })
      .addEdge('researcher', 'supervisor')
      .addEdge('analyst', 'supervisor')
      .addEdge('writer', 'supervisor')
      .compile();
  }

  async run(userInput: string) {
    const result = await this.graph.invoke(
      { messages: [new HumanMessage(userInput)] },
      { recursionLimit: 30 },
    );

    const messages = result.messages;
    const agentLog = messages
      .filter((m) => typeof m.content === 'string' && m.content.startsWith('['))
      .map((m) => String(m.content));

    const toolLog = agentLog.filter((l) => l.includes(':tool]'));
    const writerOutputs = agentLog.filter(
      (l) => l.startsWith('[writer]') && !l.includes(':tool]'),
    );
    const finalReport = writerOutputs.length
      ? writerOutputs
          .at(-1)!
          .replace('[writer] ', '')
          .split('\n\n[工具调用记录]')[0]
      : (agentLog.filter((l) => !l.includes(':tool]')).at(-1) ?? '无输出');

    return {
      agentLog,
      toolLog,
      completedAgents: result.completedAgents,
      finalReport,
    };
  }
}

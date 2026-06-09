import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { StructuredToolInterface } from '@langchain/core/tools';

/** 仅允许数字与四则运算符号，避免任意代码执行 */
function safeCalculate(expression: string): number {
  const cleaned = expression.replace(/\s/g, '');
  if (!/^[\d+\-*/().]+$/.test(cleaned)) {
    throw new Error('表达式仅可包含数字与 + - * / ( )');
  }
  const value = Function(`"use strict"; return (${cleaned})`)() as unknown;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('计算结果无效');
  }
  return value;
}

// ── Researcher 工具 ─────────────────────────────────────

export const getWeatherTool = tool(
  async ({ city }: { city: string }) => {
    const mockWeather: Record<
      string,
      { temp: number; condition: string; humidity: number }
    > = {
      北京: { temp: 18, condition: '晴', humidity: 35 },
      上海: { temp: 22, condition: '多云', humidity: 65 },
      广州: { temp: 28, condition: '阵雨', humidity: 80 },
      深圳: { temp: 27, condition: '阴', humidity: 75 },
    };
    const data = mockWeather[city] ?? {
      temp: 20,
      condition: '晴',
      humidity: 50,
    };
    return JSON.stringify({
      city,
      temperature: `${data.temp}°C`,
      condition: data.condition,
      humidity: `${data.humidity}%`,
      source: '模拟天气 API',
      updatedAt: new Date().toLocaleString('zh-CN'),
    });
  },
  {
    name: 'get_weather',
    description: '查询指定城市的当前天气（温度、天气状况、湿度）',
    schema: z.object({
      city: z.string().describe('城市名称，如：北京、上海'),
    }),
  },
);

export const searchKnowledgeTool = tool(
  async ({ query }: { query: string }) => {
    const snippets: Record<string, string> = {
      人工智能:
        '人工智能（AI）是研究如何让机器模拟人类智能的计算机科学分支，涵盖机器学习、自然语言处理等领域。',
      区块链:
        '区块链是一种分布式账本技术，通过密码学保证数据不可篡改，常见于加密货币与供应链场景。',
    };
    const matched = Object.entries(snippets).find(([k]) =>
      query.includes(k),
    );
    return JSON.stringify({
      query,
      found: Boolean(matched),
      snippet:
        matched?.[1] ??
        `未找到「${query}」的精确条目，建议结合常识补充调研并标注不确定性。`,
      source: '模拟知识库',
    });
  },
  {
    name: 'search_knowledge',
    description: '在知识库中检索与主题相关的背景资料摘要',
    schema: z.object({
      query: z.string().describe('检索关键词或主题'),
    }),
  },
);

export const getCurrentTimeTool = tool(
  async ({ timezone }: { timezone?: string }) => {
    const now = new Date();
    return JSON.stringify({
      timezone: timezone ?? 'Asia/Shanghai',
      iso: now.toISOString(),
      local: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    });
  },
  {
    name: 'get_current_time',
    description: '获取当前日期与时间，用于调研报告的时间戳',
    schema: z.object({
      timezone: z
        .string()
        .optional()
        .describe('时区，默认 Asia/Shanghai'),
    }),
  },
);

// ── Analyst 工具 ────────────────────────────────────────

export const calculatorTool = tool(
  async ({ expression }: { expression: string }) => {
    const result = safeCalculate(expression);
    return JSON.stringify({ expression, result });
  },
  {
    name: 'calculator',
    description: '计算数学表达式，支持 + - * / 与括号，例如 (10+5)*2',
    schema: z.object({
      expression: z.string().describe('数学表达式'),
    }),
  },
);

export const statisticsTool = tool(
  async ({ numbers }: { numbers: number[] }) => {
    if (!numbers.length) {
      return JSON.stringify({ error: '数字列表不能为空' });
    }
    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / numbers.length;
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    const variance =
      numbers.reduce((acc, n) => acc + (n - mean) ** 2, 0) / numbers.length;
    return JSON.stringify({
      count: numbers.length,
      sum,
      mean: Number(mean.toFixed(4)),
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev: Number(Math.sqrt(variance).toFixed(4)),
    });
  },
  {
    name: 'statistics_summary',
    description: '对一组数字计算均值、中位数、最值、标准差等统计指标',
    schema: z.object({
      numbers: z.array(z.number()).describe('待分析的数字数组'),
    }),
  },
);

// ── Writer 工具 ───────────────────────────────────────────

export const wordCountTool = tool(
  async ({ text }: { text: string }) => {
    const chars = text.length;
    const charsNoSpace = text.replace(/\s/g, '').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split('\n').length;
    return JSON.stringify({ chars, charsNoSpace, words, lines });
  },
  {
    name: 'word_count',
    description: '统计文本字数、词数、行数，用于控制报告长度',
    schema: z.object({
      text: z.string().describe('待统计的文本'),
    }),
  },
);

export const formatReportTool = tool(
  async ({
    title,
    sections,
  }: {
    title: string;
    sections: { heading: string; content: string }[];
  }) => {
    const body = sections
      .map((s) => `## ${s.heading}\n\n${s.content}`)
      .join('\n\n');
    const markdown = `# ${title}\n\n${body}\n\n---\n*生成时间：${new Date().toLocaleString('zh-CN')}*`;
    return JSON.stringify({ title, markdown, sectionCount: sections.length });
  },
  {
    name: 'format_report',
    description:
      '将标题与各章节内容格式化为 Markdown 报告骨架，写作时优先调用此工具排版',
    schema: z.object({
      title: z.string().describe('报告标题'),
      sections: z
        .array(
          z.object({
            heading: z.string().describe('章节标题'),
            content: z.string().describe('章节正文'),
          }),
        )
        .describe('章节列表'),
    }),
  },
);

export const AGENT_TOOLS: Record<string, StructuredToolInterface[]> = {
  researcher: [getWeatherTool, searchKnowledgeTool, getCurrentTimeTool],
  analyst: [calculatorTool, statisticsTool],
  writer: [wordCountTool, formatReportTool],
};

export function buildToolMap(
  tools: StructuredToolInterface[],
): Record<string, StructuredToolInterface> {
  return Object.fromEntries(tools.map((t) => [t.name, t]));
}

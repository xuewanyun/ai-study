import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { tool } from '@langchain/core/tools';
import {
  SystemMessage,
  HumanMessage,
  ToolMessage,
  AIMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import { config } from '../config';
@Injectable()
export class AgentsService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: config.ollama.temperature,
    think: false,
  });
  private parser = new StringOutputParser();
  // 工具-检查订单
  private checkOrderTool = tool(
    async ({ productName }: { productName: string }) => {
      console.log(`[工具执行] check_product → 查询商品：${productName}`);
      // 先定义几个商品数据,map对象
      const products: Record<
        string,
        { price: number; stock: number; category: string }
      > = {
        'iPhone 16': { price: 10, stock: 100, category: '手机' },
        'iPhone 16 Pro': { price: 20, stock: 200, category: '手机' },
        'iPhone 16 Pro Max': { price: 30, stock: 300, category: '手机' },
        'MacBook Pro': { price: 40, stock: 400, category: '电脑' },
        'AirPods Pro': { price: 50, stock: 500, category: '耳机' },
      };
      const product = products[productName];
      if (!product) {
        return { success: false, data: '商品不存在' };
      }
      if (product.stock <= 0) {
        return { success: false, data: '商品库存不足' };
      }
      return `商品${productName}价格为${product.price}元，库存为${product.stock}件`;
    },
    {
      name: 'check_product',
      description:
        '查询商品是否有货、商品价格和库存数量。用户问"有没有XX"、"XX多少钱"、"XX有货吗"时调用。',
      schema: z.object({
        productName: z.string().describe('商品名称'),
      }),
    },
  );
  // 工具-创建订单 参数需要用户名、商品名称、数量、地址
  private createOrderTool = tool(
    async ({
      username,
      productName,
      quantity,
    }: {
      username: string;
      productName: string;
      quantity: number;
      address: string;
    }) => {
      console.log(
        `[工具执行] create_order → 创建订单：${username} ${productName} ${quantity} `,
      );
      // 先模拟数据
      const prices: Record<string, number> = {
        'iPhone 16 ': 5999,
        'iPhone 16 Pro ': 6999,
        'iPhone 16 Pro Max': 7999,
        'MacBook Pro': 12000,
        'AirPods Pro': 2999,
      };
      // 单价
      const price = prices[productName];
      // 获取总价
      const totalPrice = price * quantity;
      // 生成订单号
      const orderId = `ORD-${Date.now().toString().slice(-6)}`;
      return `订单${orderId}创建成功，商品${productName}数量${quantity}，单价${price}元，总价${totalPrice}元`;
    },
    {
      name: 'create_order',
      description:
        '为客户创建购买订单。需要知道商品名称、购买数量、客户姓名才能下单。用户说"我要买XX"、"帮我下单"时调用。',
      schema: z.object({
        username: z.string().describe('用户名'),
      }),
    },
  );
  // 工具-查询订单状态
  private queryOrderTool = tool(
    async ({ orderId }: { orderId: string }) => {
      console.log(`[工具执行] query_order → 查询订单：${orderId}`);
      // 模拟订单状态
      const statuses = ['待支付', '已支付待发货', '已发货运输中', '已签收'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const extra = status === '已发货运输中' ? '，预计明天送达' : '';

      return `订单 ${orderId} 当前状态：${status}${extra}。`;
    },
    {
      name: 'query_order',
      description:
        '查询订单的当前状态。用户说"我的订单"、"订单到哪了"、"查一下订单 ORD-XXX"时调用。',
      schema: z.object({
        orderId: z.string().describe('订单号'),
      }),
    },
  );
  // 工具-申请退款
  private refundTool = tool(
    async ({ orderId, reason }: { orderId: string; reason: string }) => {
      console.log(`[工具执行] refund → 申请退款：${orderId}`);
      const refundId = `REF-${Date.now().toString().slice(-6)}`;
      return `退款申请已提交！退款单号：${refundId}，订单：${orderId}，退款原因：${reason}。预计 1-3 个工作日内退回原支付渠道，请注意查收。`;
    },
    {
      name: 'refund',
      description: '申请退款。用户说"我要退款"、"帮我退款"时调用。',
      schema: z.object({
        orderId: z.string().describe('订单号'),
        reason: z.string().describe('退款原因，如商品质量问题、错发漏发等'),
      }),
    },
  );
  async run(question: string) {
    const tools = [
      this.checkOrderTool,
      this.createOrderTool,
      this.queryOrderTool,
      this.refundTool,
    ];
    const toolMap: Record<string, any> = {
      check_product: this.checkOrderTool,
      create_order: this.createOrderTool,
      query_order: this.queryOrderTool,
      refund: this.refundTool,
    };
    // bindTools：把工具列表注册到模型
    // 注册后模型回复里会包含 tool_calls 字段（当它决定调用工具时）
    const modelWithTools = this.llm.bindTools(tools);

    const messages: any = [
      new SystemMessage(`你是「极速购」电商平台的 AI 智能客服助手。你可以使用一下工具帮助客户
        -check_product:查询商品库存和价格
        -create_order:创建订单
        -query_order:查询订单状态
        -refund:申请退款
        工作原则
        1：先用工具获取真实信息，再给客户答复
        2：下单前必须先查询库存确认有货
        3：下单需要知道用户姓名，如果客户没有提供，主动询问
        4：回答简介友好，使用中午
        `),
      new HumanMessage(question),
    ];
    // 记录每步执行过程（用于前端展示 / 课程演示）
    const steps: string[] = [];
    let roundCount = 0;
    // ── Agent 循环 ──────────────────────────────────────
    // 每一轮：模型看消息历史 → 决定调用工具还是直接回答
    // 直到模型不再调用工具为止（最多 6 轮，防止死循环）
    while (roundCount < 6) {
      roundCount++;
      console.log('==========messages', messages);
      const response = await modelWithTools.invoke(messages);
      console.log('response', response);
      steps.push(`[轮 ${roundCount}] 模型回复：${response.content}`);
      messages.push(response);
      if (!response.tool_calls || response.tool_calls.length === 0) {
        steps.push(`💬 [最终回答] ${response.content}`);
        break;
      }
      // 模型决定调用工具，依次执行所有工具调用
      for (const toolCall of response.tool_calls) {
        steps.push(
          `🔧 [调用工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`,
        );
        console.log(`[工具调用] ${toolCall.name}`, toolCall.args);

        const toolFn = toolMap[toolCall.name];
        if (!toolCall.id) {
          throw new Error('toolCall.id 为 undefined');
        }
        if (!toolFn) {
          const errMsg = `工具「${toolCall.name}」不存在`;
          steps.push(`❌ [错误] ${errMsg}`);
          messages.push(
            new ToolMessage({ content: errMsg, tool_call_id: toolCall.id }),
          );
          continue;
        }

        // 执行工具，获取结果
        const toolResult = await toolFn.invoke(toolCall.args);
        steps.push(`✅ [工具结果] ${toolResult}`);
        console.log(`[工具结果] ${toolResult}`);

        // 把工具结果加入消息历史
        // 模型下一轮看到结果后，再决定继续调工具还是直接回答
        messages.push(
          new ToolMessage({
            content: JSON.stringify(toolResult),
            tool_call_id: toolCall.id,
          }),
        );
      }
    }
    // 获取最终回答（最后一条 AIMessage 的内容）

    const lastAI = [...messages].reverse().find((m) => m instanceof AIMessage);
    console.log('messages', messages);

    return {
      question,
      steps, // 完整思考和执行步骤（录视频演示重点）
      totalRounds: roundCount,
      answer: lastAI?.content ?? '抱歉，暂时无法处理您的请求',
    };
  }
}

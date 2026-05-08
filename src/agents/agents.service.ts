import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { tool } from '@langchain/core/tools';
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
        'iPhone 16 ': { price: 10, stock: 100, category: '手机' },
        'iPhone 16 Pro ': { price: 20, stock: 200, category: '手机' },
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
  async run(question: string) {}
}

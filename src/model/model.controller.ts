import { Body, Controller, Post, Res } from '@nestjs/common';
import { ModelService } from './model.service';
import type { Response } from 'express';

@Controller('model')
export class ModelController {
  constructor(private readonly modelService: ModelService) {}
  // 基础聊天模型
  @Post('chat')
  baseChat(@Body() body: { message: string }) {
    return this.modelService.baseChat(body.message);
  }
  // 带系统提示词的聊天模型
  @Post('chat-system')
  chatWithSystemPrompt(
    @Body() body: { message: string; systemPrompt: string },
  ) {
    return this.modelService.chatWithSystemPrompt(
      body.message,
      body.systemPrompt,
    );
  }
  // 流失聊天模型
  @Post('chat-stream')
  chatStream(@Body() body: { message: string }, @Res() res: Response) {
    return this.modelService.chatStream(body.message, res);
  }
}

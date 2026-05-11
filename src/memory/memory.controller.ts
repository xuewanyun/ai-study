import { Controller, Post, Body, Res, Get } from '@nestjs/common';
import { MemoryService } from './memory.service';
import type { Response } from 'express';
@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}
  // ── 多轮对话（REST 版本）──────────────────────────────
  @Post('chat')
  chat(@Body() body: { message: string; sessionId: string }) {
    return this.memoryService.chat(body.message, body.sessionId);
  }
  // chatStream
  @Post('chatStream')
  chatStream(
    @Body() body: { message: string; sessionId: string },
    @Res() res: Response,
  ) {
    return this.memoryService.chatStream(body.message, body.sessionId, res);
  }
  // 查看回话历史
  @Get('history')
  history(@Body() body: { sessionId: string }) {
    return this.memoryService.history(body.sessionId);
  }
  // 查看所有回话
  @Get('all')
  all() {
    return this.memoryService.all();
  }
}

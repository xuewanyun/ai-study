import { Body, Controller, Post } from '@nestjs/common';
import { PromptsService } from './prompts.service';

@Controller('prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  // 翻译功能
  @Post('translate')
  translate(@Body() body: { text: string; targetLang: string }) {
    return this.promptsService.translate(body.text, body.targetLang);
  }
  // 统计次数
  @Post('count')
  count(@Body() body: { text: string; maxWords: number }) {
    return this.promptsService.count(body.text, body.maxWords);
  }
  @Post('classify')
  classify(@Body() body: { text: string }) {
    return this.promptsService.classifyText(body.text);
  }
}

import { Controller, Post, Body } from '@nestjs/common';
import { AgentsService } from './agents.service';
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}
  // 运行任务

  @Post('run')
  run(@Body() body: { question: string }) {
    return this.agentsService.run(body.question);
  }
}

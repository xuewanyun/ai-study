import { Controller, Body, Get, Post, Query } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('search')
  search(@Query() query: { question: string; topK: number }) {
    return this.ragService.search(query.question, query.topK);
  }
  // 加载文档
  @Post('loadDocuments')
  loadDocuments(
    @Body()
    body: {
      documents: { id: string; content: string; source?: string }[];
    },
  ) {
    return this.ragService.loadDocuments(body.documents);
  }
  // ── 完整 RAG 问答 ─────────────────────────────────────
  @Post('query')
  query(@Body() body: { question: string; topK: number }) {
    return this.ragService.query(body.question, body.topK);
  }
}

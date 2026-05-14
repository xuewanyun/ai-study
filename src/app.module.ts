import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { PostModule } from './post/post.module';
import { ModelModule } from './model/model.module';
import { PromptsModule } from './prompts/prompts.module';
import { ChainsModule } from './chains/chains.module';
import { AgentsService } from './agents/agents.service';
import { AgentsController } from './agents/agents.controller';
import { AgentsModule } from './agents/agents.module';
import { MemoryModule } from './memory/memory.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    PostModule,
    ModelModule,
    PromptsModule,
    ChainsModule,
    AgentsModule,
    MemoryModule,
    RagModule,
  ],
  providers: [AgentsService],
  controllers: [AgentsController],
})
export class AppModule {}

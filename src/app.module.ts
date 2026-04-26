import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { PostModule } from './post/post.module';
import { ModelModule } from './model/model.module';
import { PromptsModule } from './prompts/prompts.module';
import { ChainsModule } from './chains/chains.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    PostModule,
    ModelModule,
    PromptsModule,
    ChainsModule,
  ],
})
export class AppModule {}

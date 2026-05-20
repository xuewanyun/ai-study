import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
// import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  DistanceStrategy,
  PGVectorStore,
} from '@langchain/community/vectorstores/pgvector';
import { config } from '../config';
import { Pool } from 'pg';

// 将向量存到内存

@Injectable()
export class RagService implements OnModuleInit, OnModuleDestroy {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.baseUrl,
    think: false,
  });
  private embeddings = new OllamaEmbeddings({
    model: config.ollama.embedModel,
    baseUrl: config.ollama.baseUrl,
  });
  private docCount: number = 0;
  private stringParser = new StringOutputParser();
  // 配置连接器(在模块初始化时建立数据库连接)
  private pool: Pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    // 空闲连接超时时间
    idleTimeoutMillis: 30000,
    // 连接超时时间
    connectionTimeoutMillis: 2000,
  });
  // 配置vector
  private pgVectorConfig = {
    pool: this.pool,
    collectionName: 'rag-knowledge-base',
    collectionTableName: 'langchain_pg_collection',
    tableName: 'langchain_pg_embedding',
    columns: {
      idColumnName: 'id',
      vectorColumnName: 'embedding',
      contentColumnName: 'document',
      metadataColumnName: 'cmetadata',
    },
    distanceStrategy: 'cosine' as DistanceStrategy,
  };
  private vectorStore: PGVectorStore | null = null;
  async onModuleInit() {
    const vectorStore = await PGVectorStore.initialize(
      this.embeddings,
      this.pgVectorConfig,
    );
    this.vectorStore = vectorStore ?? [];
    console.log('vectorStore', vectorStore);
  }
  async onModuleDestroy() {
    await this.pool.end();
    console.log('RagService：PostgreSQL 连接池已关闭');
  }
  // 加载文档
  async loadDocuments(
    documents: { id: string; content: string; source?: string }[],
  ) {
    // 第一部 文本分块
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', ' 。', '！', '？', ' ', ','],
    });
    const allDocs: Document[] = [];
    for (const doc of documents) {
      const chucks = await textSplitter.createDocuments(
        [doc.content],
        [{ source: doc.source, docId: doc.id }],
      );
      allDocs.push(...chucks);
    }
    // 将这些文档向量化 存入向量库
    await PGVectorStore.fromDocuments(
      allDocs,
      this.embeddings,
      this.pgVectorConfig,
    );
    this.docCount += documents.length;
    return {
      success: true,
      originalDocs: documents.length,
      totalChunks: allDocs.length,
      message: `加载 ${documents.length} 篇文档，共 ${allDocs.length} 个块`,
    };
  }
  async search(question: string, topK: number) {
    // 使用向量搜索 similaritySearchWithScore
    const results = await this.vectorStore?.similaritySearchWithScore(
      question,
      topK,
    );
    console.info('results', results);
    return {
      question,
      results: results?.map(([doc, score]) => ({
        content: doc.pageContent,
        source: doc.metadata.source,
        similarity: parseFloat((1 - score).toFixed(4)),
        rawDistance: parseFloat(score.toFixed(4)),
      })),
    };
  }
  async query(question: string, topK: number) {
    // Step 1：检索相关文档块
    const retrieved = await this.vectorStore?.similaritySearchWithScore(
      question,
      topK,
    );
    console.info('results', retrieved);
    const filtered = retrieved?.filter(([, score]) => score <= 0.5);

    if (!filtered?.length) {
      return { question, answer: '知识库中没有找到相关内容', sources: [] };
    }

    // Step 2：把检索结果拼成 context 字符串
    // [1] 第一块内容\n\n[2] 第二块内容...
    // 编号方便模型在回答时引用："根据[1]..."
    const context = filtered
      .map(([doc], i) => `[${i + 1}] ${doc.pageContent}`)
      .join('\n\n');
    console.info('context', context);
    // Step 3：RAG Prompt，严格限制模型只能用参考资料回答
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `
        你是知识库问答助手，严格基于参考资料回答。
        规则：
        1. 只根据参考资料内容回答，不能使用资料外的知识
        2. 资料中没有相关信息，回答"知识库中暂无相关内容"
        3. 回答简洁准确，使用中文
        参考资料
        {context}
        `,
      ],
      ['human', '{question}'],
    ]);
    // step4
    const chain = prompt.pipe(this.llm).pipe(this.stringParser);
    const answer = await chain.invoke({ context, question });
    console.info('answer', answer);
    return {
      question,
      answer,
      sources: filtered.map(([doc, score]) => ({
        content: doc.pageContent,
        source: doc.metadata.source,
        similarity: parseFloat((1 - score).toFixed(4)),
      })),
    };
  }
}

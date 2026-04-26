export const config = {
  ollama: {
    // Ollama 服务地址，默认本机 11434 端口
    baseUrl: 'http://localhost:11434',
    // 聊天模型，默认 qwen3.5:0.8b
    chatModel: 'qwen3.5:0.8b',
    //向量化模型：mxbai-embed-large（RAG 检索用，约 669MB）
    // 拉取命令：ollama pull mxbai-embed-large
    embedModel: 'mxbai-embed-large',
    temperature: 0.3,
  },
};

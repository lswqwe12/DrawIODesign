/**
 * AI 面板功能模式
 */
export type AIMode = "interpret" | "generate";

/**
 * AI 流式输出分块
 * - start: 流开始
 * - content: 文本内容增量
 * - end: 流结束（生成模式下可能携带完整 xml 片段）
 * - error: 错误终止
 */
export interface AIStreamChunk {
  type: "start" | "content" | "end" | "error";
  content?: string;
  xml?: string; // 生成图表时，最终携带的完整 <mxCell> 片段
  error?: string;
}

/**
 * 对话消息
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: AIMode;
  xml?: string; // 生成模式下携带的最终 mxCell 片段
  createdAt: number;
}

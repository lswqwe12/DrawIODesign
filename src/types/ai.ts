/**
 * AI 面板功能模式
 */
export type AIMode = "interpret" | "generate";

/**
 * 生成目标：当前文件（迭代修改）或 新建文件（一次性生成）
 */
export type GenerateTarget = "current" | "new";

/**
 * 发送给大模型的对话消息（服务端代理与客户端直连共用）。
 * content 支持纯文本或多模态内容（文本 + 图片）。
 */
export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

/**
 * AI 请求参数（服务端代理与客户端直连共用）。
 */
export interface AIRequestOptions {
  mode: AIMode;
  prompt: string;
  xml?: string; // interpret 模式：xmlsvg 导出得到的图表 XML
  image?: string; // interpret 模式：缩放后的 PNG data URL（备用）
  currentXml?: string; // generate 迭代模式：当前图表的 mxCell 片段（增量修改上下文）
  diagramType?: string; // generate 模式：图表类型（类图/时序图/用例图/流程图/ER 图等）
}

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
  error?: boolean; // 该消息是否以错误/失败结束（用于渲染「重试」按钮）
  thinking?: boolean; // 是否正在等待模型返回（渲染「正在思考」转圈指示器）
  createdAt: number;
}

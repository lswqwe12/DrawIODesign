/**
 * 客户端直连 DeepSeek 的流式调用（用于 GitHub Pages 等纯静态部署）。
 *
 * 背景：静态导出（output: "export"）无法运行 /api/ai/* 服务端代理，因此静态
 * 部署时由浏览器直接请求 DeepSeek 的 chat/completions 接口（DeepSeek 已开启 CORS）。
 * 所需配置通过 NEXT_PUBLIC_* 构建期环境变量注入（会被 Next.js 内联进客户端 bundle）。
 *
 * 安全提示：NEXT_PUBLIC_DEEPSEEK_API_KEY 会暴露在浏览器 bundle 中，任何人可读取。
 * 仅适合比赛演示等低风险场景；生产环境请改用服务端代理（将 NEXT_PUBLIC_DEEPSEEK_BASE_URL
 * 指向自建的 OpenAI 兼容代理，并把密钥保留在服务端）。
 */
import type { AIRequestOptions, AIStreamChunk, LLMMessage } from "@/types/ai";
import { buildGenerateMessages, buildInterpretMessages } from "@/lib/aiPrompts";
import { sanitizeGeneratedCells } from "@/lib/xml-helper";

/** 是否配置了客户端直连所需的 API Key */
export function hasClientAIKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY);
}

const BASE_URL =
  process.env.NEXT_PUBLIC_DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.NEXT_PUBLIC_DEEPSEEK_MODEL || "deepseek-chat";

/** 解析 DeepSeek 返回的错误体（兼容 {error:{message}} 与 {error: string}） */
function extractErrorMessage(status: number, text: string): string {
  let detail = "";
  try {
    const data = JSON.parse(text) as {
      error?: { message?: string } | string;
    };
    if (typeof data.error === "string") detail = data.error;
    else if (data.error?.message) detail = data.error.message;
  } catch {
    // 非 JSON 错误体，忽略
  }
  return `请求失败 (${status})${detail ? `：${detail}` : ""}`;
}

/**
 * 直连 DeepSeek 并流式解析，逐块回调 AIStreamChunk。
 * generate 模式在流结束时附带清洗后的 xml 片段（等价原服务端 onEnd 逻辑）。
 */
export async function streamAIDirect(
  options: AIRequestOptions,
  onChunk: (chunk: AIStreamChunk) => void,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 NEXT_PUBLIC_DEEPSEEK_API_KEY，无法直连 DeepSeek");
  }

  let messages: LLMMessage[];
  let temperature: number;
  if (options.mode === "generate") {
    const built = buildGenerateMessages(
      options.prompt,
      options.currentXml ?? "",
      options.diagramType ?? ""
    );
    messages = built.messages;
    temperature = built.temperature;
  } else {
    messages = buildInterpretMessages(
      options.prompt,
      options.xml ?? "",
      options.image ?? ""
    );
    temperature = 0.7;
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      temperature,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(extractErrorMessage(res.status, text));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  onChunk({ type: "start" });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let json: { choices?: { delta?: { content?: string } }[] };
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }
      const delta = json.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        fullText += delta;
        onChunk({ type: "content", content: delta });
      }
    }
  }

  if (options.mode === "generate") {
    onChunk({
      type: "end",
      content: fullText,
      xml: sanitizeGeneratedCells(fullText),
    });
  } else {
    onChunk({ type: "end", content: fullText });
  }
}

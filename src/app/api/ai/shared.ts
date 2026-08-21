/**
 * AI 路由共享工具（仅服务端使用，禁止在客户端 import）。
 * 负责调用 DeepSeek 流式接口，并把上游 SSE 转换为前端约定的 AIStreamChunk SSE。
 */
import type { AIStreamChunk, LLMMessage } from "@/types/ai";

export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
export const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

/** interpret 图片字段大小上限（9MB） */
export const MAX_IMAGE_BYTES = 9 * 1024 * 1024;

export type { LLMMessage };

interface DeepSeekChunk {
  choices?: { delta?: { content?: string } }[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function sse(chunk: AIStreamChunk): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);
}

function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * 调用 DeepSeek 流式接口，并返回可直接交给前端的 SSE Response。
 * @param messages 对话消息
 * @param onEnd 流结束后基于完整文本生成 end 分块的补充字段（generate 模式用于提取 xml）
 * @param opts temperature 等上游采样参数（迭代修改时调低，减少整图重建）
 */
export async function createAIStream(
  messages: LLMMessage[],
  onEnd?: (fullText: string) => Partial<AIStreamChunk>,
  opts?: { temperature?: number }
): Promise<Response> {
  if (!DEEPSEEK_API_KEY) {
    return errorResponse("服务端未配置 DEEPSEEK_API_KEY");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        stream: true,
        temperature: opts?.temperature ?? 0.7,
      }),
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? `调用 LLM 失败：${err.message}` : "调用 LLM 失败"
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return errorResponse(
      `LLM 返回错误 (${upstream.status})${text ? `：${text.slice(0, 200)}` : ""}`,
      upstream.status
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(sse({ type: "start" }));
        const reader = upstream.body!.getReader();
        let buffer = "";
        let fullText = "";
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
            let json: DeepSeekChunk;
            try {
              json = JSON.parse(payload) as DeepSeekChunk;
            } catch {
              continue;
            }
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              fullText += delta;
              controller.enqueue(sse({ type: "content", content: delta }));
            }
          }
        }
        controller.enqueue(
          sse({ type: "end", content: fullText, ...(onEnd ? onEnd(fullText) : {}) })
        );
        controller.close();
      } catch (err) {
        controller.enqueue(
          sse({
            type: "error",
            error: err instanceof Error ? err.message : "流式输出失败",
          })
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

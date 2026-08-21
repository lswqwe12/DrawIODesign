"use client";

import type { AIMode, AIStreamChunk } from "@/types/ai";

export interface AIRequestOptions {
  mode: AIMode;
  prompt: string;
  xml?: string; // interpret 模式：xmlsvg 导出得到的图表 XML
  image?: string; // interpret 模式：缩放后的 PNG data URL（备用）
  currentXml?: string; // generate 迭代模式：当前图表的 mxCell 片段（增量修改上下文）
  diagramType?: string; // generate 模式：图表类型（类图/时序图/用例图/流程图/ER 图等）
}

const ENDPOINTS: Record<AIMode, string> = {
  interpret: "/api/ai/interpret",
  generate: "/api/ai/generate",
};

/**
 * 调用 AI 路由并逐块解析 SSE（data: <json>\n\n），
 * 每解析到一个 AIStreamChunk 就回调 onChunk。
 */
export async function streamAI(
  options: AIRequestOptions,
  onChunk: (chunk: AIStreamChunk) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(ENDPOINTS[options.mode], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: options.prompt,
      xml: options.xml,
      image: options.image,
      currentXml: options.currentXml,
      diagramType: options.diagramType,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // 忽略非 JSON 错误体
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
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
      try {
        onChunk(JSON.parse(payload) as AIStreamChunk);
      } catch {
        // 忽略无法解析的分块
      }
    }
  }
}

/**
 * 将图片 data URL 用 Canvas 缩放到 maxWidth 宽度（保持宽高比），返回 PNG data URL。
 * 用于 interpret 走 PNG 路径时，在转 Base64 前降低体积（默认 1200px 宽）。
 */
export function scaleImage(dataUrl: string, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 上下文不可用"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = dataUrl;
  });
}

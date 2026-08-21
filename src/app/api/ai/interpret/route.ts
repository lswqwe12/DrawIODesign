import { NextRequest } from "next/server";
import { createAIStream, MAX_IMAGE_BYTES } from "../shared";
import { buildInterpretMessages } from "@/lib/aiPrompts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { prompt?: unknown; xml?: unknown; image?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "请求体不是合法的 JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const xml = typeof body.xml === "string" ? body.xml.trim() : "";
  const image = typeof body.image === "string" ? body.image.trim() : "";

  if (!prompt) {
    return new Response(JSON.stringify({ error: "缺少 prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!xml && !image) {
    return new Response(
      JSON.stringify({ error: "缺少图表内容（xml 或 image）" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 图片过大（超过 9MB）直接返回 413
  if (image && image.length > MAX_IMAGE_BYTES) {
    return new Response(JSON.stringify({ error: "图片过大（超过 9MB）" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 提示词构建逻辑与客户端直连共用（src/lib/aiPrompts.ts）
  const messages = buildInterpretMessages(prompt, xml, image);

  return createAIStream(messages);
}

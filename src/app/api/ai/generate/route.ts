import { NextRequest } from "next/server";
import { createAIStream } from "../shared";
import { buildGenerateMessages } from "@/lib/aiPrompts";
import { sanitizeGeneratedCells } from "@/lib/xml-helper";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { prompt?: unknown; currentXml?: unknown; diagramType?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "请求体不是合法的 JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return new Response(JSON.stringify({ error: "缺少 prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const currentXml =
    typeof body.currentXml === "string" ? body.currentXml : "";
  const diagramType =
    typeof body.diagramType === "string" ? body.diagramType.trim() : "";

  // 提示词构建逻辑与客户端直连共用（src/lib/aiPrompts.ts）
  const { messages, temperature } = buildGenerateMessages(
    prompt,
    currentXml,
    diagramType
  );

  return createAIStream(
    messages,
    (fullText) => ({ xml: sanitizeGeneratedCells(fullText) }),
    { temperature }
  );
}

import { NextRequest } from "next/server";
import { createAIStream, MAX_IMAGE_BYTES, type LLMMessage } from "../shared";

export const runtime = "nodejs";

const INTERPRET_SYSTEM_PROMPT = `你是一名专业的 UML / 软件设计图分析师。用户会提供一段 draw.io 的 XML（<mxfile> 结构），其中每个 <mxCell> 节点的 value 属性是标签文本、style 属性描述形状与样式、vertex 表示节点、edge 表示连线（含 source/target）。

请根据 XML 内容，用简洁的中文分点解读：
1. 图表的类型（类图/用例图/时序图/流程图等）
2. 包含的主要元素及其含义
3. 元素之间的关系与整体设计意图

只输出分析文本，不要输出代码或 XML。`;

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
    return new Response(JSON.stringify({ error: "缺少图表内容（xml 或 image）" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 重要修正：App Router 不读取 next.config 的 bodyParser，
  // 这里对 image 字段做长度校验，超过 9MB 直接返回 413。
  if (image && image.length > MAX_IMAGE_BYTES) {
    return new Response(JSON.stringify({ error: "图片过大（超过 9MB）" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  let messages: LLMMessage[];
  if (image && !xml) {
    // 多模态路径（需 vision 模型；DeepSeek 文本模型下客户端应优先走 xmlsvg）
    messages = [
      { role: "system", content: INTERPRET_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ];
  } else {
    messages = [
      { role: "system", content: INTERPRET_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${prompt}\n\n以下是图表的 draw.io XML：\n\`\`\`xml\n${xml.slice(
          0,
          50000
        )}\n\`\`\``,
      },
    ];
  }

  return createAIStream(messages);
}

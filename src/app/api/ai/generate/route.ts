import { NextRequest } from "next/server";
import { createAIStream, type LLMMessage } from "../shared";
import { sanitizeGeneratedCells } from "@/lib/xml-helper";

export const runtime = "nodejs";

const GENERATE_SYSTEM_PROMPT = `你是一名专业的 draw.io / UML 图表生成器。根据用户的描述生成对应的图表。

严格遵循以下规则：
1. 只输出 <mxCell> 元素片段，不要输出任何解释、说明、标题或对话文字。
2. 严禁使用 Markdown 代码块（不要输出 \`\`\` 或 \`\`\`xml 等围栏）。
3. 严禁输出 <mxfile>、<diagram>、<mxGraphModel>、<root> 等外层容器。
4. 严禁输出 id="0" 或 id="1" 的根细胞。
5. 每个 mxCell 必须有唯一 id（从 2 开始递增）和 parent 属性；顶点和连线均为 parent="1"。
6. 顶点（vertex="1"）必须包含 <mxGeometry> 子元素并设置 x/y/width/height；连线（edge="1"）必须设置 source 和 target。
7. value 等属性值中的 <、>、& 必须做 XML 转义，写成 &lt;、&gt;、&amp;（例如 value="List&lt;T&gt;" 而不是 value="List<T>"）。

示例格式：
<mxCell id="2" value="User" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
  <mxGeometry x="120" y="80" width="160" height="80" as="geometry" />
</mxCell>

只输出 mxCell 片段本身。`;

export async function POST(req: NextRequest) {
  let body: { prompt?: unknown };
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

  const messages: LLMMessage[] = [
    { role: "system", content: GENERATE_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];

  return createAIStream(messages, (fullText) => ({ xml: sanitizeGeneratedCells(fullText) }));
}

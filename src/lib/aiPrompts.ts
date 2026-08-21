/**
 * AI 提示词与消息构建（客户端与服务端共用，纯函数、无副作用）。
 *
 * 原本散落在 /api/ai/* 路由内；抽离到这里后，服务端代理（Route Handler）与
 * 客户端直连（aiClient）共用同一套提示词，保证 GitHub Pages 静态部署下行为一致。
 */
import type { LLMMessage } from "@/types/ai";
import { extractMxCells } from "@/lib/xml-helper";

/** 一次性生成（无上下文）时的系统提示词 */
export const GENERATE_SYSTEM_PROMPT = `你是一名专业的 draw.io / UML 图表生成器。根据用户的描述生成对应的图表。

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

/** 迭代修改（携带现有图表）时的系统提示词 */
export const ITERATE_SYSTEM_PROMPT = `你是一名专业的 draw.io / UML 图表编辑助手。根据用户的修改指令，在【现有图表】的 mxCell 片段基础上做增量修改。

【最重要原则，务必逐条遵守】
1. 你只能对用户明确要求的部分进行增、删、改，其余所有 <mxCell> 必须【逐字原样保留】：包括它们的 id、value、style、parent、source、target，以及 <mxGeometry> 的坐标与尺寸。
2. 严禁删除、合并、简化、重建任何用户未要求修改的单元格。宁可保守地只改一处，也绝不要整图重写。
3. 输出结果必须与【现有图表】中的单元格一一对应：未修改的单元格要原封不动地复制过来，不要改变它们的顺序、id 或样式。
4. 如果用户的修改是针对某个类（例如「给 User 类新增一个 age 属性」）：请先找到现有的 User 类，在其【属性/成员文本】的 value 中追加一行（用 &#10; 作为换行符），保持该类的 id、样式、位置以及其它属性不变；不要把整个类替换成新方框，也不要删除别的类。
5. 若用户的修改是针对连线（例如「删除 A 到 B 的连线」），只删除对应 edge 单元格，保留其余所有顶点与连线。

【输出格式规则】
6. 只输出修改后的【完整】<mxCell> 元素集合（包括所有未修改的部分），不要输出任何解释、说明、标题或对话文字。
7. 严禁使用 Markdown 代码块（不要输出 \`\`\` 或 \`\`\`xml 等围栏）。
8. 严禁输出 <mxfile>、<diagram>、<mxGraphModel>、<root> 等外层容器。
9. 严禁输出 id="0" 或 id="1" 的根细胞。
10. 每个 mxCell 必须有唯一 id（优先复用现有 id，新增 id 从现有最大 id 继续递增）。现有单元格的 parent 属性必须原样保留，不要改动；新增的顶层顶点/连线用 parent="1"，新增的【子单元格】（例如类图 swimlane 内部的属性行）parent 指向其容器单元格的 id。
11. 顶点（vertex="1"）必须包含 <mxGeometry> 子元素并设置 x/y/width/height；连线（edge="1"）必须设置 source 和 target。
12. value 等属性值中的 <、>、& 必须做 XML 转义，写成 &lt;、&gt;、&amp;。

只输出 mxCell 片段本身。`;

/** 解读图表时的系统提示词 */
export const INTERPRET_SYSTEM_PROMPT = `你是一名专业的 UML / 软件设计图分析师。用户会提供一段 draw.io 的 XML（<mxfile> 结构），其中每个 <mxCell> 节点的 value 属性是标签文本、style 属性描述形状与样式、vertex 表示节点、edge 表示连线（含 source/target）。

请根据 XML 内容，用简洁的中文分点解读：
1. 图表的类型（类图/用例图/时序图/流程图等）
2. 包含的主要元素及其含义
3. 元素之间的关系与整体设计意图

只输出分析文本，不要输出代码或 XML。`;

/** generate 模式的消息 + 采样温度 */
export interface GenerateMessages {
  messages: LLMMessage[];
  temperature: number;
}

/**
 * 构建 generate 模式的消息：
 * - 无 currentXml → 一次性生成（GENERATE_SYSTEM_PROMPT，temperature 0.7）
 * - 有 currentXml → 迭代修改（ITERATE_SYSTEM_PROMPT，temperature 0.2，减少整图重建）
 */
export function buildGenerateMessages(
  prompt: string,
  currentXml: string,
  diagramType: string
): GenerateMessages {
  const currentCells = currentXml ? extractMxCells(currentXml) : "";

  const userContent =
    (diagramType ? `【图表类型】${diagramType}\n` : "") +
    (currentCells
      ? `【现有图表】\n${currentCells}\n\n【修改指令】\n${prompt}`
      : prompt);

  return {
    messages: [
      {
        role: "system",
        content: currentCells ? ITERATE_SYSTEM_PROMPT : GENERATE_SYSTEM_PROMPT,
      },
      { role: "user", content: userContent },
    ],
    temperature: currentCells ? 0.2 : 0.7,
  };
}

/**
 * 构建 interpret 模式的消息：
 * - 有 image 且无 xml → 多模态路径（图片 + 文本）
 * - 否则 → 纯文本路径（draw.io XML）
 */
export function buildInterpretMessages(
  prompt: string,
  xml: string,
  image: string
): LLMMessage[] {
  if (image && !xml) {
    return [
      { role: "system", content: INTERPRET_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ];
  }

  return [
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

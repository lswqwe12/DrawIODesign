/**
 * draw.io / mxGraph XML 工具
 *
 * 职责边界（依据架构文档 §5.3）：
 * - wrapMxCells：把 AI 生成的纯 <mxCell> 片段包成完整 mxfile 骨架（仅首次加载时调用）
 * - unwrapDiagram：从完整 mxfile 中解包提取 <mxGraphModel>
 * - isValidDrawioXml：校验是否为合法的 draw.io XML
 */

/** 骨架前半段（不含内容），根细胞 id="0"/id="1" 由宿主统一提供 */
const SKELETON_PREFIX = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" agent="ai-uml-tool" version="24.0.0">
  <diagram id="diagram-1" name="Page-1">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />`;

/** 骨架后半段 */
const SKELETON_SUFFIX = `      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

/**
 * 将 AI 生成的 mxCell 片段包裹为完整 draw.io XML 骨架。
 *
 * 处理三种情况：
 * 1. 空片段 → 返回仅含根细胞的空骨架
 * 2. 已是完整 mxfile（含 <mxfile> 容器）→ 原样返回，避免双重包裹
 * 3. 纯 <mxCell> 片段 → 包裹进骨架
 */
export function wrapMxCells(fragment: string): string {
  const trimmed = (fragment ?? "").trim();

  // 空片段：返回空骨架
  if (!trimmed) {
    return `${SKELETON_PREFIX}\n${SKELETON_SUFFIX}`;
  }

  // 已含外层容器，避免双重包裹
  if (/<mxfile[\s>]/i.test(trimmed)) {
    return trimmed;
  }

  // 纯 mxCell 片段：统一缩进后塞入骨架
  const indented = trimmed
    .split("\n")
    .map((line) => `        ${line}`)
    .join("\n");

  return `${SKELETON_PREFIX}\n${indented}\n${SKELETON_SUFFIX}`;
}

/**
 * 从完整 draw.io XML 中解包提取 <mxGraphModel> 元素。
 * 若未找到则返回空字符串。
 */
export function unwrapDiagram(xml: string): string {
  const trimmed = (xml ?? "").trim();
  if (!trimmed) return "";

  const match = trimmed.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/i);
  return match ? match[0] : "";
}

/**
 * 校验是否为合法 draw.io XML：
 * 必须同时包含 <mxfile> 与 <mxGraphModel> 节点。
 */
export function isValidDrawioXml(xml: string): boolean {
  if (!xml || typeof xml !== "string") return false;

  const normalized = xml.replace(/^\uFEFF/, "").trim();
  if (!normalized) return false;

  const hasMxfile = /<mxfile[\s>]/i.test(normalized);
  const hasModel = /<mxGraphModel[\s>]/i.test(normalized);

  return hasMxfile && hasModel;
}

/**
 * 从一段（已转义属性值的）文本中，用标签栈提取完整的顶层 <mxCell> 元素。
 * 正确处理：
 * - 非自闭合的顶点/分组单元格（含 <mxGeometry> 子元素）
 * - 自闭合单元格（<mxCell … />）
 * - 嵌套分组（group 内嵌子单元格）
 * - 模型遗漏 </mxCell> 时自动补全闭合，避免产出「标签不匹配」的非法 XML
 */
function extractCompleteCells(xml: string): string[] {
  const cells: string[] = [];
  const tagRe = /<\/?mxCell\b[^>]*>/g;
  const openStack: number[] = []; // 未闭合 mxCell 的起始下标
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(xml)) !== null) {
    const token = m[0];
    if (token.startsWith("</")) {
      // 闭合标签：弹出最近的开放单元格
      const start = openStack.pop();
      if (start === undefined) continue;
      if (openStack.length === 0) {
        cells.push(xml.slice(start, m.index + token.length));
      }
    } else if (token.endsWith("/>")) {
      // 自闭合单元格
      if (openStack.length === 0) {
        cells.push(token);
      }
    } else {
      // 开放标签
      openStack.push(m.index);
    }
  }

  // 兜底：模型漏写 </mxCell> 时，把仍开放的单元格补全闭合
  if (openStack.length > 0) {
    const start = openStack[0];
    let content = xml.slice(start);
    for (let i = 0; i < openStack.length; i++) content += "</mxCell>";
    cells.push(content);
  }

  return cells;
}

/**
 * 从 LLM 原始输出中提取纯 <mxCell> 片段。
 * 兼容 Markdown 代码围栏、以及模型违规返回的完整 <mxfile> 骨架（自动剥离根细胞）。
 * 使用标签栈提取完整单元格（含子元素），修复旧正则对
 * `<mxCell>…<mxGeometry … />…</mxCell>` 这类非自闭合单元格被截断、
 * 进而导致 draw.io 报 "Opening and ending tag mismatch" 的问题。
 */
export function extractMxCells(raw: string): string {
  let text = (raw ?? "").trim();
  if (!text) return "";

  // 去掉 Markdown 代码围栏（```xml ... ``` 或 ``` ... ```）
  text = text
    .replace(/```[a-zA-Z0-9_-]*\s*/g, "")
    .replace(/```/g, "")
    .trim();

  // 若含完整骨架，仅取 <root> 内部，否则对整个文本扫描
  const rootMatch = text.match(/<root[\s>][\s\S]*?<\/root>/i);
  const scope = rootMatch ? rootMatch[0] : text;

  const cells = extractCompleteCells(scope).filter((cell) => {
    const idMatch = cell.match(/\bid="([^"]*)"/i);
    const id = idMatch ? idMatch[1] : null;
    return id !== "0" && id !== "1";
  });

  return cells.join("\n");
}

/**
 * 转义属性值里未转义的 & < > 字符。
 * 幂等：已存在的 XML 实体（&amp; / &lt; / &gt; / &quot; / &apos; / 数字实体）不会被二次转义。
 */
function escapeXmlText(value: string): string {
  return value
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 转义 XML 片段中所有属性值里的特殊字符。
 *
 * 背景：LLM 生成 <mxCell> 时经常直接输出 value="List<User>"、value="A & B" 这类
 * 未转义内容，拼进完整 mxfile 后 draw.io 会报
 * "Not a diagram file (error on line ...: Unescaped '<' not allowed in attributes values)"。
 * 这里只处理属性值，不触碰标签结构本身的 < > /。
 */
export function escapeXmlAttributeValues(xml: string): string {
  return (xml ?? "")
    .replace(
      /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g,
      (_m: string, name: string, value: string) => `${name}="${escapeXmlText(value)}"`
    )
    .replace(
      /([a-zA-Z_:][\w:.-]*)\s*=\s*'([^']*)'/g,
      (_m: string, name: string, value: string) => `${name}='${escapeXmlText(value)}'`
    );
}

/**
 * 对 LLM 原始输出做归一化：先转义属性值中的特殊字符，再提取纯 <mxCell> 片段。
 * 顺序很重要——必须先转义，否则 value="List<T>" 中的 < 会干扰后续的标签栈提取。
 * 供 AI 生成图表链路使用，保证交给 wrapMxCells / draw.io 的片段是合法 XML。
 */
export function sanitizeGeneratedCells(raw: string): string {
  return extractMxCells(escapeXmlAttributeValues(raw));
}

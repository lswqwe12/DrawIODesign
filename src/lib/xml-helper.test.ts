import { describe, expect, it } from "vitest";
import {
  escapeXmlAttributeValues,
  extractMxCells,
  sanitizeGeneratedCells,
  wrapMxCells,
} from "./xml-helper";

/** 判断 mxCell 标签是否平衡（非自闭合的开放标签数 == 闭合标签数） */
function mxCellBalanced(xml: string): boolean {
  const opens = (xml.match(/<mxCell\b[^>]*>/g) ?? []).length;
  const selfClosing = (xml.match(/<mxCell\b[^>]*\/>/g) ?? []).length;
  const closes = (xml.match(/<\/mxCell>/g) ?? []).length;
  return opens - selfClosing === closes;
}

describe("sanitizeGeneratedCells", () => {
  it("正确提取非自闭合的顶点单元格（修复标签不匹配回归）", () => {
    const raw = [
      `<mxCell id="2" value="User" style="rounded=1;html=1;" vertex="1" parent="1">`,
      `  <mxGeometry x="120" y="80" width="160" height="80" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="3" value="Order" style="rounded=1;" vertex="1" parent="1">`,
      `  <mxGeometry x="320" y="80" width="160" height="80" as="geometry" />`,
      `</mxCell>`,
    ].join("\n");

    const out = sanitizeGeneratedCells(raw);
    expect(out).toContain('id="2"');
    expect(out).toContain('id="3"');
    expect(out).toContain("</mxCell>");
    expect(mxCellBalanced(out)).toBe(true);
  });

  it("转义属性值中的 < 与 >（value=\"List<User>\"）", () => {
    const out = sanitizeGeneratedCells(
      `<mxCell id="2" value="List<User>" vertex="1" parent="1">` +
        `<mxGeometry x="1" y="1" width="10" height="10" as="geometry" />` +
        `</mxCell>`
    );
    expect(out).toContain('value="List&lt;User&gt;"');
    expect(out).not.toContain("List<User>");
  });

  it("转义属性值中的 &（value=\"A & B\"）", () => {
    const out = sanitizeGeneratedCells(
      `<mxCell id="2" value="A & B" vertex="1" parent="1">` +
        `<mxGeometry x="1" y="1" width="10" height="10" as="geometry" />` +
        `</mxCell>`
    );
    expect(out).toContain('value="A &amp; B"');
  });

  it("不二次转义已存在的 XML 实体", () => {
    const raw =
      `<mxCell id="2" value="List&lt;User&gt; &amp; More" vertex="1" parent="1">` +
      `<mxGeometry x="1" y="1" width="10" height="10" as="geometry" />` +
      `</mxCell>`;
    const out = sanitizeGeneratedCells(raw);
    expect(out).toContain('value="List&lt;User&gt; &amp; More"');
    expect(out).not.toContain("&amp;lt;");
    expect(out).not.toContain("&amp;amp;");
  });

  it("保留自闭合的连线单元格", () => {
    const out = sanitizeGeneratedCells(
      `<mxCell id="4" value="e" style="endArrow=block;" edge="1" parent="1" source="2" target="3" />`
    );
    expect(out).toContain('edge="1"');
    expect(out).toContain('source="2"');
    expect(out).toContain('target="3"');
  });

  it("剥离 Markdown 代码围栏", () => {
    const out = sanitizeGeneratedCells(
      "```xml\n" +
        `<mxCell id="2" value="User" vertex="1" parent="1" />` +
        "\n```"
    );
    expect(out).toContain('id="2"');
    expect(out).not.toContain("```");
  });

  it("剥离完整 mxfile 骨架并去掉 id=0/1 根细胞", () => {
    const out = sanitizeGeneratedCells(
      `<?xml version="1.0" encoding="UTF-8"?>` +
        `<mxfile><diagram><mxGraphModel><root>` +
        `<mxCell id="0" /><mxCell id="1" parent="0" />` +
        `<mxCell id="2" value="User" vertex="1" parent="1" />` +
        `</root></mxGraphModel></diagram></mxfile>`
    );
    expect(out).toContain('id="2"');
    expect(out).not.toContain('id="0"');
    expect(out).not.toContain('id="1"');
  });

  it("保留嵌套分组单元格（group 内嵌子单元格）", () => {
    const out = sanitizeGeneratedCells(
      `<mxCell id="2" value="Group" vertex="1" parent="1">` +
        `<mxGeometry x="0" y="0" width="200" height="200" as="geometry" />` +
        `<mxCell id="3" value="Child" vertex="1" parent="2">` +
        `<mxGeometry x="20" y="20" width="100" height="40" as="geometry" />` +
        `</mxCell>` +
        `</mxCell>`
    );
    expect(out).toContain('id="2"');
    expect(out).toContain('id="3"');
    expect(mxCellBalanced(out)).toBe(true);
  });

  it("模型漏写 </mxCell> 时自动补全闭合，产出平衡的标签", () => {
    const out = sanitizeGeneratedCells(
      `<mxCell id="2" value="User" vertex="1" parent="1">` +
        `<mxGeometry x="1" y="1" width="10" height="10" as="geometry" />` +
        `</mxCell>` +
        `<mxCell id="3" value="Order" vertex="1" parent="1">` +
        `<mxGeometry x="2" y="2" width="10" height="10" as="geometry" />`
    );
    expect(out).toContain('id="3"');
    expect(mxCellBalanced(out)).toBe(true);
  });

  it("幂等：对结果再次处理结果不变", () => {
    const raw =
      `<mxCell id="2" value="List<User> & A" vertex="1" parent="1">` +
      `<mxGeometry x="1" y="1" width="10" height="10" as="geometry" />` +
      `</mxCell>`;
    const once = sanitizeGeneratedCells(raw);
    expect(sanitizeGeneratedCells(once)).toBe(once);
  });
});

describe("escapeXmlAttributeValues", () => {
  it("只转义属性值，不触碰标签结构", () => {
    const out = escapeXmlAttributeValues(
      `<mxCell id="2" value="a<b&c>d" vertex="1" />`
    );
    expect(out).toContain("<mxCell");
    expect(out).toContain('value="a&lt;b&amp;c&gt;d"');
    expect(out).toContain('vertex="1"');
  });
});

describe("extractMxCells", () => {
  it("空输入返回空字符串", () => {
    expect(extractMxCells("")).toBe("");
    expect(extractMxCells("   ")).toBe("");
  });

  it("无 mxCell 时返回空字符串（而非原样返回，避免污染）", () => {
    expect(extractMxCells("随便写点不是图表的文字")).toBe("");
  });
});

describe("wrapMxCells", () => {
  it("空片段返回仅含根细胞的骨架", () => {
    const out = wrapMxCells("");
    expect(out).toContain('<mxCell id="0"');
    expect(out).toContain('<mxCell id="1" parent="0"');
    expect(out).toContain("<mxfile");
  });
});

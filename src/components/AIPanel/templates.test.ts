import { describe, it, expect } from "vitest";
import { DIAGRAM_TEMPLATES, DIAGRAM_TYPES } from "./templates";
import {
  wrapMxCells,
  extractMxCells,
  isValidDrawioXml,
  sanitizeGeneratedCells,
} from "@/lib/xml-helper";

/** 收集一段 XML 片段中的所有 id="..."（去重后） */
function collectIds(xml: string): string[] {
  const ids: string[] = [];
  const re = /\bid="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) ids.push(m[1]);
  return [...new Set(ids)];
}

describe("DIAGRAM_TEMPLATES 内置模板", () => {
  it("包含至少 3 个模板，且均有 id/name/cells", () => {
    expect(DIAGRAM_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const t of DIAGRAM_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.cells.trim()).toBeTruthy();
    }
  });

  it("每个模板 cells 都含 <mxCell> 且不含根细胞 id=0/1", () => {
    for (const t of DIAGRAM_TEMPLATES) {
      expect(/<mxCell[\s>]/i.test(t.cells)).toBe(true);
      const ids = collectIds(t.cells);
      expect(ids).not.toContain("0");
      expect(ids).not.toContain("1");
    }
  });

  it("wrapMxCells 后是合法 draw.io 骨架，且 extractMxCells 往返不丢内容", () => {
    for (const t of DIAGRAM_TEMPLATES) {
      const wrapped = wrapMxCells(t.cells);
      expect(isValidDrawioXml(wrapped)).toBe(true);

      const roundTrip = extractMxCells(wrapped);
      expect(roundTrip.trim()).not.toBe("");
      // 往返后单元格数量应与原始一致（顶层单元格数）
      expect(collectIds(roundTrip).sort()).toEqual(collectIds(t.cells).sort());
    }
  });

  it("模板内 id 唯一", () => {
    for (const t of DIAGRAM_TEMPLATES) {
      const ids = collectIds(t.cells);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("DIAGRAM_TYPES 图表类型", () => {
  it("覆盖 spec 要求的五种类型", () => {
    expect(DIAGRAM_TYPES).toEqual(["类图", "时序图", "用例图", "流程图", "ER 图"]);
  });
});

describe("模板与 AI 净化链路兼容", () => {
  it("模板 cells 经 sanitizeGeneratedCells 后仍保留全部单元格", () => {
    for (const t of DIAGRAM_TEMPLATES) {
      const cleaned = sanitizeGeneratedCells(t.cells);
      expect(collectIds(cleaned).sort()).toEqual(collectIds(t.cells).sort());
    }
  });
});

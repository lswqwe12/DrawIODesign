import { describe, it, expect } from "vitest";
import { ensureDrawioName, formatBytes, formatTime } from "./FileOperations";

describe("ensureDrawioName", () => {
  it("缺少后缀时自动补 .drawio", () => {
    expect(ensureDrawioName("类图")).toBe("类图.drawio");
  });

  it("已有 .drawio 后缀（大小写不敏感）时保持不变", () => {
    expect(ensureDrawioName("类图.DRAWIO")).toBe("类图.DRAWIO");
    expect(ensureDrawioName("类图.drawio")).toBe("类图.drawio");
  });

  it("去除首尾空白", () => {
    expect(ensureDrawioName("  类图  ")).toBe("类图.drawio");
  });
});

describe("formatBytes", () => {
  it("0 与负数返回 0 B", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-1)).toBe("0 B");
  });

  it("按单位进位", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("formatTime", () => {
  it("输出 YYYY-MM-DD HH:mm 格式", () => {
    const ts = new Date(2026, 0, 5, 9, 7).getTime();
    expect(formatTime(ts)).toBe("2026-01-05 09:07");
  });
});

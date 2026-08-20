import type { Folder } from "@/types/file";

/** 确保文件名以 .drawio 结尾 */
export function ensureDrawioName(name: string): string {
  const trimmed = name.trim();
  return trimmed.toLowerCase().endsWith(".drawio") ? trimmed : `${trimmed}.drawio`;
}

/** 字节数格式化：B / KB / MB / GB */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** 时间戳格式化：YYYY-MM-DD HH:mm */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/**
 * 弹窗选择移动目标文件夹（MVP 实现，后续可用 shadcn Dialog 替代）。
 * @returns { folderId: string | null } 成功（null 表示根目录）；null 表示取消/失败
 */
export function promptForFolder(
  folders: Folder[]
): { folderId: string | null } | null {
  const names = folders.map((f) => f.name).join("、") || "（暂无可用文件夹）";
  const input = window.prompt(
    `移动到哪个文件夹？\n输入文件夹名称（留空 = 根目录）。\n可用：${names}`
  );
  if (input === null) return null; // 取消
  const name = input.trim();
  if (!name) return { folderId: null }; // 移动到根目录
  const target = folders.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (!target) {
    window.alert(`未找到文件夹：${name}`);
    return null;
  }
  return { folderId: target.id };
}

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

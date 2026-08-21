"use client";

import { useMemo } from "react";
import { useDiagramContext } from "@/contexts/DiagramContext";
import { useFileSystemStore } from "@/contexts/FileSystemContext";
import { ROOT_FOLDER_NAME } from "@/types/file";
import type { SaveStatus } from "@/types/drawio";

const STATUS: Record<SaveStatus, { dotClass: string; label: string }> = {
  saved: { dotClass: "bg-emerald-500", label: "已保存" },
  saving: { dotClass: "bg-amber-500", label: "保存中…" },
  dirty: { dotClass: "bg-red-500", label: "有未保存更改" },
};

/** 时间戳格式化为 HH:mm:ss */
function formatTime(ts?: number): string {
  if (!ts) return "--:--:--";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 状态栏：保存状态、图表元素数量、当前文件路径、最后保存时间。
 */
export function StatusBar() {
  const { getActiveState, activeFileId, chartXML } = useDiagramContext();
  const folders = useFileSystemStore((s) => s.folders);
  const files = useFileSystemStore((s) => s.files);

  const active = getActiveState();
  const { dotClass, label } = STATUS[active?.saveStatus ?? "saved"];

  // 图表元素数量（去掉 id="0"/"1" 两个根细胞）
  const cellCount = useMemo(() => {
    const matches = chartXML.match(/<mxCell[\s>]/g);
    return Math.max(0, (matches?.length ?? 0) - 2);
  }, [chartXML]);

  // 当前文件路径：我的设计 / 文件夹… / 文件
  const filePath = useMemo(() => {
    const file = activeFileId ? files.find((f) => f.id === activeFileId) : undefined;
    if (!file) return "";
    const byId = new Map(folders.map((f) => [f.id, f]));
    const parts: string[] = [file.name];
    let current: string | null = file.folderId;
    while (current) {
      const folder = byId.get(current);
      if (!folder) break;
      parts.unshift(folder.name);
      current = folder.parentId;
    }
    parts.unshift(ROOT_FOLDER_NAME);
    return parts.join(" / ");
  }, [activeFileId, files, folders]);

  return (
    <footer className="flex items-center justify-between gap-3 border-t px-3 py-1 text-xs text-muted-foreground">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-foreground">
          <span className={`size-2 rounded-full ${dotClass}`} />
          {label}
        </span>
        <span className="shrink-0">
          元素 <span className="font-medium text-foreground">{cellCount}</span>
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        {filePath ? <span className="min-w-0 truncate">{filePath}</span> : null}
        <span className="shrink-0">最后保存 {formatTime(active?.lastSavedAt)}</span>
        <span className="hidden shrink-0 sm:inline">自动保存 · 500ms</span>
      </div>
    </footer>
  );
}

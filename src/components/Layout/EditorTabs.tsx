"use client";

import { FileText, X } from "lucide-react";
import { useDiagramContext } from "@/contexts/DiagramContext";
import { useFileSystemStore } from "@/contexts/FileSystemContext";
import { cn } from "@/lib/utils";

/**
 * EditorTabs —— 编辑器顶部多标签页 Tab Bar。
 *
 * 订阅 DiagramContext 中的 states（Map<fileId, DiagramState>）与 activeFileId，
 * 以扁平标签列表展示所有已打开的文件：
 * - 单击标签切换文件（经 requestOpenFile，自动带未保存更改拦截）；
 * - 标签上的 ● 表示该文件有未保存更改；
 * - 右侧 × 关闭标签（经 requestCloseFile，带未保存更改拦截）。
 * 文件展示名从 FileSystemStore 查询（目录树重命名后即时同步）。
 */
export function EditorTabs() {
  const { states, activeFileId, requestOpenFile, requestCloseFile } =
    useDiagramContext();
  const files = useFileSystemStore((s) => s.files);

  const tabs = Array.from(states.entries()).map(([fileId, state]) => ({
    fileId,
    state,
    name: files.find((f) => f.id === fileId)?.name ?? "未命名文件",
  }));

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      role="tablist"
      className="flex items-center gap-1 overflow-x-auto border-b bg-muted/40 px-1.5 pt-1"
    >
      {tabs.map(({ fileId, state, name }) => {
        const isActive = fileId === activeFileId;
        return (
          <div
            key={fileId}
            role="tab"
            aria-selected={isActive}
            title={name}
            className={cn(
              "group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t border-b-2 px-2.5 py-1.5 text-xs",
              isActive
                ? "border-primary bg-background text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            onClick={() => void requestOpenFile(fileId)}
          >
            <FileText className="size-3.5 shrink-0 text-blue-500" />
            <span className="max-w-[160px] truncate">{name}</span>
            {state.dirty && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-amber-500"
                title="有未保存更改"
              />
            )}
            <button
              type="button"
              aria-label={`关闭 ${name}`}
              className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                void requestCloseFile(fileId);
              }}
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

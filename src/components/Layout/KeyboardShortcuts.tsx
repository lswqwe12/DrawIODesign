"use client";

import { useEffect } from "react";
import { useDrawio } from "@/hooks/useDrawio";
import { toast } from "@/components/ui/toast";

/**
 * 全局键盘快捷键（宿主层拦截）：
 * - ⌘/Ctrl + S：显式保存
 * - ⌘/Ctrl + E：导出 PNG
 * - ⌘/Ctrl + K：聚焦左侧文件搜索框
 *
 * 注意：当焦点位于 draw.io iframe 内部时，父窗口收不到键盘事件，快捷键不生效。
 */
export function KeyboardShortcuts() {
  const { saveDiagram, handleExport, isReady } = useDrawio();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (key === "s") {
        e.preventDefault();
        if (!isReady) return;
        void saveDiagram()
          .then(() => toast({ title: "已保存", variant: "success" }))
          .catch((err: unknown) =>
            toast({
              title: "保存失败",
              description: err instanceof Error ? err.message : String(err),
              variant: "destructive",
            })
          );
      } else if (key === "e") {
        e.preventDefault();
        if (!isReady) return;
        void handleExport("png").catch((err: unknown) =>
          toast({
            title: "导出失败",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          })
        );
      } else if (key === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("ai-contest:focus-search"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveDiagram, handleExport, isReady]);

  return null;
}

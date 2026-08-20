"use client";

import { useDiagramContext } from "@/contexts/DiagramContext";
import type { SaveStatus } from "@/types/drawio";

const STATUS: Record<SaveStatus, { dot: string; label: string }> = {
  saved: { dot: "🟢", label: "已保存" },
  saving: { dot: "🟡", label: "保存中..." },
  dirty: { dot: "🔴", label: "有未保存更改" },
};

/**
 * 状态栏：订阅 DiagramContext 中的 saveStatus。
 * 🟢 已保存 / 🟡 保存中... / 🔴 有未保存更改
 */
export function StatusBar() {
  const { getActiveState } = useDiagramContext();
  const active = getActiveState();
  const { dot, label } = STATUS[active?.saveStatus ?? "saved"];

  return (
    <footer className="flex items-center justify-between border-t px-3 py-1 text-xs text-muted-foreground">
      <span className="font-medium">
        {dot} {label}
      </span>
      <span>自动保存 · 500ms</span>
    </footer>
  );
}

"use client";

import { useRef, useState } from "react";
import { FileCode2, ImageDown, Save, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDrawio } from "@/hooks/useDrawio";
import { toast } from "@/components/ui/toast";
import { ContextMenu, type ContextMenuItem } from "@/components/FileManager/ContextMenu";

/** 自动布局选项：布局名与展示名（对应 draw.io Arrange > Layout > Apply） */
const LAYOUT_OPTIONS: { label: string; layouts: string[] }[] = [
  { label: "垂直树布局", layouts: ["verticalTree"] },
  { label: "水平树布局", layouts: ["horizontalTree"] },
  { label: "垂直流程图", layouts: ["verticalFlow"] },
  { label: "水平流程图", layouts: ["horizontalFlow"] },
];

/**
 * 顶部栏：显式保存、导出 PNG/SVG、自动布局。
 * 全局搜索与「新建文件 / 新建文件夹」入口已收敛到 FileManager，避免重复。
 */
export function TopBar() {
  const { handleExport, saveDiagram, applyLayout, isReady } = useDrawio();
  const layoutBtnRef = useRef<HTMLButtonElement>(null);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [layoutMenuPos, setLayoutMenuPos] = useState({ x: 0, y: 0 });

  const handleSave = () => {
    void saveDiagram()
      .then(() => toast({ title: "已保存", variant: "success" }))
      .catch((err: unknown) =>
        toast({
          title: "保存失败",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        })
      );
  };

  const toggleLayoutMenu = () => {
    if (layoutMenuOpen) {
      setLayoutMenuOpen(false);
      return;
    }
    const rect = layoutBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 140;
    const x = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    setLayoutMenuPos({ x, y: rect.bottom + 4 });
    setLayoutMenuOpen(true);
  };

  const layoutItems: ContextMenuItem[] = LAYOUT_OPTIONS.map((opt) => ({
    label: opt.label,
    disabled: !isReady,
    onSelect: () => applyLayout(opt.layouts),
  }));

  return (
    <header className="flex items-center justify-end gap-2 border-b px-3 py-2">
      <div className="flex shrink-0 items-center gap-1">
        <Button ref={layoutBtnRef} variant="outline" size="sm" onClick={toggleLayoutMenu} disabled={!isReady}>
          <Workflow />
          自动布局
        </Button>
        <Button variant="outline" size="sm" onClick={handleSave}>
          <Save />
          保存
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleExport("png")}>
          <ImageDown />
          导出 PNG
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleExport("svg")}>
          <FileCode2 />
          导出 SVG
        </Button>
      </div>

      {layoutMenuOpen && (
        <ContextMenu
          x={layoutMenuPos.x}
          y={layoutMenuPos.y}
          items={layoutItems}
          onClose={() => setLayoutMenuOpen(false)}
        />
      )}
    </header>
  );
}

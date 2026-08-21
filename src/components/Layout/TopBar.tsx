"use client";

import { FileCode2, ImageDown, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDrawio } from "@/hooks/useDrawio";
import { toast } from "@/components/ui/toast";

/**
 * 顶部栏：显式保存、导出 PNG/SVG。
 * 全局搜索与「新建文件 / 新建文件夹」入口已收敛到 FileManager，避免重复。
 */
export function TopBar() {
  const { handleExport, saveDiagram } = useDrawio();

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

  return (
    <header className="flex items-center justify-end gap-2 border-b px-3 py-2">
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
        >
          <Save />
          保存
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleExport("png")}
        >
          <ImageDown />
          导出 PNG
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleExport("svg")}
        >
          <FileCode2 />
          导出 SVG
        </Button>
      </div>
    </header>
  );
}

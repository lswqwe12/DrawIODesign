"use client";

import { useEffect, useMemo, useState } from "react";
import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Folder as FolderType } from "@/types/file";

interface MoveDialogProps {
  open: boolean;
  folders: FolderType[];
  /** 需要排除的目标文件夹 id（移动文件夹时排除自身及其子孙） */
  excludeIds?: Set<string>;
  /** 当前所在文件夹（作为默认选中项） */
  currentFolderId?: string | null;
  onConfirm: (targetFolderId: string | null) => void;
  onCancel: () => void;
}

/**
 * 移动目标文件夹选择器：列表展示「根目录 + 所有可用文件夹」。
 */
export function MoveDialog({
  open,
  folders,
  excludeIds,
  currentFolderId,
  onConfirm,
  onCancel,
}: MoveDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelected(currentFolderId ?? null);
  }, [open, currentFolderId]);

  const options = useMemo(() => {
    const list: { key: string; name: string; value: string | null }[] = [
      { key: "__root__", name: "我的设计（根目录）", value: null },
    ];
    for (const f of folders) {
      if (excludeIds?.has(f.id)) continue;
      list.push({ key: f.id, name: f.name, value: f.id });
    }
    return list;
  }, [folders, excludeIds]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>移动到</DialogTitle>
          <DialogDescription>选择目标文件夹</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-auto rounded-md border">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                selected === opt.value && "bg-accent"
              )}
              onClick={() => setSelected(opt.value)}
            >
              <Folder className="size-4 shrink-0 text-amber-500" />
              <span className="truncate">{opt.name}</span>
            </button>
          ))}
          {options.length === 1 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">暂无可用文件夹</div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={() => onConfirm(selected)}>移动</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

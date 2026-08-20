"use client";

import { Button } from "@/components/ui/button";

export interface UnsavedChangesDialogProps {
  open: boolean;
  fileName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/**
 * 未保存更改确认对话框（三选一）：
 * - 保存：落库后继续切换
 * - 不保存：丢弃更改并继续切换
 * - 取消：中止本次切换，留在当前文件
 */
export function UnsavedChangesDialog({
  open,
  fileName,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="未保存更改"
    >
      <div className="w-full max-w-sm rounded-lg border bg-background p-5 shadow-lg">
        <h2 className="text-base font-semibold">文件未保存</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          当前文件「{fileName}」有未保存的更改，是否保存？
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button variant="outline" onClick={onDiscard}>
            不保存
          </Button>
          <Button onClick={onSave}>保存</Button>
        </div>
      </div>
    </div>
  );
}

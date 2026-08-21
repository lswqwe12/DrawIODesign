"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "./input";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * 受控输入对话框：用于「新建文件 / 新建文件夹 / 重命名」等需要单行输入的场景。
 * 支持回车提交、自动聚焦选中、空值禁用确定。
 */
export function PromptDialog({
  open,
  title,
  description,
  label,
  defaultValue = "",
  placeholder,
  confirmText = "确定",
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      const id = requestAnimationFrame(() => inputRef.current?.select());
      return () => cancelAnimationFrame(id);
    }
  }, [open, defaultValue]);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onConfirm(v);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-1.5">
          {label ? (
            <label htmlFor="prompt-input" className="text-sm font-medium">
              {label}
            </label>
          ) : null}
          <Input
            id="prompt-input"
            ref={inputRef}
            value={value}
            placeholder={placeholder}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={submit} disabled={!value.trim()}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

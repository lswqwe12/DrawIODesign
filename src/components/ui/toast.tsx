"use client";

import { create } from "zustand";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "destructive";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * 命令式弹出 toast（可在任意非组件逻辑中调用）。
 */
export function toast(toast: {
  title: string;
  description?: string;
  variant?: ToastVariant;
}) {
  useToastStore.getState().push({
    title: toast.title,
    description: toast.description,
    variant: toast.variant ?? "default",
  });
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "border-border",
  success: "border-emerald-500/60",
  destructive: "border-destructive/60",
};

/** 全局 Toaster：挂载到根布局，订阅 toast store 渲染所有通知。 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-md border bg-background p-3 shadow-md",
            VARIANT_STYLES[t.variant]
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t.title}</p>
            {t.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
            onClick={() => dismiss(t.id)}
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

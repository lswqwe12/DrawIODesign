"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * 通用右键上下文菜单：在 (x, y) 处渲染，点击外部或 Esc 关闭。
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={item.disabled}
          className={cn(
            "flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
            item.danger
              ? "text-destructive hover:bg-destructive/10"
              : "hover:bg-accent hover:text-accent-foreground",
            item.disabled && "cursor-not-allowed opacity-50"
          )}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

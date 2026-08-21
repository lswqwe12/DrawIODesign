"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFileSystemStore } from "@/contexts/FileSystemContext";
import { useDrawio } from "@/hooks/useDrawio";
import { FileTree } from "./FileTree";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { ensureDrawioName } from "./FileOperations";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { toast } from "@/components/ui/toast";
import type { FileMeta } from "@/types/file";

interface FileManagerProps {
  onOpenFile: (file: FileMeta) => void;
}

/** 三点下拉菜单的固定定位坐标（视口坐标系） */
interface MenuPos {
  x: number;
  y: number;
}

/** 当前打开的输入对话框类型 */
type DialogKind = "new-file" | "new-folder";

/**
 * FileManager —— Explorer 容器：搜索框（右侧三点菜单收纳新建/导入）+ 树形目录。
 * 文件与文件夹合并为一棵树，文件夹展开直接展示子文件夹与文件。
 * 文件管理区的唯一对外入口（架构文档 §5.5）。
 */
export default function FileManager({ onOpenFile }: FileManagerProps) {
  const { requestOpenFile } = useDrawio();
  const selectedFolderId = useFileSystemStore((s) => s.selectedFolderId);
  const files = useFileSystemStore((s) => s.files);
  const createFile = useFileSystemStore((s) => s.createFile);
  const createFolder = useFileSystemStore((s) => s.createFolder);
  const importFile = useFileSystemStore((s) => s.importFile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos>({ x: 0, y: 0 });
  const [dialog, setDialog] = useState<DialogKind | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return files
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [files, query]);

  // 响应全局快捷键 ⌘/Ctrl + K：聚焦搜索框
  useEffect(() => {
    const onFocusSearch = () => searchInputRef.current?.focus();
    window.addEventListener("ai-contest:focus-search", onFocusSearch);
    return () => window.removeEventListener("ai-contest:focus-search", onFocusSearch);
  }, []);

  const handleCreateFile = (name: string) => {
    void createFile(ensureDrawioName(name), selectedFolderId)
      .then(async (file) => {
        toast({ title: "已创建文件", variant: "success" });
        // 新建后默认选中并打开该文件（激活标签页、编辑器展示）
        await requestOpenFile(file.id, {
          chartXML: file.xml,
          isAIGenerated: false,
        });
      })
      .catch((err: unknown) =>
        toast({
          title: "创建失败",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        })
      );
  };

  const handleCreateFolder = (name: string) => {
    void createFolder(name, selectedFolderId)
      .then(() => toast({ title: "已创建文件夹", variant: "success" }))
      .catch((err: unknown) =>
        toast({
          title: "创建失败",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        })
      );
  };

  const handleImport = async (file: File) => {
    try {
      await importFile(file, selectedFolderId);
      toast({ title: "导入成功", variant: "success" });
    } catch (err) {
      toast({
        title: "导入失败",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  /** 切换三点下拉菜单：根据按钮位置计算弹出坐标（右对齐、防止超出视口） */
  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = moreBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 160;
    const x = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const y = rect.bottom + 4;
    setMenuPos({ x, y });
    setMenuOpen(true);
  };

  const menuItems: ContextMenuItem[] = [
    { label: "新建文件", onSelect: () => setDialog("new-file") },
    { label: "新建文件夹", onSelect: () => setDialog("new-folder") },
    { label: "导入", onSelect: () => fileInputRef.current?.click() },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* 搜索框 + 三点菜单（新建文件 / 新建文件夹 / 导入） */}
      <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文件…"
            className="pl-8"
          />
        </div>
        <Button
          ref={moreBtnRef}
          variant="ghost"
          size="icon"
          aria-label="更多操作"
          onClick={toggleMenu}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </div>

      {/* 隐藏的文件导入输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".drawio,.xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImport(file);
          e.target.value = "";
        }}
      />

      {/* 搜索结果 / 树形目录 */}
      <div className="min-h-0 flex-1 overflow-auto">
        {query.trim() ? (
          results.length > 0 ? (
            <ul className="p-1.5 text-sm">
              {results.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      onOpenFile(file);
                      setQuery("");
                    }}
                  >
                    <FileText className="size-4 shrink-0 text-blue-500" />
                    <span className="truncate">{file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-sm text-muted-foreground">无匹配文件</div>
          )
        ) : (
          <FileTree onOpenFile={onOpenFile} />
        )}
      </div>

      {menuOpen && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          items={menuItems}
          onClose={() => setMenuOpen(false)}
        />
      )}

      <PromptDialog
        open={dialog === "new-file"}
        title="新建文件"
        label="文件名称"
        defaultValue="未命名.drawio"
        placeholder="例如：类图.drawio"
        confirmText="创建"
        onCancel={() => setDialog(null)}
        onConfirm={(v) => {
          setDialog(null);
          handleCreateFile(v);
        }}
      />
      <PromptDialog
        open={dialog === "new-folder"}
        title="新建文件夹"
        label="文件夹名称"
        defaultValue="新建文件夹"
        confirmText="创建"
        onCancel={() => setDialog(null)}
        onConfirm={(v) => {
          setDialog(null);
          handleCreateFolder(v);
        }}
      />
    </div>
  );
}

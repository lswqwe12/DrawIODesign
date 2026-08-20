"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useFileSystemStore } from "@/contexts/FileSystemContext";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { ensureDrawioName, promptForFolder } from "./FileOperations";
import { ROOT_FOLDER_ID, ROOT_FOLDER_NAME } from "@/types/file";
import type { FileMeta } from "@/types/file";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  onOpenFile: (file: FileMeta) => void;
}

/** 树节点：文件夹（含其直接子文件夹与直接文件） */
interface TreeFolder {
  id: string;
  name: string;
  parentId: string | null;
  children: TreeFolder[];
  files: FileMeta[];
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "zh");

/**
 * 文件树：把文件夹与文件合并为统一树形目录。
 * 文件夹展开后直接展示其子文件夹与文件（文件夹在前、文件在后，各自按名称排序）。
 * 支持折叠/展开、单击选中、双击打开文件、右键 CRUD。
 */
export function FileTree({ onOpenFile }: FileTreeProps) {
  const folders = useFileSystemStore((s) => s.folders);
  const files = useFileSystemStore((s) => s.files);
  const selectedFolderId = useFileSystemStore((s) => s.selectedFolderId);
  const selectedFileId = useFileSystemStore((s) => s.selectedFileId);
  const selectFolder = useFileSystemStore((s) => s.selectFolder);
  const selectFile = useFileSystemStore((s) => s.selectFile);
  const createFolder = useFileSystemStore((s) => s.createFolder);
  const createFile = useFileSystemStore((s) => s.createFile);
  const renameFolder = useFileSystemStore((s) => s.renameFolder);
  const moveFolder = useFileSystemStore((s) => s.moveFolder);
  const deleteFolder = useFileSystemStore((s) => s.deleteFolder);
  const renameFile = useFileSystemStore((s) => s.renameFile);
  const moveFile = useFileSystemStore((s) => s.moveFile);
  const deleteFile = useFileSystemStore((s) => s.deleteFile);
  const duplicateFile = useFileSystemStore((s) => s.duplicateFile);

  // 根节点默认展开，便于直接看到顶层文件夹与文件
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([ROOT_FOLDER_ID])
  );
  const [menu, setMenu] = useState<MenuState | null>(null);

  // 当外部（打开文件 / AI 生成）选中某个文件时，自动展开其所在文件夹链，
  // 保证左侧目录树中被激活的文件节点可见。
  useEffect(() => {
    if (!selectedFileId) return;
    const file = files.find((f) => f.id === selectedFileId);
    if (!file || !file.folderId) return;
    const byId = new Map(folders.map((f) => [f.id, f]));
    const ancestors: string[] = [];
    let current: string | null = file.folderId;
    while (current) {
      const folder = byId.get(current);
      if (!folder) break;
      ancestors.push(current);
      current = folder.parentId;
    }
    if (ancestors.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const id of ancestors) next.add(id);
        return next;
      });
    }
  }, [selectedFileId, files, folders]);

  const { roots, rootFiles } = useMemo(() => {
    const folderMap = new Map<string, TreeFolder>();
    for (const f of folders) {
      folderMap.set(f.id, {
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        children: [],
        files: [],
      });
    }
    const roots: TreeFolder[] = [];
    for (const node of folderMap.values()) {
      if (node.parentId !== null && folderMap.has(node.parentId)) {
        folderMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    const rootFiles: FileMeta[] = [];
    for (const f of files) {
      if (f.folderId === null) rootFiles.push(f);
      else folderMap.get(f.folderId)?.files.push(f);
    }
    const sortFolder = (node: TreeFolder) => {
      node.children.sort(byName);
      node.files.sort(byName);
      node.children.forEach(sortFolder);
    };
    roots.sort(byName);
    roots.forEach(sortFolder);
    rootFiles.sort(byName);
    return { roots, rootFiles };
  }, [folders, files]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const folderMenuFor = (folder: {
    id: string;
    name: string;
    parentId: string | null;
  }): ContextMenuItem[] => [
    {
      label: "新建文件夹",
      onSelect: () => {
        const name = window.prompt("文件夹名称", "新建文件夹");
        if (name?.trim()) void createFolder(name.trim(), folder.id);
      },
    },
    {
      label: "新建文件",
      onSelect: () => {
        const name = window.prompt("文件名称", "未命名.drawio");
        if (name?.trim()) void createFile(ensureDrawioName(name), folder.id);
      },
    },
    {
      label: "重命名",
      onSelect: () => {
        const name = window.prompt("新名称", folder.name);
        if (name?.trim()) void renameFolder(folder.id, name.trim());
      },
    },
    {
      label: "移动",
      onSelect: () => {
        const target = promptForFolder(folders);
        if (target) void moveFolder(folder.id, target.folderId);
      },
    },
    {
      label: "删除",
      danger: true,
      onSelect: () => {
        if (window.confirm(`确定删除文件夹「${folder.name}」及其所有内容？`)) {
          void deleteFolder(folder.id);
        }
      },
    },
  ];

  const fileMenuFor = (file: FileMeta): ContextMenuItem[] => [
    {
      label: "打开",
      onSelect: () => onOpenFile(file),
    },
    {
      label: "重命名",
      onSelect: () => {
        const name = window.prompt("新名称", file.name);
        if (name?.trim()) void renameFile(file.id, name.trim());
      },
    },
    {
      label: "移动",
      onSelect: () => {
        const target = promptForFolder(folders);
        if (target) void moveFile(file.id, target.folderId);
      },
    },
    {
      label: "复制副本",
      onSelect: () => {
        void duplicateFile(file.id);
      },
    },
    {
      label: "删除",
      danger: true,
      onSelect: () => {
        if (window.confirm(`确定删除文件「${file.name}」？`)) {
          void deleteFile(file.id);
        }
      },
    },
  ];

  const renderFile = (file: FileMeta, depth: number): ReactNode => {
    const isSelected = selectedFileId === file.id;
    return (
      <div
        key={file.id}
        role="treeitem"
        aria-selected={isSelected}
        className={cn(
          "flex cursor-pointer select-none items-center gap-1 rounded px-1.5 py-1 text-sm hover:bg-accent",
          isSelected && "bg-accent/60"
        )}
        style={{ paddingLeft: depth * 14 + 6 }}
        onClick={() => selectFile(file.id)}
        onDoubleClick={() => onOpenFile(file)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY, items: fileMenuFor(file) });
        }}
      >
        <span className="size-4 shrink-0" />
        <FileText className="size-4 shrink-0 text-blue-500" />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
      </div>
    );
  };

  const renderFolder = (node: TreeFolder, depth: number): ReactNode => {
    const isOpen = expanded.has(node.id);
    const isSelected = selectedFolderId === node.id;
    const hasChildren = node.children.length > 0 || node.files.length > 0;
    return (
      <div key={node.id}>
        <div
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={isOpen}
          className={cn(
            "flex cursor-pointer select-none items-center gap-1 rounded px-1.5 py-1 text-sm hover:bg-accent",
            isSelected && "bg-accent text-accent-foreground"
          )}
          style={{ paddingLeft: depth * 14 + 6 }}
          onClick={() => {
            selectFolder(node.id);
            toggle(node.id);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({ x: e.clientX, y: e.clientY, items: folderMenuFor(node) });
          }}
        >
          <button
            type="button"
            className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              toggle(node.id);
            }}
          >
            {hasChildren ? (
              isOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )
            ) : null}
          </button>
          {isOpen ? (
            <FolderOpen className="size-4 shrink-0 text-amber-500" />
          ) : (
            <Folder className="size-4 shrink-0 text-amber-500" />
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {isOpen && (
          <>
            {node.children.map((child) => renderFolder(child, depth + 1))}
            {node.files.map((file) => renderFile(file, depth + 1))}
          </>
        )}
      </div>
    );
  };

  const rootIsOpen = expanded.has(ROOT_FOLDER_ID);

  return (
    <div className="p-1.5 text-sm">
      {/* 虚拟根节点 "我的设计" */}
      <div
        role="treeitem"
        aria-selected={selectedFolderId === null && selectedFileId === null}
        aria-expanded={rootIsOpen}
        className={cn(
          "flex cursor-pointer select-none items-center gap-1 rounded px-1.5 py-1 hover:bg-accent",
          selectedFolderId === null &&
            selectedFileId === null &&
            "bg-accent text-accent-foreground"
        )}
        onClick={() => {
          selectFolder(null);
          toggle(ROOT_FOLDER_ID);
        }}
      >
        <button
          type="button"
          className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            toggle(ROOT_FOLDER_ID);
          }}
        >
          {rootIsOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
        <FolderOpen className="size-4 shrink-0 text-amber-500" />
        <span className="truncate font-medium">{ROOT_FOLDER_NAME}</span>
      </div>
      {rootIsOpen && (
        <>
          {roots.map((node) => renderFolder(node, 1))}
          {rootFiles.map((file) => renderFile(file, 1))}
        </>
      )}
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

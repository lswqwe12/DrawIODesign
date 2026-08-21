"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useFileSystemStore } from "@/contexts/FileSystemContext";
import { useDrawio } from "@/hooks/useDrawio";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { MoveDialog } from "./MoveDialog";
import { ensureDrawioName } from "./FileOperations";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import { ROOT_FOLDER_ID, ROOT_FOLDER_NAME } from "@/types/file";
import type { FileMeta, Folder as FolderType } from "@/types/file";
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

/** 当前打开的对话框（新建/重命名/移动/删除） */
type DialogState =
  | { kind: "new-file"; parentId: string | null }
  | { kind: "new-folder"; parentId: string | null }
  | { kind: "rename-file"; file: FileMeta }
  | { kind: "rename-folder"; id: string; name: string }
  | { kind: "move-file"; file: FileMeta }
  | { kind: "move-folder"; id: string; name: string; parentId: string | null }
  | { kind: "delete-file"; file: FileMeta }
  | { kind: "delete-folder"; id: string; name: string };

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "zh");

/** 收集 rootId 及其所有子孙文件夹 id（用于移动文件夹时禁止落入自身子树） */
function collectSubtreeIds(rootId: string, folders: FolderType[]): Set<string> {
  const byParent = new Map<string | null, FolderType[]>();
  for (const f of folders) {
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }
  const result = new Set<string>([rootId]);
  const queue: string[] = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of byParent.get(id) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return result;
}

/**
 * 文件树：把文件夹与文件合并为统一树形目录。
 * 支持折叠/展开、单击选中、双击打开、右键 CRUD、拖拽移动。
 */
export function FileTree({ onOpenFile }: FileTreeProps) {
  const { requestOpenFile } = useDrawio();
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

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([ROOT_FOLDER_ID])
  );
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  // 拖拽状态：dragRef 保存被拖拽项，dragOver 高亮目标文件夹
  const dragRef = useRef<{ type: "file" | "folder"; id: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

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

  const showError = (action: string) => (err: unknown) =>
    toast({
      title: action,
      description: err instanceof Error ? err.message : String(err),
      variant: "destructive",
    });

  // ---- 拖拽处理 ----
  const onDragStart = (
    e: React.DragEvent,
    type: "file" | "folder",
    id: string
  ) => {
    dragRef.current = { type, id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const onDragEnd = () => {
    dragRef.current = null;
    setDragOver(null);
  };

  const onDropTo = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDragOver(null);
    const data = dragRef.current;
    dragRef.current = null;
    if (!data) return;
    if (data.type === "file") {
      void moveFile(data.id, targetFolderId)
        .then(() => toast({ title: "已移动", variant: "success" }))
        .catch(showError("移动失败"));
    } else {
      void moveFolder(data.id, targetFolderId)
        .then(() => toast({ title: "已移动", variant: "success" }))
        .catch(showError("移动失败"));
    }
  };

  // ---- 对话框确认处理 ----
  const confirmCreateFile = (parentId: string | null, name: string) => {
    void createFile(ensureDrawioName(name), parentId)
      .then(async (file) => {
        toast({ title: "已创建文件", variant: "success" });
        // 新建后默认选中并打开该文件（激活标签页、编辑器展示）
        await requestOpenFile(file.id, {
          chartXML: file.xml,
          isAIGenerated: false,
        });
      })
      .catch(showError("创建失败"));
  };

  const confirmCreateFolder = (parentId: string | null, name: string) => {
    void createFolder(name, parentId)
      .then(() => toast({ title: "已创建文件夹", variant: "success" }))
      .catch(showError("创建失败"));
  };

  const confirmDelete = () => {
    if (!dialog) return;
    if (dialog.kind === "delete-file") {
      void deleteFile(dialog.file.id)
        .then(() => toast({ title: "已删除文件", variant: "success" }))
        .catch(showError("删除失败"));
    } else if (dialog.kind === "delete-folder") {
      void deleteFolder(dialog.id)
        .then(() => toast({ title: "已删除文件夹", variant: "success" }))
        .catch(showError("删除失败"));
    }
  };

  const folderMenuFor = (folder: {
    id: string;
    name: string;
    parentId: string | null;
  }): ContextMenuItem[] => [
    {
      label: "新建文件夹",
      onSelect: () => setDialog({ kind: "new-folder", parentId: folder.id }),
    },
    {
      label: "新建文件",
      onSelect: () => setDialog({ kind: "new-file", parentId: folder.id }),
    },
    {
      label: "重命名",
      onSelect: () =>
        setDialog({ kind: "rename-folder", id: folder.id, name: folder.name }),
    },
    {
      label: "移动",
      onSelect: () =>
        setDialog({
          kind: "move-folder",
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId,
        }),
    },
    {
      label: "删除",
      danger: true,
      onSelect: () =>
        setDialog({ kind: "delete-folder", id: folder.id, name: folder.name }),
    },
  ];

  const fileMenuFor = (file: FileMeta): ContextMenuItem[] => [
    { label: "打开", onSelect: () => onOpenFile(file) },
    {
      label: "重命名",
      onSelect: () => setDialog({ kind: "rename-file", file }),
    },
    { label: "移动", onSelect: () => setDialog({ kind: "move-file", file }) },
    {
      label: "复制副本",
      onSelect: () => {
        void duplicateFile(file.id)
          .then(() => toast({ title: "已复制副本", variant: "success" }))
          .catch(showError("复制失败"));
      },
    },
    {
      label: "删除",
      danger: true,
      onSelect: () => setDialog({ kind: "delete-file", file }),
    },
  ];

  const renderFile = (file: FileMeta, depth: number): ReactNode => {
    const isSelected = selectedFileId === file.id;
    return (
      <div
        key={file.id}
        role="treeitem"
        aria-selected={isSelected}
        draggable
        onDragStart={(e) => onDragStart(e, "file", file.id)}
        onDragEnd={onDragEnd}
        className={cn(
          "flex cursor-pointer select-none items-center gap-1 rounded px-1.5 py-1 text-sm hover:bg-accent",
          isSelected && "bg-primary text-primary-foreground"
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
    const isDragOver = dragOver === node.id;
    const hasChildren = node.children.length > 0 || node.files.length > 0;
    return (
      <div key={node.id}>
        <div
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={isOpen}
          draggable
          onDragStart={(e) => onDragStart(e, "folder", node.id)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(node.id);
          }}
          onDrop={(e) => {
            e.stopPropagation();
            onDropTo(e, node.id);
          }}
          className={cn(
            "flex cursor-pointer select-none items-center gap-1 rounded px-1.5 py-1 text-sm hover:bg-accent",
            isSelected && "bg-primary text-primary-foreground",
            isDragOver && "ring-1 ring-primary"
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
  const rootIsDragOver = dragOver === ROOT_FOLDER_ID;

  // 移动对话框的排除项 / 默认项
  const moveExclude =
    dialog?.kind === "move-folder" ? collectSubtreeIds(dialog.id, folders) : undefined;
  const moveCurrent =
    dialog?.kind === "move-file"
      ? dialog.file.folderId
      : dialog?.kind === "move-folder"
        ? dialog.parentId
        : undefined;

  return (
    <div className="p-1.5 text-sm">
      {/* 虚拟根节点 "我的设计" */}
      <div
        role="treeitem"
        aria-selected={selectedFolderId === null && selectedFileId === null}
        aria-expanded={rootIsOpen}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(ROOT_FOLDER_ID);
        }}
        onDrop={(e) => onDropTo(e, null)}
        className={cn(
          "flex cursor-pointer select-none items-center gap-1 rounded px-1.5 py-1 hover:bg-accent",
          selectedFolderId === null &&
            selectedFileId === null &&
            "bg-primary text-primary-foreground",
          rootIsDragOver && "ring-1 ring-primary"
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

      {/* 新建文件 */}
      <PromptDialog
        open={dialog?.kind === "new-file"}
        title="新建文件"
        label="文件名称"
        defaultValue="未命名.drawio"
        placeholder="例如：类图.drawio"
        confirmText="创建"
        onCancel={() => setDialog(null)}
        onConfirm={(v) => {
          const parentId = dialog?.kind === "new-file" ? dialog.parentId : null;
          setDialog(null);
          confirmCreateFile(parentId, v);
        }}
      />
      {/* 新建文件夹 */}
      <PromptDialog
        open={dialog?.kind === "new-folder"}
        title="新建文件夹"
        label="文件夹名称"
        defaultValue="新建文件夹"
        confirmText="创建"
        onCancel={() => setDialog(null)}
        onConfirm={(v) => {
          const parentId = dialog?.kind === "new-folder" ? dialog.parentId : null;
          setDialog(null);
          confirmCreateFolder(parentId, v);
        }}
      />
      {/* 重命名文件 */}
      <PromptDialog
        open={dialog?.kind === "rename-file"}
        title="重命名文件"
        label="新名称"
        defaultValue={dialog?.kind === "rename-file" ? dialog.file.name : ""}
        confirmText="确定"
        onCancel={() => setDialog(null)}
        onConfirm={(v) => {
          const file = dialog?.kind === "rename-file" ? dialog.file : null;
          setDialog(null);
          if (file) {
            void renameFile(file.id, v)
              .then(() => toast({ title: "已重命名", variant: "success" }))
              .catch(showError("重命名失败"));
          }
        }}
      />
      {/* 重命名文件夹 */}
      <PromptDialog
        open={dialog?.kind === "rename-folder"}
        title="重命名文件夹"
        label="新名称"
        defaultValue={dialog?.kind === "rename-folder" ? dialog.name : ""}
        confirmText="确定"
        onCancel={() => setDialog(null)}
        onConfirm={(v) => {
          const id = dialog?.kind === "rename-folder" ? dialog.id : null;
          setDialog(null);
          if (id) {
            void renameFolder(id, v)
              .then(() => toast({ title: "已重命名", variant: "success" }))
              .catch(showError("重命名失败"));
          }
        }}
      />
      {/* 移动 */}
      <MoveDialog
        open={dialog?.kind === "move-file" || dialog?.kind === "move-folder"}
        folders={folders}
        excludeIds={moveExclude}
        currentFolderId={moveCurrent}
        onCancel={() => setDialog(null)}
        onConfirm={(target) => {
          const d = dialog;
          setDialog(null);
          if (!d) return;
          if (d.kind === "move-file") {
            void moveFile(d.file.id, target)
              .then(() => toast({ title: "已移动", variant: "success" }))
              .catch(showError("移动失败"));
          } else if (d.kind === "move-folder") {
            void moveFolder(d.id, target)
              .then(() => toast({ title: "已移动", variant: "success" }))
              .catch(showError("移动失败"));
          }
        }}
      />

      {/* 删除确认 */}
      <AlertDialog
        open={dialog?.kind === "delete-file" || dialog?.kind === "delete-folder"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog?.kind === "delete-file" ? "删除文件" : "删除文件夹"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.kind === "delete-file"
                ? `确定删除文件「${dialog.file.name}」？此操作不可撤销。`
                : dialog?.kind === "delete-folder"
                  ? `确定删除文件夹「${dialog.name}」及其所有内容？此操作不可撤销。`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

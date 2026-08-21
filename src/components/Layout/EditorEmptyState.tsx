"use client";

import { useRef, useState } from "react";
import { FilePlus2, FolderPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { toast } from "@/components/ui/toast";
import { useFileSystemStore } from "@/contexts/FileSystemContext";
import { useDrawio } from "@/hooks/useDrawio";
import { ensureDrawioName } from "@/components/FileManager/FileOperations";

type DialogKind = "new-file" | "new-folder";

/**
 * 编辑器空状态：当没有打开任何文件时，居中展示「新建文件 / 新建文件夹 / 导入」，
 * 行为与左侧目录栏三点菜单完全一致（创建到当前选中文件夹）；新建文件后会自动选中并打开。
 */
export function EditorEmptyState() {
  const { requestOpenFile } = useDrawio();
  const selectedFolderId = useFileSystemStore((s) => s.selectedFolderId);
  const createFile = useFileSystemStore((s) => s.createFile);
  const createFolder = useFileSystemStore((s) => s.createFolder);
  const importFile = useFileSystemStore((s) => s.importFile);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);

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

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p className="text-2xl font-semibold">开始你的设计</p>
        <p className="mt-2 text-sm text-muted-foreground">
          新建一个图表文件，或导入已有的 .drawio / .xml 文件
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => setDialog("new-file")}>
          <FilePlus2 />
          新建文件
        </Button>
        <Button variant="outline" onClick={() => setDialog("new-folder")}>
          <FolderPlus />
          新建文件夹
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload />
          导入
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

"use client";

import { useEffect } from "react";
import { DiagramProvider } from "@/contexts/DiagramContext";
import { useDrawio } from "@/hooks/useDrawio";
import { useFileSystemStore } from "@/contexts/FileSystemContext";
import * as fileService from "@/services/fileService";
import DiagramEditor from "@/components/DiagramEditor/DiagramEditor";
import FileManager from "@/components/FileManager";
import { AIPanel } from "@/components/AIPanel/AIPanel";
import { TopBar } from "@/components/Layout/TopBar";
import { StatusBar } from "@/components/Layout/StatusBar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { FileMeta } from "@/types/file";

function Workspace() {
  const { requestOpenFile } = useDrawio();
  const init = useFileSystemStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  const handleOpenFile = async (file: FileMeta) => {
    try {
      // 从 IndexedDB 读取最新内容（目录树里的 file.xml 可能是保存前的旧快照，
      // 编辑器自动保存只落库、不刷新 store，直接用它会导致重新打开时丢失最近改动）
      const fresh = await fileService.getFile(file.id);
      const meta = fresh ?? file;
      // 双击/搜索打开文件：带未保存更改拦截的切换（保存/不保存/取消）
      await requestOpenFile(meta.id, {
        chartXML: meta.xml,
        isAIGenerated: false,
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "打开文件失败");
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <TopBar />

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={18} minSize={12}>
            <FileManager onOpenFile={handleOpenFile} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={57} minSize={30}>
            <DiagramEditor />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={25} minSize={15}>
            <AIPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <StatusBar />
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <DiagramProvider>
      <Workspace />
    </DiagramProvider>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatMessage, GenerateTarget } from "@/types/ai";
import { streamAI, scaleImage } from "@/services/aiService";
import { useDrawio } from "@/hooks/useDrawio";
import { useFileSystemStore } from "@/contexts/FileSystemContext";
import { ensureDrawioName } from "@/components/FileManager/FileOperations";
import {
  sanitizeGeneratedCells,
  wrapMxCells,
  extractMxCells,
} from "@/lib/xml-helper";
import { toast } from "@/components/ui/toast";
import type { DiagramTemplate } from "./templates";

function generateId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 生成选项：目标（当前文件迭代 / 新建文件）+ 图表类型 */
export interface GenerateOptions {
  target?: GenerateTarget;
  diagramType?: string;
}

/** 迭代修改前的快照，用于「撤销 AI 修改」 */
interface RollbackSnapshot {
  fileId: string;
  beforeXml: string; // 修改前的完整骨架
}

/** 最近一次请求，用于「重试」 */
interface LastRequest {
  kind: "generate" | "interpret";
  prompt: string;
  options?: GenerateOptions;
}

export interface UseAIReturn {
  messages: ChatMessage[];
  loading: boolean;
  interpret: (prompt: string) => Promise<void>;
  generate: (prompt: string, options?: GenerateOptions) => Promise<void>;
  loadTemplate: (template: DiagramTemplate) => Promise<void>;
  retry: () => void;
  rollback: () => Promise<void>;
  canRollback: boolean;
  stop: () => void;
}

/**
 * AI 面板交互逻辑（M2）：
 * - interpret：导出 xmlsvg（优先）或缩放后的 PNG，流式打印分析文本
 * - generate：一次性生成（新文件）或 多轮迭代修改（当前文件，携带 currentXml 上下文）
 * - loadTemplate：一键载入内置模板（空白类图/时序图/ER 图）
 * - rollback：撤销最近一次对当前文件的 AI 修改（回滚到修改前快照）
 * - retry：重试最近一次失败/中断的请求
 */
export function useAI(): UseAIReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [canRollback, setCanRollback] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const rollbackRef = useRef<RollbackSnapshot | null>(null);
  const lastRequestRef = useRef<LastRequest | null>(null);

  const {
    activeFileId,
    exportDiagram,
    loadDiagram,
    saveDiagram,
    getActiveState,
    cancelPendingSave,
    handleSaveEvent,
  } = useDrawio();
  const createFile = useFileSystemStore((s) => s.createFile);
  const selectedFolderId = useFileSystemStore((s) => s.selectedFolderId);

  const patchMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  }, []);

  const appendContent = useCallback((id: string, content: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + content } : m))
    );
  }, []);

  const interpret = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!text || loading) return;
      lastRequestRef.current = { kind: "interpret", prompt: text };
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        mode: "interpret",
        createdAt: Date.now(),
      };
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        mode: "interpret",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // 优先导出 xmlsvg（文本，远小于 PNG），失败则回退到缩放后的 PNG
        let xml: string | undefined;
        let image: string | undefined;
        try {
          const result = await exportDiagram("xmlsvg");
          xml = result.xml || result.data;
        } catch {
          try {
            const png = await exportDiagram("png");
            image = await scaleImage(png.data, 1200);
          } catch (err) {
            patchMessage(assistantMsg.id, {
              content: `导出图表失败：${err instanceof Error ? err.message : String(err)}`,
              error: true,
            });
            return;
          }
        }

        await streamAI(
          { mode: "interpret", prompt: text, xml, image },
          (chunk) => {
            if (chunk.type === "content" && chunk.content) {
              appendContent(assistantMsg.id, chunk.content);
            } else if (chunk.type === "error") {
              patchMessage(assistantMsg.id, {
                content: chunk.error ?? "分析失败",
                error: true,
              });
            }
          },
          controller.signal
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        patchMessage(assistantMsg.id, {
          content: `请求失败：${err instanceof Error ? err.message : String(err)}`,
          error: true,
        });
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [loading, exportDiagram, appendContent, patchMessage]
  );

  const generate = useCallback(
    async (prompt: string, options?: GenerateOptions) => {
      const text = prompt.trim();
      if (!text || loading) return;
      const target: GenerateTarget = options?.target ?? "new";
      const diagramType = options?.diagramType?.trim() || undefined;
      lastRequestRef.current = { kind: "generate", prompt: text, options: { target, diagramType } };

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        mode: "generate",
        createdAt: Date.now(),
      };
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "正在生成图表…",
        mode: "generate",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // 迭代模式：先导出当前图表作为上下文 + 回滚快照
        let currentXml: string | undefined;
        let beforeXml: string | undefined;
        let targetFileId: string | null = null;
        if (target === "current" && activeFileId) {
          const result = await exportDiagram("xmlsvg");
          beforeXml = result.xml;
          targetFileId = activeFileId;
          currentXml = extractMxCells(result.xml);
        }

        let finalXml = "";
        await streamAI(
          { mode: "generate", prompt: text, currentXml, diagramType },
          (chunk) => {
            if (chunk.type === "end") {
              finalXml = chunk.xml ?? chunk.content ?? "";
            } else if (chunk.type === "error") {
              patchMessage(assistantMsg.id, {
                content: chunk.error ?? "生成失败",
                error: true,
              });
            }
          },
          controller.signal
        );

        const cells = sanitizeGeneratedCells(finalXml);
        if (!/<mxCell[\s>]/i.test(cells)) {
          patchMessage(assistantMsg.id, {
            content: "未能从模型输出中解析出有效的 <mxCell> 片段，请重试。",
            error: true,
          });
          return;
        }

        const wrapped = wrapMxCells(cells);

        if (target === "current" && targetFileId && beforeXml) {
          // 迭代修改当前文件：取消挂起的防抖自动保存 → 持久化 → 刷新编辑器 → 记录回滚快照
          cancelPendingSave();
          await handleSaveEvent(wrapped, targetFileId);
          loadDiagram(targetFileId, { chartXML: wrapped, isAIGenerated: false });
          rollbackRef.current = { fileId: targetFileId, beforeXml };
          setCanRollback(true);
          patchMessage(assistantMsg.id, {
            content: "已按指令修改当前图表。",
            xml: cells,
          });
          toast({ title: "已更新图表", variant: "success" });
        } else {
          // 一次性生成：创建新文件并激活
          if (getActiveState()?.dirty) {
            cancelPendingSave();
            await saveDiagram();
          }
          const name = ensureDrawioName(`AI生成-${Date.now().toString(36)}`);
          const file = await createFile(name, selectedFolderId, wrapped);
          loadDiagram(file.id, { chartXML: wrapped, isAIGenerated: false });
          patchMessage(assistantMsg.id, {
            content: "已生成图表，并加载到编辑器。",
            xml: cells,
          });
          toast({ title: "已生成图表", variant: "success" });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        patchMessage(assistantMsg.id, {
          content: `请求失败：${err instanceof Error ? err.message : String(err)}`,
          error: true,
        });
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [
      loading,
      activeFileId,
      exportDiagram,
      createFile,
      selectedFolderId,
      loadDiagram,
      saveDiagram,
      getActiveState,
      cancelPendingSave,
      handleSaveEvent,
      patchMessage,
    ]
  );

  /** 一键载入内置模板：包装为完整骨架 → 新建文件 → 激活编辑器 */
  const loadTemplate = useCallback(
    async (template: DiagramTemplate) => {
      if (loading) return;
      const wrapped = wrapMxCells(template.cells);
      if (getActiveState()?.dirty) {
        cancelPendingSave();
        await saveDiagram();
      }
      const name = ensureDrawioName(template.name);
      const file = await createFile(name, selectedFolderId, wrapped);
      loadDiagram(file.id, { chartXML: wrapped, isAIGenerated: false });
      toast({ title: `已载入模板：${template.name}`, variant: "success" });
    },
    [loading, getActiveState, cancelPendingSave, saveDiagram, createFile, selectedFolderId, loadDiagram]
  );

  /** 撤销最近一次对当前文件的 AI 修改（回滚到修改前快照） */
  const rollback = useCallback(async () => {
    const snap = rollbackRef.current;
    if (!snap) return;
    rollbackRef.current = null;
    setCanRollback(false);
    cancelPendingSave();
    await handleSaveEvent(snap.beforeXml, snap.fileId);
    loadDiagram(snap.fileId, { chartXML: snap.beforeXml, isAIGenerated: false });
    toast({ title: "已撤销 AI 修改", variant: "success" });
  }, [cancelPendingSave, handleSaveEvent, loadDiagram]);

  /** 重试最近一次请求（失败后可用） */
  const retry = useCallback(() => {
    const last = lastRequestRef.current;
    if (!last || loading) return;
    if (last.kind === "generate") void generate(last.prompt, last.options);
    else void interpret(last.prompt);
  }, [loading, generate, interpret]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, loading, interpret, generate, loadTemplate, retry, rollback, canRollback, stop };
}

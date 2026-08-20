"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "@/types/ai";
import { streamAI, scaleImage } from "@/services/aiService";
import { useDrawio } from "@/hooks/useDrawio";
import { useFileSystemStore } from "@/contexts/FileSystemContext";
import { ensureDrawioName } from "@/components/FileManager/FileOperations";
import { sanitizeGeneratedCells, wrapMxCells } from "@/lib/xml-helper";

function generateId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface UseAIReturn {
  messages: ChatMessage[];
  loading: boolean;
  interpret: (prompt: string) => Promise<void>;
  generate: (prompt: string) => Promise<void>;
  stop: () => void;
}

/**
 * AI 面板交互逻辑：
 * - interpret：导出 xmlsvg（优先）或缩放后的 PNG，流式打印分析文本
 * - generate：流式接收 xml 片段，创建新文件并通过 loadDiagram 加载（isAIGenerated=true）
 */
export function useAI(): UseAIReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const {
    exportDiagram,
    loadDiagram,
    saveDiagram,
    getActiveState,
    cancelPendingSave,
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
              });
            }
          },
          controller.signal
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        patchMessage(assistantMsg.id, {
          content: `请求失败：${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [loading, exportDiagram, appendContent, patchMessage]
  );

  const generate = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!text || loading) return;
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
        let finalXml = "";
        await streamAI(
          { mode: "generate", prompt: text },
          (chunk) => {
            if (chunk.type === "end") {
              finalXml = chunk.xml ?? chunk.content ?? "";
            } else if (chunk.type === "error") {
              patchMessage(assistantMsg.id, {
                content: chunk.error ?? "生成失败",
              });
            }
          },
          controller.signal
        );

        const cells = sanitizeGeneratedCells(finalXml);
        if (!/<mxCell[\s>]/i.test(cells)) {
          patchMessage(assistantMsg.id, {
            content: "未能从模型输出中解析出有效的 <mxCell> 片段，请重试。",
          });
          return;
        }

        // AI 生成前：若当前打开的文件有未保存更改，先默认保存（不打断，静默落库）
        if (getActiveState()?.dirty) {
          cancelPendingSave();
          await saveDiagram();
        }

        // 包装为完整骨架并在创建时即落库（自动保存一次），随后激活该 AI 文件
        const wrapped = wrapMxCells(cells);
        const name = ensureDrawioName(`AI生成-${Date.now().toString(36)}`);
        const file = await createFile(name, selectedFolderId, wrapped);
        loadDiagram(file.id, { chartXML: wrapped, isAIGenerated: false });
        patchMessage(assistantMsg.id, { content: "已生成图表，并加载到编辑器。", xml: cells });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        patchMessage(assistantMsg.id, {
          content: `请求失败：${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [
      loading,
      createFile,
      selectedFolderId,
      loadDiagram,
      saveDiagram,
      getActiveState,
      cancelPendingSave,
      patchMessage,
    ]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, loading, interpret, generate, stop };
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutTemplate, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDrawio } from "@/hooks/useDrawio";
import { useAI } from "./useAI";
import { ChatHistory } from "./ChatHistory";
import { DIAGRAM_TEMPLATES, DIAGRAM_TYPES } from "./templates";
import type { GenerateTarget } from "@/types/ai";

export function AIPanel() {
  const { messages, loading, interpret, generate, loadTemplate, retry, rollback, canRollback, stop } = useAI();
  const { activeFileId } = useDrawio();
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<GenerateTarget>("new");
  const [diagramType, setDiagramType] = useState<string>("");

  const templateWrapRef = useRef<HTMLDivElement>(null);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  // 模板下拉点击外部 / Esc 关闭
  useEffect(() => {
    if (!templateMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (templateWrapRef.current && !templateWrapRef.current.contains(e.target as Node)) {
        setTemplateMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTemplateMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [templateMenuOpen]);

  // 最近一条 assistant 消息是否失败（用于显示「重试」）
  const lastError = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].error === true;
    }
    return false;
  }, [messages]);

  const submit = (mode: "interpret" | "generate") => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput("");
    if (mode === "interpret") void interpret(prompt);
    else void generate(prompt, { target, diagramType: diagramType || undefined });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-3 py-2 text-sm font-medium">AI 助手</header>

      <div className="flex-1 space-y-3 overflow-auto p-3">
        <ChatHistory messages={messages} onSelectPrompt={setInput} />
      </div>

      <div className="space-y-2 border-t p-3">
        {/* 生成目标切换：新建文件 / 修改当前文件 */}
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5 text-xs">
          <button
            type="button"
            className={cn(
              "flex-1 rounded px-2 py-1 transition-colors",
              target === "new" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTarget("new")}
          >
            生成到新文件
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded px-2 py-1 transition-colors",
              target === "current" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            disabled={!activeFileId}
            title={activeFileId ? undefined : "请先打开一个文件"}
            onClick={() => setTarget("current")}
          >
            修改当前文件
          </button>
        </div>

        {/* 图表类型选择器（注入生成提示词） */}
        <div className="flex flex-wrap gap-1">
          {DIAGRAM_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs transition-colors",
                diagramType === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
              onClick={() => setDiagramType((prev) => (prev === t ? "" : t))}
            >
              {t}
            </button>
          ))}
        </div>

        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // 输入法组词过程中（isComposing）回车仅用于确认候选词，不触发发送
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit("generate");
            }
          }}
          placeholder={target === "current" ? "例如：给 User 类新增一个 age 属性" : "例如：生成一个登录类图"}
          disabled={loading}
        />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => submit("generate")} disabled={loading}>
            生成
          </Button>
          <Button className="flex-1" variant="outline" onClick={() => submit("interpret")} disabled={loading}>
            解读
          </Button>

          {/* 模板库：下拉向上、向左展开，避免被面板下缘截断 */}
          <div className="relative" ref={templateWrapRef}>
            <Button
              variant="outline"
              size="icon"
              title="模板库"
              onClick={() => setTemplateMenuOpen((open) => !open)}
            >
              <LayoutTemplate />
            </Button>
            {templateMenuOpen ? (
              <div className="absolute bottom-full right-0 z-50 mb-1 w-60 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                {DIAGRAM_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      void loadTemplate(t);
                      setTemplateMenuOpen(false);
                    }}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {loading ? (
            <Button variant="ghost" onClick={stop}>
              停止
            </Button>
          ) : null}
        </div>

        {/* 撤销 / 重试 操作条 */}
        {canRollback || (!loading && lastError) ? (
          <div className="flex gap-2">
            {canRollback ? (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => void rollback()}>
                <Undo2 />
                撤销 AI 修改
              </Button>
            ) : null}
            {!loading && lastError ? (
              <Button variant="outline" size="sm" className="flex-1" onClick={retry}>
                <Redo2 />
                重试
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

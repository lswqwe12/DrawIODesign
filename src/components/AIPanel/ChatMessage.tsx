"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types/ai";

/** 「正在思考」指示器：转圈 + 动态省略号，等待模型返回时展示 */
function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
      <span>正在思考</span>
      <span className="flex gap-0.5" aria-hidden="true">
        <span className="animate-pulse">·</span>
        <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>·</span>
        <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>·</span>
      </span>
    </div>
  );
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";
  // 等待期间（无正文、无错误）展示「正在思考」，开始输出后自动切换为正文
  const isThinking =
    !isUser && message.thinking && !message.content && !message.error;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "whitespace-pre-wrap break-words bg-primary text-primary-foreground"
            : message.error
              ? "border border-destructive/40 bg-destructive/10 text-destructive"
              : "bg-muted text-foreground"
        )}
      >
        {isThinking ? (
          <ThinkingIndicator />
        ) : isUser || message.error ? (
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.xml ? (
          <div className="mt-1 text-xs text-muted-foreground">
            已加载到编辑器，可在下方「撤销 AI 修改」回滚
          </div>
        ) : null}
      </div>
    </div>
  );
}

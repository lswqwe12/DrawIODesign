"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types/ai";

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {message.content}
        {message.xml ? (
          <div className="mt-1 text-xs text-muted-foreground">
            已生成图表并加载到编辑器
          </div>
        ) : null}
      </div>
    </div>
  );
}

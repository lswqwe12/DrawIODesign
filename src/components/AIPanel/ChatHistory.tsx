"use client";

import type { ChatMessage as ChatMessageType } from "@/types/ai";
import { ChatMessage } from "./ChatMessage";

/** 空对话时的快捷指令模板 */
const QUICK_PROMPTS = [
  "生成一个登录类图",
  "生成一个订单系统的 ER 图",
  "生成一个用户注册时序图",
  "解读当前图表",
];

export function ChatHistory({
  messages,
  onSelectPrompt,
}: {
  messages: ChatMessageType[];
  onSelectPrompt?: (prompt: string) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          输入描述，点击「生成」创建图表，或点击「解读」分析当前图表。
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              onClick={() => onSelectPrompt?.(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <>
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </>
  );
}

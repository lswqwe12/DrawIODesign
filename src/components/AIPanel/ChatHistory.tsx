"use client";

import type { ChatMessage as ChatMessageType } from "@/types/ai";
import { ChatMessage } from "./ChatMessage";

export function ChatHistory({ messages }: { messages: ChatMessageType[] }) {
  if (messages.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        输入描述，点击「生成」创建图表，或点击「解读」分析当前图表。
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

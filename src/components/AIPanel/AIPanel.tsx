"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAI } from "./useAI";
import { ChatHistory } from "./ChatHistory";

export function AIPanel() {
  const { messages, loading, interpret, generate, stop } = useAI();
  const [input, setInput] = useState("");

  const submit = (mode: "interpret" | "generate") => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput("");
    if (mode === "interpret") void interpret(prompt);
    else void generate(prompt);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-3 py-2 text-sm font-medium">AI 助手</header>

      <div className="flex-1 space-y-3 overflow-auto p-3">
        <ChatHistory messages={messages} />
      </div>

      <div className="space-y-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit("generate");
            }
          }}
          placeholder="例如：生成一个登录类图"
          disabled={loading}
        />
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => submit("generate")}
            disabled={loading}
          >
            生成
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => submit("interpret")}
            disabled={loading}
          >
            解读
          </Button>
          {loading ? (
            <Button variant="ghost" onClick={stop}>
              停止
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

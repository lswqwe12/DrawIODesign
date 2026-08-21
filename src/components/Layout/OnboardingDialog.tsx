"use client";

import { useEffect, useState } from "react";
import { FilePlus2, Shapes, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ai-contest:onboarding-done";

interface Step {
  icon: typeof FilePlus2;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: FilePlus2,
    title: "新建一个图表文件",
    description: "从左侧目录栏的三点菜单，或中间空状态按钮新建 .drawio 文件。",
  },
  {
    icon: Shapes,
    title: "拖拽图形设计",
    description: "从左侧图形库拖入 UML 元素搭建图表，也可用顶栏「自动布局」快速整理。",
  },
  {
    icon: Sparkles,
    title: "让 AI 辅助生成",
    description: "在右侧 AI 助手输入描述，一键生成图表，或在当前文件上多轮迭代修改。",
  },
];

/**
 * 首次进入的轻量新手引导（3 步），关闭后写入 localStorage 不再重复展示。
 */
export function OnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">欢迎使用 AI-UML 设计器</DialogTitle>
          <DialogDescription className="text-center">
            三步上手：新建文件 → 拖拽设计 → AI 辅助
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
            <Icon className="size-8" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold">{current.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
          </div>

          {/* 步骤指示点 */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          {/* 快捷键提示 */}
          <div className="w-full rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">常用快捷键</p>
            <p>⌘/Ctrl + S 保存 · ⌘/Ctrl + E 导出 PNG · ⌘/Ctrl + K 搜索文件</p>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={finish}>
            跳过
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                上一步
              </Button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                下一步
              </Button>
            ) : (
              <Button size="sm" onClick={finish}>
                开始使用
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

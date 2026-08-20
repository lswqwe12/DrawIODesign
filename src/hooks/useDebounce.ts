"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 防抖 hook：返回防抖后的函数 + 控制句柄。
 * - debounced：连续调用只保留最后一次，delay 后执行
 * - flush：立即执行最后一次调用（用于 Tab 切换前落库）
 * - cancel：取消待执行
 */
export function useDebounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): {
  debounced: (...args: Args) => void;
  flush: () => void;
  cancel: () => void;
} {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const argsRef = useRef<Args | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    argsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const args = argsRef.current;
    if (args) {
      argsRef.current = null;
      fnRef.current(...args);
    }
  }, []);

  const debounced = useCallback(
    (...args: Args) => {
      argsRef.current = args;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        argsRef.current = null;
        fnRef.current(...args);
      }, delay);
    },
    [delay]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { debounced, flush, cancel };
}

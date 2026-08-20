"use client";

import {
  useDiagramContext,
  type DiagramContextValue,
} from "@/contexts/DiagramContext";

/**
 * useDrawio —— DrawIoEmbed 操作的唯一门面（Facade）。
 *
 * 注意：编辑器会话状态（drawioRef / chartXML / isReady 等）实际由
 * <DiagramProvider> 持有并通过 Context 共享，这样多个组件调用 useDrawio()
 * 拿到的是同一份编辑器实例。draw.io iframe 由 react-drawio <DrawIoEmbed>
 * 渲染并管理 postMessage 协议，业务组件严禁直接操作 iframe / postMessage。
 */
export type UseDrawioReturn = Pick<
  DiagramContextValue,
  | "activeFileId"
  | "getActiveState"
  | "drawioRef"
  | "chartXML"
  | "latestSvg"
  | "isReady"
  | "loadDiagram"
  | "handleLoad"
  | "handleSaveEvent"
  | "handleAutoSaveEvent"
  | "handleExportEvent"
  | "exportDiagram"
  | "handleExport"
  | "flushPendingSave"
  | "cancelPendingSave"
  | "requestOpenFile"
  | "saveDiagram"
  | "clearDiagram"
>;

export function useDrawio(): UseDrawioReturn {
  return useDiagramContext();
}

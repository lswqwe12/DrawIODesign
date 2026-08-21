/**
 * draw.io 导出格式
 */
export type ExportFormat = "html" | "html2" | "svg" | "xmlsvg" | "png" | "xmlpng";

/**
 * DrawIoEmbed 的 URL 参数配置
 */
export interface DrawioUrlParameters {
  embed?: 1;
  proto?: "json";
  ui?: "atlas" | "kennedy" | "min" | "dark";
  spin?: boolean;
  libraries?: boolean;
  saveAndExit?: boolean;
  noSaveBtn?: boolean;
  noExitBtn?: boolean;
  modified?: string;
  keepmodified?: boolean;
  configure?: 1;
}

/**
 * 保存状态指示
 * - saved: 已保存 🟢
 * - saving: 保存中 🟡
 * - dirty: 有未保存更改 🔴
 */
export type SaveStatus = "saved" | "saving" | "dirty";

/**
 * 单个标签页（文件）对应的图表状态
 * 用于 DiagramContext 的多标签页模型：Map<fileId, DiagramState>
 */
export interface DiagramState {
  chartXML: string; // 完整 draw.io XML 骨架
  isAIGenerated: boolean; // 是否由 AI 片段首次包装而来（决定是否需要 wrapMxCells）
  dirty: boolean; // 是否有未保存更改
  saveStatus: SaveStatus;
  lastSavedAt?: number; // 最近一次成功落库的时间戳（用于状态栏展示）
}

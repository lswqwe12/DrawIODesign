import type { UrlParameters } from "react-drawio";

/**
 * draw.io 嵌入 URL 参数（react-drawio <DrawIoEmbed urlParameters> 使用）。
 *
 * - embed=1 & proto=json 由 react-drawio 的 getEmbedUrl 自动追加。
 * - ui='min'：minimal 主题。draw.io 源码中
 *   `new Editor(chrome=='0' || ui=='min', …, editable=chrome!='0')` 会置
 *   chromeless=true 而 editable=true，从而「不创建 File/Edit/View/Arrange 菜单栏，
 *   但保留可编辑」；图形库以浮动「Shapes」窗口、格式面板以浮动「Format」窗口呈现。
 *   这是无需自托管即可屏蔽顶部菜单栏的方式。
 * - noSaveBtn/noExitBtn：隐藏 draw.io 自带的 Save/Exit 按钮，保存统一由宿主触发，
 *   避免触发 react-drawio 的 save→export 回环 bug（该 bug 会把导出产物 data.data
 *   误当作 XML 传给 onSave，导致落库内容损坏）。
 * - spin：加载时显示 spinner；libraries：启用图形库侧栏。
 */
export const drawioUrlParameters: UrlParameters = {
  ui: "min",
  spin: true,
  libraries: true,
  noSaveBtn: true,
  noExitBtn: true,
};

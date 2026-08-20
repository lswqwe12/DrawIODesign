"use client";

import { DrawIoEmbed } from "react-drawio";
import { useDrawio } from "@/hooks/useDrawio";
import { drawioUrlParameters } from "@/config/drawio";

/**
 * DiagramEditor —— react-drawio <DrawIoEmbed> 的唯一渲染点。
 *
 * 职责边界（架构文档 §5.1）：只负责渲染 <DrawIoEmbed> 并转发事件，
 * 严禁在此编写业务逻辑；所有事件处理统一委托给 useDrawio 暴露的方法。
 * 内容加载由 xml={chartXML} prop 驱动（react-drawio 在 init 后 / xml 变化时自动 load）。
 *
 * 注意：刻意不传 onSave —— react-drawio 的 save 事件会被转成 export 回环，
 * 并把导出产物 data.data 误当作 XML 传给 onSave，导致落库内容损坏；
 * 显式保存统一由宿主「保存」按钮调用 saveDiagram（内部走 exportDiagram("xmlsvg")）
 * 完成，draw.io 自带 Save 按钮已通过 noSaveBtn 隐藏。
 */
export default function DiagramEditor() {
  const {
    drawioRef,
    chartXML,
    handleLoad,
    handleAutoSaveEvent,
    handleExportEvent,
  } = useDrawio();

  return (
    <div className="h-full w-full">
      <DrawIoEmbed
        ref={drawioRef}
        xml={chartXML}
        autosave
        urlParameters={drawioUrlParameters}
        onLoad={handleLoad}
        onAutoSave={(data) => handleAutoSaveEvent(data.xml)}
        onExport={handleExportEvent}
      />
    </div>
  );
}

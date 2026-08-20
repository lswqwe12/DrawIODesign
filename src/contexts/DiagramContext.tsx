"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { DrawIoEmbedRef, EventExport, EventLoad } from "react-drawio";
import type { DiagramState, ExportFormat } from "@/types/drawio";
import { wrapMxCells } from "@/lib/xml-helper";
import * as fileService from "@/services/fileService";
import { useDebounce } from "@/hooks/useDebounce";
import { useFileSystemStore } from "@/contexts/FileSystemContext";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";

/** 新建标签页时的默认状态 */
function createInitialState(): DiagramState {
  return {
    chartXML: "",
    isAIGenerated: false,
    dirty: false,
    saveStatus: "saved",
  };
}

/** 未保存更改对话框的三选一结果 */
type UnsavedChoice = "save" | "discard" | "cancel";

/** 挂起的未保存确认请求（由 requestOpenFile 发起，等待用户选择） */
interface ConfirmRequest {
  fileName: string;
  resolve: (choice: UnsavedChoice) => void;
}

export interface DiagramContextValue {
  // ---- 多标签页状态 ----
  /** fileId -> DiagramState（多标签页模型） */
  states: Map<string, DiagramState>;
  /** 当前活跃 fileId */
  activeFileId: string | null;

  openDiagram: (fileId: string, initial?: Partial<DiagramState>) => void;
  closeDiagram: (fileId: string) => void;
  setActiveFileId: (fileId: string | null) => void;
  updateState: (fileId: string, patch: Partial<DiagramState>) => void;
  getState: (fileId: string) => DiagramState | undefined;
  getActiveState: () => DiagramState | null;

  // ---- 编辑器会话（react-drawio 门面） ----
  drawioRef: RefObject<DrawIoEmbedRef>;
  chartXML: string;
  latestSvg: string;
  isReady: boolean;

  loadDiagram: (fileId: string, initial?: Partial<DiagramState>) => void;
  handleLoad: (data: EventLoad) => void;
  handleSaveEvent: (xml: string, fileIdOverride?: string) => Promise<void>;
  handleAutoSaveEvent: (xml: string) => void;
  handleExportEvent: (data: EventExport) => void;
  exportDiagram: (format?: ExportFormat) => Promise<ExportResult>;
  /** 导出并触发浏览器下载（PNG / SVG） */
  handleExport: (format?: ExportFormat) => Promise<void>;
  /** 立即落库尚未执行的防抖自动保存（Tab 切换前调用） */
  flushPendingSave: () => void;
  /** 取消尚未执行的防抖自动保存（放弃更改 / 显式保存后调用） */
  cancelPendingSave: () => void;
  /** 切换打开文件（含未保存更改拦截）：返回 false 表示用户取消切换 */
  requestOpenFile: (fileId: string, initial?: Partial<DiagramState>) => Promise<boolean>;
  saveDiagram: () => Promise<void>;
  clearDiagram: () => void;
}

/** 导出结果：xml 为图表 XML，data 为导出内容（SVG 文本 / PNG data URL） */
export interface ExportResult {
  xml: string;
  data: string;
}

/** 等待导出结果的队列项（exportDiagram 返回 Promise，onExport 时统一 resolve） */
interface ExportWaiter {
  resolve: (result: ExportResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DiagramContext = createContext<DiagramContextValue | null>(null);

export function DiagramProvider({ children }: { children: ReactNode }) {
  const [states, setStates] = useState<Map<string, DiagramState>>(() => new Map());
  const [activeFileId, setActiveFileIdState] = useState<string | null>(null);

  // ---- 编辑器会话状态 ----
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  /** activeFileId 的 ref 镜像：供 react-drawio 的稳定事件回调读取最新值 */
  const activeFileIdRef = useRef<string | null>(null);
  /** 编辑器最近一次产出的 XML（autosave/save/export 时更新） */
  const latestXmlRef = useRef("");
  /** 是否已收到过首个 load 事件（用于把 isReady 置 true，仅一次） */
  const initializedRef = useRef(false);
  /** 等待导出结果的队列（exportDiagram 返回 Promise，onExport 时统一 resolve） */
  const exportWaitersRef = useRef<ExportWaiter[]>([]);
  const [chartXML, setChartXML] = useState("");
  const [latestSvg, setLatestSvg] = useState("");
  const [isReady, setIsReady] = useState(false);

  /** 挂起的未保存确认请求（渲染 UnsavedChangesDialog） */
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  /** 当前活跃文件是否有未保存更改（供 beforeunload 稳定回调读取） */
  const activeDirtyRef = useRef(false);

  // 保持 ref 与 state 同步，供稳定回调读取（react-drawio 的 message 监听只注册一次）
  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

  // 同步「当前文件是否 dirty」到 ref，供 beforeunload 监听器读取
  useEffect(() => {
    activeDirtyRef.current = activeFileId
      ? (states.get(activeFileId)?.dirty ?? false)
      : false;
  }, [activeFileId, states]);

  // 关闭/刷新网页时的未保存提醒（浏览器原生对话框）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!activeDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ---- 多标签页方法 ----

  const openDiagram = useCallback(
    (fileId: string, initial?: Partial<DiagramState>) => {
      setStates((prev) => {
        const next = new Map(prev);
        const current = next.get(fileId) ?? createInitialState();
        next.set(fileId, { ...current, ...initial });
        return next;
      });
      setActiveFileIdState(fileId);
    },
    []
  );

  const closeDiagram = useCallback((fileId: string) => {
    setStates((prev) => {
      const next = new Map(prev);
      next.delete(fileId);
      return next;
    });
    setActiveFileIdState((prev) => (prev === fileId ? null : prev));
  }, []);

  const setActiveFileId = useCallback((fileId: string | null) => {
    setActiveFileIdState(fileId);
  }, []);

  const updateState = useCallback(
    (fileId: string, patch: Partial<DiagramState>) => {
      setStates((prev) => {
        const next = new Map(prev);
        const current = next.get(fileId) ?? createInitialState();
        next.set(fileId, { ...current, ...patch });
        return next;
      });
    },
    []
  );

  const getState = useCallback(
    (fileId: string) => states.get(fileId),
    [states]
  );

  const getActiveState = useCallback(
    () => (activeFileId ? states.get(activeFileId) ?? null : null),
    [activeFileId, states]
  );

  // ---- 保存 / 自动保存 ----

  /**
   * 保存事件（onSave / 自动保存防抖后落库）。
   * 注意：此处 xml 一定是完整骨架，禁止二次 wrapMxCells。
   * @param fileIdOverride 自动保存防抖时传入，避免读取已切换的 activeFileId
   */
  const handleSaveEvent = useCallback(
    async (xml: string, fileIdOverride?: string) => {
      const fileId = fileIdOverride ?? activeFileIdRef.current;
      if (!fileId) return;

      updateState(fileId, { saveStatus: "saving" });
      try {
        await fileService.updateFileContent(fileId, xml);
        updateState(fileId, {
          chartXML: xml,
          isAIGenerated: false,
          dirty: false,
          saveStatus: "saved",
        });
      } catch (err) {
        updateState(fileId, { dirty: true, saveStatus: "dirty" });
        throw err;
      }
    },
    [updateState]
  );

  /** 防抖后的落库动作（500ms）：自动保存时延迟写入 IndexedDB */
  const persistNow = useCallback(
    (xml: string, fileId: string) => {
      void handleSaveEvent(xml, fileId);
    },
    [handleSaveEvent]
  );

  const {
    debounced: debouncedPersist,
    flush: flushPendingSave,
    cancel: cancelPendingSave,
  } = useDebounce(persistNow, 500);

  /**
   * 自动保存事件（draw.io autosave）：
   * 1) 立即标记 dirty + 保存中（黄灯）
   * 2) 防抖 500ms 后真正写入 IndexedDB
   */
  const handleAutoSaveEvent = useCallback(
    (xml: string) => {
      const fileId = activeFileIdRef.current;
      if (!fileId) return;
      latestXmlRef.current = xml;
      updateState(fileId, { dirty: true, saveStatus: "saving" });
      debouncedPersist(xml, fileId);
    },
    [updateState, debouncedPersist]
  );

  // ---- 编辑器会话方法 ----

  /**
   * 切换活跃标签并加载对应图表（无未保存拦截，供 requestOpenFile / AI 流程调用）。
   * 关键逻辑：
   * - 同步左侧目录树选中节点（selectFile），使打开的文件与树节点关联。
   * - AI 片段（isAIGenerated=true）首次加载时 wrapMxCells 包装，否则原样加载。
   * - 传入 initial 时以「全新状态」注册（重置 dirty/saveStatus），避免沿用旧脏状态。
   * - 仅更新 chartXML 状态；内容加载由 <DrawIoEmbed xml={chartXML}> 的 prop effect
   *   驱动（init 后 / xml 变化时自动 load），不在此命令式调用 drawioRef.load。
   */
  const loadDiagram = useCallback(
    (fileId: string, initial?: Partial<DiagramState>) => {
      setActiveFileIdState(fileId);
      // 目录树节点关联：打开的文件即激活节点
      useFileSystemStore.getState().selectFile(fileId);

      // 可选：原子注册标签页状态（双击/搜索/AI 生成时传入），重置为全新状态
      if (initial) {
        setStates((prev) => {
          const next = new Map(prev);
          next.set(fileId, { ...createInitialState(), ...initial });
          return next;
        });
      }

      // 计算最终要加载的 XML（优先用传入 initial，否则回退 Context 中已有状态）
      let xml: string;
      if (initial && initial.chartXML !== undefined) {
        xml = initial.isAIGenerated
          ? wrapMxCells(initial.chartXML)
          : initial.chartXML;
      } else {
        const state = getState(fileId);
        xml = state
          ? state.isAIGenerated
            ? wrapMxCells(state.chartXML)
            : state.chartXML
          : "";
      }

      setChartXML(xml);
      latestXmlRef.current = xml;
      setLatestSvg("");
    },
    [getState]
  );

  /**
   * 收到 draw.io load 事件（每次成功加载后触发）。
   * 首次 load 表示编辑器真正可用，置 isReady=true（仅一次）。
   */
  const handleLoad = useCallback((data: EventLoad) => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      setIsReady(true);
    }
    latestXmlRef.current = data.xml;
  }, []);

  /** 导出事件：解析等待队列，并把最新 XML / 预览图写入 ref */
  const handleExportEvent = useCallback(
    (data: EventExport) => {
      latestXmlRef.current = data.xml;
      setLatestSvg(data.data);
      const waiters = exportWaitersRef.current;
      exportWaitersRef.current = [];
      for (const waiter of waiters) {
        clearTimeout(waiter.timer);
        waiter.resolve({ xml: data.xml, data: data.data });
      }
    },
    []
  );

  const exportDiagram = useCallback(
    (format: ExportFormat = "xmlsvg"): Promise<ExportResult> => {
      return new Promise((resolve, reject) => {
        if (!drawioRef.current) {
          reject(new Error("编辑器尚未就绪，请先打开一个图表"));
          return;
        }
        const waiter: ExportWaiter = {
          resolve,
          timer: setTimeout(() => {
            exportWaitersRef.current = exportWaitersRef.current.filter(
              (w) => w !== waiter
            );
            reject(new Error("导出超时"));
          }, 10000),
        };
        exportWaitersRef.current.push(waiter);
        drawioRef.current.exportDiagram({ format });
      });
    },
    []
  );

  /** 导出并触发浏览器下载（PNG / SVG） */
  const handleExport = useCallback(
    async (format: ExportFormat = "png") => {
      const result = await exportDiagram(format);
      const { data } = result;
      const ext = format === "png" ? "png" : "svg";
      const mime = format === "png" ? "image/png" : "image/svg+xml";

      let blob: Blob;
      if (format === "png") {
        const dataUrl = data.startsWith("data:")
          ? data
          : `data:image/png;base64,${data}`;
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes], { type: mime });
      } else {
        blob = new Blob([data], { type: mime });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diagram-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [exportDiagram]
  );

  /** 显式保存：导出 xmlsvg 并读回完整图表 XML 落库（修正旧 save→export 回环 bug） */
  const saveDiagram = useCallback(async () => {
    const fileId = activeFileIdRef.current;
    if (!fileId) return;
    const result = await exportDiagram("xmlsvg");
    await handleSaveEvent(result.xml, fileId);
  }, [exportDiagram, handleSaveEvent]);

  /** 根据 fileId 取展示用文件名（供未保存确认框显示） */
  const getFileName = useCallback((fileId: string) => {
    const name = useFileSystemStore
      .getState()
      .files.find((f) => f.id === fileId)?.name;
    return name ?? "未命名文件";
  }, []);

  /** 弹出未保存确认框，返回用户三选一结果 */
  const askUnsaved = useCallback(
    (fileName: string) =>
      new Promise<UnsavedChoice>((resolve) => {
        setConfirmRequest({ fileName, resolve });
      }),
    []
  );

  /**
   * 切换打开文件（带未保存更改拦截）。
   * - 当前文件有未保存更改时，弹窗让用户选择「保存 / 不保存 / 取消」。
   * - 返回 false 表示用户取消切换（留在当前文件）。
   * 用户从目录树 / 搜索结果打开文件时统一走此入口。
   */
  const requestOpenFile = useCallback(
    async (fileId: string, initial?: Partial<DiagramState>) => {
      const currentId = activeFileIdRef.current;
      // 重复打开当前文件：直接忽略，避免用已落库的旧内容覆盖编辑器中的未保存更改
      if (currentId === fileId) return true;

      if (currentId) {
        const current = getState(currentId);
        if (current?.dirty) {
          const choice = await askUnsaved(getFileName(currentId));
          if (choice === "cancel") return false;
          // 无论保存还是丢弃，都先取消挂起的防抖自动保存，避免重复/冲突写入
          cancelPendingSave();
          if (choice === "save") {
            await saveDiagram();
          }
        }
      }
      loadDiagram(fileId, initial);
      return true;
    },
    [getState, askUnsaved, getFileName, cancelPendingSave, saveDiagram, loadDiagram]
  );

  const clearDiagram = useCallback(() => {
    const empty = wrapMxCells("");
    setChartXML(empty);
    setLatestSvg("");
    latestXmlRef.current = empty;
  }, []);

  const value = useMemo<DiagramContextValue>(
    () => ({
      states,
      activeFileId,
      openDiagram,
      closeDiagram,
      setActiveFileId,
      updateState,
      getState,
      getActiveState,
      drawioRef,
      chartXML,
      latestSvg,
      isReady,
      loadDiagram,
      handleLoad,
      handleSaveEvent,
      handleAutoSaveEvent,
      handleExportEvent,
      exportDiagram,
      handleExport,
      flushPendingSave,
      cancelPendingSave,
      requestOpenFile,
      saveDiagram,
      clearDiagram,
    }),
    [
      states,
      activeFileId,
      openDiagram,
      closeDiagram,
      setActiveFileId,
      updateState,
      getState,
      getActiveState,
      chartXML,
      latestSvg,
      isReady,
      loadDiagram,
      handleLoad,
      handleSaveEvent,
      handleAutoSaveEvent,
      handleExportEvent,
      exportDiagram,
      handleExport,
      flushPendingSave,
      cancelPendingSave,
      requestOpenFile,
      saveDiagram,
      clearDiagram,
    ]
  );

  /** 结束挂起的未保存确认框（在用户点击任一按钮后 resolve） */
  const settleConfirm = (choice: UnsavedChoice) => {
    setConfirmRequest((prev) => {
      if (prev) prev.resolve(choice);
      return null;
    });
  };

  return (
    <DiagramContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={confirmRequest !== null}
        fileName={confirmRequest?.fileName ?? ""}
        onSave={() => settleConfirm("save")}
        onDiscard={() => settleConfirm("discard")}
        onCancel={() => settleConfirm("cancel")}
      />
    </DiagramContext.Provider>
  );
}

export function useDiagramContext(): DiagramContextValue {
  const ctx = useContext(DiagramContext);
  if (!ctx) {
    throw new Error("useDiagramContext 必须在 <DiagramProvider> 内使用");
  }
  return ctx;
}

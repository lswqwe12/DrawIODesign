# draw.io 集成重构方案（保证 draw.io 与文件系统正常交互）

> 状态：**已实施 ✅**（最终落地为方案 A：保留 react-drawio + 定向修复，而非自写封装）
> 范围：解决 TopBar 重复按钮、draw.io 嵌入通信异常（切换文件不刷新、编辑无法保存）、更换集成方式、屏蔽 draw.io 顶部菜单栏；并顺带修复 AI 生成 XML 的两类非法 XML 报错。
> 前提：不破坏既有硬性约束 —— 所有图表操作仍必须经过 `useDrawio` 门面；MVP 仅 IndexedDB；AI 只产出 `<mxCell>` 片段；`wrapMxCells` 仅在首次加载 AI 片段时执行。

---

## 一、目标

1. 去除「新建文件 / 新建文件夹」的重复入口（TopBar 与 FileManager 二选一）。
2. 修复「切换文件后编辑器不刷新」。
3. 修复「编辑内容无法正确保存」（含显式保存与自动保存两条链路）。
4. 更换 draw.io 集成方式，获得对 `load / export / init` 消息的完全可控能力。
5. 屏蔽 draw.io 顶部 `File / Edit / View / Arrange / Extras / Help` 菜单栏，且**保留编辑能力**。

---

## 二、问题清单与根因分析（已对照源码确认）

### 问题 1：顶部栏出现两层「新建文件 / 新建文件夹」

- 现象：页面顶部（TopBar）与左侧文件管理工具栏（FileManager）各自渲染了一套 `新建文件` + `新建文件夹` 按钮。
- 根因：
  - `src/components/Layout/TopBar.tsx` 第 55–63 行渲染 `FilePlus`（新建文件）、`FolderPlus`（新建文件夹）。
  - `src/components/FileManager/index.tsx` 第 51–59 行渲染**完全相同**的 `FilePlus` / `FolderPlus` 按钮。
  - 两处都调 `createFile / createFolder`，逻辑重复且入口混淆。
- 结论：职责应收敛到**一处**（推荐保留 FileManager 工具栏，TopBar 只做全局搜索 + 导出，见 §五）。

### 问题 2：切换文件后编辑器内容不刷新

- 现象：新建多个文件并切换，编辑区完全不变。
- 根因（`react-drawio` 内部实现，`node_modules/react-drawio/dist/index.js`）：
  1. `xml` prop 的加载是「**声明式 effect + 依赖比较**」驱动，而非命令式：`useEffect(() => { if (isInitialized) action.load({ xml, autosave }); }, [isInitialized, xml, csv, autosave])`。
  2. 该 effect 被 `isInitialized` 门控。`init` 事件到来前 `isInitialized === false`，若此时 `xml` 已变化（首次挂载 + 快速切文件时），effect 直接跳过，**不会**补发 `load`。
  3. 当两个文件的 `xml` 内容**完全相同**时（最典型：两个新建空文件，`chartXML` 均为 `""`），依赖数组中的 `xml` 未变化 → effect 不触发 → **编辑区不重置**。这正是「新建不同文件、切换后界面完全没变化」的直接原因。
  4. 我们的 `DiagramContext.loadDiagram` 同时存在「`setChartXML` 直载」与「`useEffect([activeFileId])` 再调 `loadDiagramInternal` 回读 `getState`」两条路径，切换瞬间可能用旧的 `getState` 闭包覆盖刚设置的内容（对空文件表现为“一直空”，对非空文件表现为“内容对不上”）。
- 结论：不能依赖 `xml` prop 的变化来驱动加载；必须改成**显式命令式 `load({ xml, autosave: 1 })`**，并配一个「编辑器 `init` 就绪前暂存、就绪后补发」的队列。

### 问题 3：编辑内容无法保存 / 保存被污染

- 根因（`react-drawio` 的 `save` 事件 → `export` 回环存在 bug）：
  1. 用户点 draw.io 自带 Save / Save & Exit 时，draw.io 发 `save` 事件；`react-drawio` 收到后**不是**直接把 `data.xml` 交给 `onSave`，而是转而去发一次 `export` 动作（`action.exportDiagram({ format: exportFormat || 'xmlsvg', ... })`），再在 `export` 事件里回填 `onSave`。
  2. 回填时它写的是 `xml: data.data`（`export` 事件里 `data.data` 对 `xmlsvg` 格式是 **SVG 文本**、对 `xmlpng` 是 **Base64 PNG**），而正确的图表 XML 在 `data.xml` 字段。结果：**显式保存落库的是 SVG/PNG，而非 draw.io XML** → 再次打开即损坏。
  3. 自动保存（`autosave` 事件）链路相对正确（`data.xml` 是真 XML），但它依赖 `autosave=1` 被正确传入 `load` 动作；一旦上面的 `load` 因问题 2 未发出，自动保存也不会触发。
- 结论：保存必须显式区分「显式保存」与「自动保存」：
  - 自动保存：直接用 `autosave` 事件的 `data.xml`；
  - 显式保存：**主动发 `export({ format: 'xmlsvg' })`，读回 `EventExport.xml`（不是 `data`）**，再落库。

### 问题 4：需要屏蔽 draw.io 顶部菜单栏（File/Edit/View/Arrange…）

- 关键澄清（已对照 draw.io v31 源码确认）：
  - `chrome=1` = 「**chromeless 只读查看器**」，会**关闭编辑能力**，不是「隐藏菜单栏但保留编辑」的正确开关。
  - **`ui=min` 才是正确开关**：draw.io 源码 `new Editor("0"==urlParams.chrome || "min"==uiTheme, …, editable="0"!=urlParams.chrome)` 会令 `chromeless=true` 且 `editable=true`；而 `EditorUi.createUi()` 中 `menubar/toolbar/sidebar/format` 在 `chromeless` 时均为 `null`，随后 `Minimal.js` 用浮动「Shapes / Format」窗口补偿图形库与格式面板。因此 `ui=min` **能去掉 File/Edit/View/Arrange 菜单栏，同时保留可编辑**，无需自托管。
  - 说明：`ui='atlas'|'kennedy'|'dark'|'sketch'|'simple'` 只是主题/配色，**不**隐藏菜单栏；仅 `ui=min` 走 chromeless 分支。
- 结论：采用 `embed.diagrams.net` + `ui=min` + `noSaveBtn=1` + `noExitBtn=1` 即可；`chrome=1`（只读）排除。若后续需要「保留经典停靠式侧栏、仅隐藏菜单栏」的形态，再走自托管 + CSS 隐藏 `.geMenubarContainer`。

---

## 三、方案选型

| 方案 | 说明 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| A. 保留 `react-drawio`，改用 `ref.load()` 显式加载 | 仍在 DiagramEditor 里用 `<DrawIoEmbed>`，但不再依赖 `xml` prop，改由 `drawioRef.current.load({xml, autosave:1})` 命令式加载 | 改动小 | 无法修复其 `save→export` 回环 `xml: data.data` 的 bug；无法干净屏蔽 menubar；仍受其 effect 干扰 | 不推荐 |
| **B. 自写轻量 `DrawioEmbed` 封装（iframe + JSON postMessage）** | 移除 `react-drawio` 依赖，自己维护 iframe、`init/load/autosave/save/export/exit` 消息收发 | 完全掌控 load/export/init 时序；修复保存 bug；可自托管 + CSS 屏蔽 menubar；`useDrawio` 门面与上层组件**零改动** | 需自己实现约 150 行协议封装 | **推荐** |

> **最终落地结论（实施后修订）：选择方案 A（保留 react-drawio + 定向修复）。**
>
> 方案 B（自写封装）实施后出现「主编辑页一直 Loading 不消失」的问题，根因是自写封装在编辑器 `init` 就绪后没有主动补发一次初始 `load`，而 draw.io 嵌入模式在未收到 `load` 前会一直停留在 `Loading…`（`geStatus`）。该问题与 `ui=min` 无关，react-drawio 自身会在 `init` 后无条件补发初次 `load`，天然规避。
>
> 最终回到方案 A，并对 react-drawio 的已知缺陷做了定向修复（详见 §九）：
> - 切换/加载：改由 `xml={chartXML}` prop 驱动（react-drawio 在 init 后 / xml 变化时自动 load）；删除原先的二次加载 effect。
> - 保存：不接 react-drawio 的 `onSave`（其 save→export 回环会把 `data.data` 当 XML），改用宿主「保存」按钮 → `exportDiagram('xmlsvg')` → 读 `EventExport.xml` 落库；`noSaveBtn=1` 隐藏自带 Save 按钮。
> - 稳定回调：react-drawio 的 message 监听只在挂载时注册一次（空依赖），因此事件回调需稳定化并读 `activeFileIdRef`，避免切文件后自动保存写到错误文件。

---

## 四、目标数据流（重构后必须满足）

```
打开/切换文件
  FileManager/TopBar/AIPanel ──loadDiagram(fileId, {chartXML, isAIGenerated})──▶ useDrawio
  useDrawio:
    1) flush 上一文件的 pending 自动保存
    2) setActiveFileId(fileId) + 注册/更新 Map 状态
    3) xml = isAIGenerated ? wrapMxCells(chartXML) : chartXML   // 仅首次 AI 片段包裹
    4) drawio.load({ xml, autosave: 1 })                        // 显式命令式加载（核心修复）
    5) 若 iframe 尚未 init：把该 load 暂存进 pendingLoad，init 后补发

编辑（draw.io 内任何改动）
  draw.io ──autosave 事件(data.xml)──▶ useDrawio.handleAutoSaveEvent
    → 标记 dirty + saving(🟡) → debounce 500ms → fileService.updateFileContent(fileId, data.xml)
    → 落库成功 → saved(🟢)；失败 → dirty(🔴)

显式保存（无 draw.io 自带按钮，只由宿主触发）
  TopBar/快捷键 ──saveDiagram()──▶ useDrawio
    → drawio.export({ format: 'xmlsvg' })
    → 收到 export 事件 → 读 data.xml（不是 data.data）→ fileService 落库 → saved(🟢)

导出图片
  TopBar ──handleExport('png'|'svg')──▶ useDrawio
    → drawio.export({ format }) → 收到 export 事件 → data.data 转 Blob → 浏览器下载

切换前的落库
  切换/关闭标签时：useDrawio.flushPendingSave() → 立刻执行 pending 自动保存
```

---

## 五、详细设计

### 5.1 目录与文件变更

```
src/
├── components/DiagramEditor/
│   ├── DiagramEditor.tsx        # 改：渲染自写 <DrawioEmbed>，转发事件（仍不做业务）
│   └── DrawioEmbed.tsx          # 新增：iframe + JSON postMessage 封装（替换 react-drawio）
├── lib/
│   └── drawio-protocol.ts       # 新增：postMessage 消息类型/常量/编解码（或并入 DrawioEmbed）
├── config/
│   └── drawio.ts                # 改：embed URL 构造参数（embed=1&proto=json&ui=min&…）
├── hooks/
│   └── useDrawio.ts             # 改：内部改用 load/export 命令式 API（对外签名不变）
├── contexts/
│   └── DiagramContext.tsx       # 改：修正切换/加载时序，接入 init 就绪队列
├── components/Layout/
│   └── TopBar.tsx               # 改：删除 新建文件/新建文件夹 按钮（收敛到 FileManager）
```

删除依赖：`react-drawio`（`package.json` 移除，`types/drawio.ts` 中相关类型改本地定义）。

### 5.2 `DrawioEmbed.tsx`（iframe + JSON 协议封装）

对外 props（`useDrawio` 内部使用，不暴露给业务层）：

```ts
interface DrawioEmbedHandle {
  load: (xml: string, opts?: { autosave?: boolean }) => void;   // 命令式加载
  exportDiagram: (format: ExportFormat, opts?: Partial<ActionExport>) => void;
  isReady: () => boolean;                                        // init 是否已到
}
interface DrawioEmbedProps {
  onInit: () => void;                                            // 收到 init 事件
  onAutoSave: (xml: string) => void;
  onSave: (xml: string) => void;                                 // 宿主显式触发的保存结果
  onExport: (data: { format: ExportFormat; data: string; xml: string }) => void;
  onExit?: (modified: boolean) => void;
}
```

实现要点：
1. **URL 构造**：`https://embed.diagrams.net/?embed=1&proto=json&ui=min&spin=1&libraries=1&noSaveBtn=1&noExitBtn=1`（`noSaveBtn`/`noExitBtn` 隐藏 draw.io 自带保存/退出按钮，避免「Save & Exit」回环触发旧 bug；宿主通过自己的按钮/快捷键触发保存）。后续如需自托管，把 `baseUrl` 换成自托管地址。
2. **消息收发**：
   - 发送：`iframe.contentWindow.postMessage(JSON.stringify({ action: 'load', xml, autosave: 1 }), '*')`；`export` 同理。
   - 接收：`window.addEventListener('message', handler)`，过滤 `origin`（`embed.diagrams.net` 或自托管域名），`JSON.parse` 后按 `event` 分发：`init / load / autosave / save / export / exit / configure`。
3. **init 就绪队列**：`init` 事件前收到的 `load` 请求压入 `pendingRef`；`init` 到达后按序补发（复用现有 `initializedRef` 防 Strict Mode 双触发思路，但把「防重复」从 `handleLoad` 挪到「补发队列」语义上）。
4. **显式保存**：不发 `save`（避免回环），直接 `export({ format: 'xmlsvg' })`；`export` 事件回填 `onSave(data.xml)`。
5. 组件卸载时移除 message listener。

### 5.3 `useDrawio` / `DiagramContext` 修正点

1. `loadDiagram(fileId, initial?)`：
   - 仅负责「切换状态 + 计算最终 XML」，然后调 `drawioRef.current.load(xml, { autosave: true })`。
   - 删除 `useEffect([activeFileId])` 里「回读 `getState` 再 `setChartXML`」的二次加载路径（它是问题 2 根因之一）。改成：activeFileId 变化只做状态切换，加载动作由 `loadDiagram` / AI 生成等入口**显式**触发。
2. `handleAutoSaveEvent(xml)`：逻辑不变（dirty + saving → debounce 500ms → 落库），但确保 `xml` 来自 `autosave` 事件的 `data.xml`。
3. `saveDiagram()`：改为 `exportDiagram('xmlsvg')` 后读 `ExportResult.xml` 落库（修正保存 bug）。
4. `exportDiagram(format)`：保留 Promise 队列（`exportWaitersRef`），`onExport` 时 `resolve({ xml: data.xml, data: data.data })`（**已正确区分 xml 与 data**，现代码已如此，保持不变）。
5. `isReady`：改为由 `init` 事件置 `true`（语义与「编辑器可用」一致）。

### 5.4 保存链路的两条路径（明确定义，避免再次混淆）

| 路径 | 触发 | 数据来源 | 落库 |
|------|------|----------|------|
| 自动保存 | draw.io `autosave` 事件 | `EventAutoSave.xml` | `fileService.updateFileContent(fileId, xml)`（防抖 500ms） |
| 显式保存 | 宿主「保存」按钮/快捷键 | `export('xmlsvg')` → `EventExport.xml` | 同上，立即落库 |

> 关键：**永远不用 `EventExport.data` 作为落库 XML**（对 `xmlsvg` 它是 SVG，对 `png` 它是 Base64）。

---

## 六、菜单栏屏蔽方案（保留编辑能力）

- 首选（零运维）：`embed.diagrams.net` + `ui=min` + `noSaveBtn=1` + `noExitBtn=1`。
  - 效果：**顶部 File/Edit/View/Arrange 菜单栏消失**（chromeless=true + editable=true），图形库/格式面板以浮动窗口呈现，画布可编辑。
- 备选（如需「经典停靠式侧栏、仅隐藏菜单栏」）：**自托管 draw.io**（`jgraph/drawio` 静态站，可放 `public/drawio/` 或独立静态域名），注入 CSS 隐藏 `.geMenubarContainer` / `.geMenubar`，保留停靠侧栏与右侧面板。
  - 注入方式：自托管后直接改 `index.html` 追加 `<style>`，或同源下用 `iframe.contentDocument` 注入 `<style>`。
  - 注意：自托管 draw.io 约 146MB / 3300+ 文件，会显著增大仓库体积，MVP 阶段默认不启用。
- 明确排除：`chrome=1`（只读查看器，与「可编辑」冲突）。

> 注意：自托管 draw.io 是纯前端静态资源，不引入后端；与「MVP 仅 IndexedDB、无后端」约束不冲突。

---

## 七、与既有硬性约束的兼容性

1. **`useDrawio` 门面不变**：`loadDiagram / handleSaveEvent / handleAutoSaveEvent / handleExportEvent / exportDiagram / handleExport / saveDiagram / clearDiagram` 对外签名保持，业务组件（FileManager / AIPanel / TopBar / StatusBar）无需改动接口。
2. **只操作 XML 字符串 + IndexedDB**：不变。
3. **AI 只产出 `<mxCell>`，首次加载才 `wrapMxCells`**：不变；`isAIGenerated` 标记继续作为是否包裹的依据。
4. **`onSave`/`onAutoSave` 落库的是完整骨架、禁止二次包裹**：不变，且在 §5.4 明确落库数据来源，杜绝 SVG/PNG 被当成 XML。

---

## 八、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 自写封装遗漏消息/时序（init 前 load） | 首次加载失败 | init 就绪队列 + 单测/手测「首屏加载、快速切文件、Strict Mode 双触发」 |
| 删除 react-drawio 后类型缺失 | 编译错误 | 在 `types/drawio.ts` 本地重定义 `ExportFormat / EventExport / ActionExport` 等最小类型集 |
| 自托管 draw.io 版本与 CSS 选择器差异 | menubar 屏蔽失效 | 以实际部署版本锁定选择器；提供 `ui=min` 兜底 |
| 显式保存改为 export 后仍有残留 Save 按钮 | 再次触发回环 | `noSaveBtn=1` + `noExitBtn=1` 关闭 draw.io 自带保存/退出按钮，宿主统一入口 |
| 快速切换时 pending 自动保存丢失 | 内容丢失 | 切换前 `flushPendingSave()`（现有逻辑保留）+ 切换后新文件 load 覆盖前完成 flush |

---

## 九、实施记录（最终落地：方案 A）

1. **去重 + 搜索迁移**：删除 TopBar 的「新建文件/新建文件夹」与全局搜索（搜索移入 FileManager 目录上方），TopBar 仅保留 保存 / 导出 PNG / 导出 SVG。
2. **恢复 react-drawio**：`DiagramEditor` 使用 `<DrawIoEmbed ref xml={chartXML} autosave urlParameters onLoad onAutoSave onExport />`；删除自写 `DrawioEmbed.tsx` / `lib/drawio-protocol.ts`。
3. **配置**：`config/drawio.ts` 改为 react-drawio 的 `UrlParameters`，`ui='min'`（屏蔽菜单栏且保留编辑）+ `spin` + `libraries` + `noSaveBtn` + `noExitBtn`。
4. **DiagramContext 修复**：
   - `loadDiagram` 只更新 `chartXML` 状态，不再命令式 `load`，内容加载交给 `xml` prop 驱动。
   - 新增 `activeFileIdRef` 镜像，`handleSaveEvent`/`handleAutoSaveEvent` 读 ref 并保持回调稳定（react-drawio message 监听只注册一次，避免切文件后自动保存写到错误文件）。
   - `handleLoad`（onLoad）首次把 `isReady` 置 true；`handleExportEvent` 读 `EventExport.xml`；`exportDiagram` 用 `exportDiagram({ format })`。
   - 显式保存 `saveDiagram` = `exportDiagram('xmlsvg')` → 读 `result.xml` 落库（修正 save→export 回环 bug）。
5. **文件树整合**：FileManager 改为「工具栏 + 搜索框 + 树形目录」，文件夹展开直接展示子文件夹与文件（`FileTree.tsx`）；删除 `Breadcrumb/FolderTree/FileList`。
6. **联调**：跑通「新建→编辑→切换→自动保存→显式保存→导出→重开」全链路，`tsc` + `next build` + `vitest` 全部通过。

---

## 十、验收标准

1. 顶部与左侧**不再出现**重复的「新建文件/新建文件夹」入口。
2. 连续新建多个文件（含空文件）并来回切换，**编辑区每次都能正确刷新**为对应文件内容。
3. 编辑任意图表后：
   - 停止输入约 500ms，状态灯由 🟡 → 🟢，刷新页面后内容**仍存在**（自动保存落库成功）。
   - 点击「保存」后落库的是**合法 draw.io XML**（可被重新打开，不再出现 SVG/PNG 被当 XML 的情况）。
4. 切换标签页时，上一文件的未保存改动被**立即落库**，不丢失、不串写。
5. 导出 PNG/SVG 正常下载，且文件内容正确。
6. 编辑器顶部 **File/Edit/View/Arrange 菜单栏不可见**，但画布**仍可正常编辑**（加节点、连线、拖拽、改文字）。
7. 全部图表操作仍只通过 `useDrawio` 门面完成，业务组件未直接触碰 iframe/postMessage。

---

## 十一、AI 生成图表 XML 的两类修复

AI 生成链路（`api/ai/generate` + `AIPanel/useAI`）曾出现两类 draw.io 报错，均已修复：

| 报错 | 根因 | 修复 |
|------|------|------|
| `Unescaped '<' not allowed in attributes values` | LLM 输出 `value="List<User>"`、`value="A & B"` 等未转义的 `<`/`&` | `xml-helper.ts` 新增 `escapeXmlAttributeValues`（仅转义属性值、幂等、不二次转义已有实体）；`sanitizeGeneratedCells` 改为「先转义、再提取」 |
| `Opening and ending tag mismatch: mxCell line … and root` | 旧 `extractMxCells` 用正则 `/<mxCell[\s\S]*?(?:\/>|<\/mxCell>)/` 提取，会把 `<mxCell>…<mxGeometry … />…</mxCell>` 这类非自闭合单元格在 `<mxGeometry … />` 处截断，丢失 `</mxCell>` | 重写为**标签栈**提取（`extractCompleteCells`），正确处理非自闭合 / 自闭合 / 嵌套分组，并对漏写 `</mxCell>` 自动补全闭合 |

统一入口：`sanitizeGeneratedCells(raw) = extractMxCells(escapeXmlAttributeValues(raw))`，生成 route 与 useAI 两处均调用。单测见 `src/lib/xml-helper.test.ts`（`npm test`）。

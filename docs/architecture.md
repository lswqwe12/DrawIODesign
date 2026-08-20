# AI辅助UML设计工具 — 技术架构概览

> 基于 `/docs/spec.md`（方案 A：react-drawio）整理。技术底座锁定：**React 18 + Next.js 15 App Router + Tailwind CSS + shadcn/ui**。
>
> 已吸收 `/docs/架构隐患.md` 的审查意见，修正多标签页状态模型、XML 生命周期、请求体大小、容器布局、职责边界、XML 工具、导入解析器、AI 流式类型、Strict Mode 双触发等隐患。

---

## 一、硬性约束

1. **图表操作统一封装**：所有对 draw.io 编辑器的操作（加载、导出、保存、清除、状态读取）**必须**通过 `useDrawio` 自定义 Hook 暴露的方法进行；业务组件（FileManager / AIPanel / TopBar 等）**严禁**直接操作 `DrawIoEmbed` 的 `ref` 或 iframe，也不得直接访问底层 `postMessage` 协议。
2. **文件存储**：MVP 阶段**只用 IndexedDB**（文档 2.1.2），无后端、无文件系统/云存储。以 `.drawio`（XML 字符串）为主要存储格式。
3. **AI 生成 XML 规范**：AI 生成图表时**只生成 `<mxCell>` 元素**，**不含** `id="0"` / `id="1"` 根细胞、不含 `<mxfile>`/`<diagram>` 外层容器（文档 2.3.2）。宿主侧负责在加载时把片段包进合法的 draw.io XML 骨架。
4. **XML 包装只发生一次**：`wrapXml` 仅在「首次加载 AI 片段」时执行；`onSave` / `onAutoSave` 回调返回的 `data.xml` 已是完整骨架，保存时**禁止二次包裹**（否则出现 `<mxfile><mxfile>…` 双重包裹）。
5. 技术底座锁定：**React 18 + Next.js 15 App Router + Tailwind CSS + shadcn/ui**。

---

## 二、技术架构概览

```
┌─────────────────────────────────────────────────────────────┐
│  UI 层（shadcn/ui + Tailwind）                              │
│  TopBar / StatusBar / FileManager / AIPanel / DiagramEditor │
├─────────────────────────────────────────────────────────────┤
│  状态层（Context + Zustand）                                │
│  DiagramContext(多标签页编辑器态) · FileSystemContext(文件树/DB态) │
├─────────────────────────────────────────────────────────────┤
│  逻辑层（Hooks 唯一入口）                                   │
│  useDrawio ★ / useFileSystem / useDebounce / useAI          │
├─────────────────────────────────────────────────────────────┤
│  服务层（services）                                         │
│  db.ts(IndexedDB) · fileService · aiService                 │
├─────────────────────────────────────────────────────────────┤
│  工具层（lib）                                              │
│  xml-helper.ts(XML 包装/校验/解包) · utils.ts(shadcn cn())  │
├─────────────────────────────────────────────────────────────┤
│  第三方集成                                                 │
│  react-drawio(DrawIoEmbed, iframe 隔离) · LLM API(服务端)   │
└─────────────────────────────────────────────────────────────┘
```

**分层原则**：

- **`useDrawio` 是 draw.io 的唯一门面（Facade）**。它内部持有 `DrawIoEmbedRef`、`isReady`、`latestSvg`、`initializedRef`（Strict Mode 防重复初始化锁）等，对外只暴露 `loadDiagram / handleExport / saveDiagram / clearDiagram / importXml / handleSaveEvent` 等语义化方法。任何 UI 组件想要"操作图"，一律调 `useDrawio()`。
- **`FileSystemContext`** 负责文件夹树 + 文件元信息 + IndexedDB CRUD，通过 `fileService` 读写 `db.ts`。编辑器只在"加载文件"和"保存文件"两个节点与文件系统发生数据交换（交换的都是 XML 字符串）。
- **`DiagramContext`** 维护**多标签页**状态：`Map<fileId, DiagramState>` + 活跃 `fileId`，其中 `DiagramState = { chartXML, isAIGenerated, dirty, saveStatus }`。负责脏标记、保存状态指示 🟢/🟡/🔴、自动保存防抖 500ms。
- **`xml-helper.ts`** 是 XML 的唯一处理工具：`wrapMxCells(fragment)`（AI 片段包骨架）、`unwrapDiagram(xml)`（导入时提取 `<mxGraphModel>`）、`isValidDrawioXml(xml)`（校验）。
- **AI** 通过 `aiService` 走 Next.js Route Handler（`/api/ai/*`），密钥只存服务端环境变量，满足安全性要求 3.3。

---

## 三、版本锁定

| 组件 | 锁定版本 | 说明 |
|------|---------|------|
| Node.js | **22.x**（本机 22.20.0） | Next.js 15 要求 Node ≥ 18.18 |
| React | **18.3.1** | 文档要求 React 18+，与 react-drawio 最佳兼容 |
| react-dom | **18.3.1** | 同 React |
| Next.js | **15.1.6**（App Router） | App Router + Route Handlers |
| TypeScript | **^5.6.3** | 全量类型安全 |
| Tailwind CSS | **3.4.17** | shadcn/ui 稳定基于 Tailwind v3 |
| shadcn/ui | **最新 CLI**（`components.json` 生成） | 按需引入，非单一版本包 |
| react-drawio | **^1.6.x**（latest） | 方案 A 核心 |
| zustand | **^5.0.2** | 文件系统全局状态（IndexedDB 异步场景） |
| idb | **^8.0.0** | IndexedDB Promise 化封装 |
| @types/react | **18.3.x** / @types/node **^22** | 类型配套 |

> 说明：React 与 Tailwind 用 18 / v3 是为了最大化与 `react-drawio`、`shadcn/ui` 的兼容稳定性；具体 patch 版本在 `npm install` 时可微调，但大版本严格锁定。

> ⚠️ **Strict Mode 已知问题**：`react-drawio` 在 Next.js 15 开发环境 Strict Mode 下，iframe 的 `onLoad` 可能触发两次，导致编辑器闪烁。**不采用**「关闭 Strict Mode」的方式，而是在 `useDrawio` 内增加 `initializedRef` 防重复初始化锁 + 幂等的 `onLoad` 处理。

---

## 四、完整目录结构（基于文档 4.3，扩展为 Next.js 15 App Router）

```
ai-contest/
├── docs/
│   ├── spec.md
│   ├── architecture.md
│   └── 架构隐患.md
├── public/                              # 静态资源
├── src/
│   ├── app/                             # Next.js App Router
│   │   ├── layout.tsx                   # 根布局（Providers 挂载点）
│   │   ├── page.tsx                     # 首页/工作区入口（重定向或直接渲染工作区）
│   │   ├── globals.css                  # Tailwind 指令 + 主题变量
│   │   ├── (workspace)/
│   │   │   └── page.tsx                 # 工作区：FileManager + DiagramEditor + AIPanel
│   │   └── api/
│   │       └── ai/
│   │           ├── interpret/route.ts   # AI 解读（多模态，注意请求体大小）
│   │           └── generate/route.ts    # AI 生成（XML）
│   │
│   ├── components/
│   │   ├── FileManager/
│   │   │   ├── index.tsx                # ★ Explorer 容器：组合树 + 列表 + 面包屑（唯一对外入口）
│   │   │   ├── FolderTree.tsx           # 左侧树形导航（可折叠）
│   │   │   ├── FileList.tsx             # 右侧文件列表（列表/网格切换）
│   │   │   ├── FileListItem.tsx         # 单文件条目
│   │   │   ├── FileListGrid.tsx         # 网格视图
│   │   │   ├── Breadcrumb.tsx           # 顶栏面包屑导航
│   │   │   ├── ContextMenu.tsx          # 右键上下文菜单
│   │   │   └── FileOperations.ts        # 文件操作常量/工具（新建/重命名/移动/复制/导入导出）
│   │   ├── DiagramEditor/
│   │   │   ├── DiagramEditor.tsx        # DrawIoEmbed 封装（仅渲染 + 事件转发，不做业务逻辑）
│   │   │   └── DiagramEditorToolbar.tsx # 编辑器工具栏（保存/导出/AI入口）
│   │   ├── AIPanel/
│   │   │   ├── AIPanel.tsx              # 右侧滑出对话面板（可调宽）
│   │   │   ├── ChatHistory.tsx          # 对话历史列表
│   │   │   ├── ChatMessage.tsx          # 单条消息
│   │   │   └── useAI.ts                 # AI 交互逻辑 Hook
│   │   ├── Layout/
│   │   │   ├── TopBar.tsx               # 顶部栏
│   │   │   └── StatusBar.tsx            # 状态栏（保存状态 🟢🟡🔴）
│   │   └── ui/                          # shadcn/ui 生成组件
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── tooltip.tsx
│   │       ├── separator.tsx
│   │       ├── scroll-area.tsx
│   │       ├── resizable.tsx
│   │       └── ...                      # 按需补充
│   │
│   ├── contexts/
│   │   ├── DiagramContext.tsx           # 多标签页编辑器状态（Map<fileId, DiagramState>）
│   │   └── FileSystemContext.tsx        # 文件系统全局状态
│   ├── hooks/
│   │   ├── useDrawio.ts                 # ★ DrawIoEmbed 操作唯一封装（含 initializedRef 防重入）
│   │   ├── useFileSystem.ts             # 文件系统操作封装
│   │   └── useDebounce.ts               # 防抖（自动保存 500ms）
│   ├── services/
│   │   ├── db.ts                        # IndexedDB 初始化与封装
│   │   ├── fileService.ts               # 文件夹/文件 CRUD、导入导出、importFromFile 解析器
│   │   └── aiService.ts                 # AI API 调用封装（含 ReadableStream 流式读取）
│   ├── lib/
│   │   ├── utils.ts                     # shadcn/ui cn() 工具
│   │   └── xml-helper.ts                # ★ wrapMxCells / unwrapDiagram / isValidDrawioXml
│   ├── config/
│   │   └── drawio.ts                    # urlParameters / configuration 统一配置
│   └── types/
│       ├── drawio.ts                    # react-drawio 类型扩展 + AI XML 类型
│       ├── file.ts                      # Folder / FileNode / FileMeta 类型
│       └── ai.ts                        # AIStreamChunk / ChatMessage / DiagramState 类型
│
├── .env.local                            # API Key（服务端）
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
└── components.json                       # shadcn/ui 配置
```

**核心差异点说明**（相对文档 4.3 的增强）：

- 文档 4.3 未包含 App Router 结构，我补齐了 `src/app/`（含 `api/ai/*` Route Handlers）、`src/lib`、`src/config`。
- `useDrawio.ts` 在文档中同时出现在 `components/DiagramEditor/` 和 `hooks/` 两处，我**收敛为唯一一份** `src/hooks/useDrawio.ts`，`DiagramEditor/` 目录只保留渲染封装组件，避免双份 Hook 造成状态分裂。
- 依据《架构隐患.md》补充：`FileManager/index.tsx`（Explorer 容器）、`lib/xml-helper.ts`（XML 工具）、`types/ai.ts`（流式类型）、`fileService.importFromFile`（导入解析器）。

---

## 五、关键设计决策

### 1. useDrawio 单一门面 + 职责边界

- `DiagramEditor.tsx` **只负责渲染** `<DrawIoEmbed>` 并**转发事件（emit）**，不包含任何业务逻辑。
- 事件处理逻辑（如 `onSave` → 调 `fileService` 持久化）统一在 `useDrawio` 内部定义并暴露为 `handleSaveEvent` / `handleAutoSaveEvent` / `handleExportEvent` 等，或作为回调通过 props 注入。**禁止**在 `DiagramEditor` 内绕过 `useDrawio` 直接修改 Context / 调用 fileService。

### 2. 多标签页状态模型（修复单例冲突）

- `DiagramContext` 不再保存单一 `chartXML`，而是维护 `Map<fileId, DiagramState>` + 当前活跃 `fileId`。
- `DiagramState = { chartXML, isAIGenerated, dirty, saveStatus }`。
- `useDrawio.loadDiagram(fileId)` 负责切换活跃 `fileId` 并恢复对应 `chartXML`；切换标签页时不会互相覆盖，未保存内容可被保留。

### 3. XML 生命周期（修复双重包裹陷阱）

- AI 只产出 `<mxCell>` 片段，`useDrawio.loadDiagram()` **仅在首次加载 AI 片段**时调用 `xml-helper.wrapMxCells(fragment)` 包成完整骨架。
- `onSave` / `onAutoSave` 回调中的 `data.xml` **一定已是完整骨架**，保存时**直接原样存储**，绝不再次 `wrapXml`。
- 通过 `DiagramState.isAIGenerated` 标志区分「AI 片段」与「完整 XML」，决定是否需要 `wrapMxCells`。
- 导入 `.drawio` / `.xml` 时，`fileService.importFromFile(file)` 用 `DOMParser` 读取文本并 `unwrapDiagram` 提取 `<mxGraphModel>`，确保落库为统一形态。

### 4. 请求体大小（修复 413 / 大 payload 隐患）

> 注意：`next.config.mjs` 里的 `api.bodyParser.sizeLimit` 仅对 **Pages Router** 的 API Routes 生效；Next.js 15 **App Router 的 Route Handler 不读取该配置**，请求体上限由部署平台决定（如 Vercel 约 4.5MB）。因此采用以下正确做法：

- **优先发送矢量文本**：解读导出时默认用 `xmlsvg` / `svg`（远小于 Base64 PNG）。
- **多模态需光栅图时**：客户端在导出 PNG 后先 `canvas` 缩放降采样，再发送，控制 Base64 体积在平台限制内。
- 自托管 Node 服务无 4MB 硬编码限制，但仍需关注内存与超时；`interpret/route.ts` 读取 `await request.json()` 时对体积做防御性校验并返回明确错误。

### 5. FileManager 布局（修复容器缺失）

- 新增 `FileManager/index.tsx` 作为 **Explorer 视图容器**，是文件管理区的唯一对外入口，内部组合 `Breadcrumb`（顶）+ `FolderTree`（左，可折叠）+ `FileList`（右，列表/网格切换）。
- 遵循 spec 2.1.1「左侧文件夹树、右侧文件列表、顶栏面包屑」；如产品倾向 VS Code 式「上树下列」也可在容器内调整，不影响其他模块。

### 6. IndexedDB 结构

- `folders` / `files` 两个 object store；`files.xml` 存 XML 字符串，`folders.parentId` 支持无限层级树。

### 7. AI 流式输出类型

- 在 `types/ai.ts` 定义：
  ```typescript
  export interface AIStreamChunk {
    type: 'start' | 'content' | 'end' | 'error';
    content?: string;
    xml?: string; // 生成图表时，最终携带完整 mxCell 片段
  }
  ```
- `aiService` 读取 `ReadableStream`，逐块解析 `AIStreamChunk`；生成模式在 `end` 块拿到 `xml` 后走 `useDrawio.loadDiagram`。

### 8. Strict Mode 双触发防护

- `useDrawio` 内部使用 `initializedRef`（`useRef<boolean>`）+ 幂等 `onLoad`，避免开发环境 Strict Mode 下 iframe `onLoad` 二次触发导致的闪烁；不采用全局关闭 Strict Mode 的方式。

---

## 六、分步编码计划

- **Step 0**：脚手架初始化（Next.js 15 + TS + Tailwind + shadcn/ui + 依赖锁定）。
- **Step 1**：类型层（`file.ts` / `drawio.ts` / `ai.ts`）+ `lib/xml-helper.ts` + `db.ts` + `fileService`（含 `importFromFile`）+ `FileSystemContext`。
- **Step 2**：`useDrawio`（含 `initializedRef` 防重入）+ `DiagramContext`（多标签页模型）+ `DiagramEditor` + `config/drawio.ts`。
- **Step 3**：文件管理 UI（`FileManager/index.tsx` 容器 + FolderTree / FileList / Breadcrumb / ContextMenu / 拖拽）。
- **Step 4**：AIPanel + `useAI` + `aiService`（流式）+ 两个 Route Handler。
- **Step 5**：TopBar / StatusBar 集成、自动保存防抖、保存状态指示、联调。

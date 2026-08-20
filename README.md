# AI辅助UML设计工具

一个带 AI 辅助能力的在线 UML 建模工具：专业 draw.io 绘图 + 智能文件管理 + AI 解读/生成设计图。

## 功能特性

- 🗂 **文件管理**：无限层级文件夹、文件新建/重命名/移动/复制/删除、导入 `.drawio`/`.xml`、按文件名搜索、树形目录 + 右键菜单
- ✏️ **draw.io 编辑器**：基于 `react-drawio` 深度集成，自动保存（500ms 防抖）、显式保存、导出 PNG / SVG
- 🤖 **AI 能力**：自然语言一句话生成 UML 图（流式输出）、图表智能解读（优先 XML、备选 PNG 多模态）
- 💾 **本地优先存储**：IndexedDB，MVP 阶段无需后端即可使用
- 🔔 **未保存保护**：切换文件 / 关闭网页时提醒保存（保存 / 不保存 / 取消）

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 18.3 · Next.js 15（App Router） |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 3 · shadcn/ui |
| 图表编辑器 | react-drawio |
| 状态管理 | Zustand（文件系统）· React Context（编辑器会话） |
| 本地存储 | idb（IndexedDB） |
| AI | DeepSeek API（服务端代理） |
| 测试 | Vitest |

## 快速开始

### 环境要求

- Node.js ≥ 18.18（推荐 22.x）
- npm / pnpm / yarn

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env.local`，填入 DeepSeek API Key：

```bash
cp .env.example .env.local
```

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

> 密钥仅保存在**服务端**环境变量中。AI 请求由 Next.js Route Handler（`/api/ai/*`）代理转发，不暴露给浏览器。

### 启动开发服务器

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

### 常用脚本

```bash
npm run build   # 生产构建
npm run start   # 启动生产服务
npm run lint    # ESLint 检查
npm test        # 单元测试（Vitest）
```

## 项目结构

```
ai-contest/
├── docs/                                # 产品规格 / 架构 / 路线图
├── public/                              # 静态资源
└── src/
    ├── app/
    │   ├── (workspace)/page.tsx         # 工作区：文件管理 + 编辑器 + AI 面板
    │   ├── api/ai/
    │   │   ├── generate/route.ts        # AI 生成图表（SSE）
    │   │   ├── interpret/route.ts       # AI 解读图表（SSE）
    │   │   └── shared.ts                # DeepSeek 流式调用共享工具
    │   ├── layout.tsx                   # 根布局
    │   └── globals.css                  # Tailwind + shadcn 主题变量
    ├── components/
    │   ├── FileManager/                 # 文件管理（树形目录 + 搜索 + 三点菜单）
    │   ├── DiagramEditor/               # <DrawIoEmbed> 唯一渲染点
    │   ├── AIPanel/                     # AI 对话面板
    │   ├── Layout/                      # TopBar / StatusBar
    │   ├── UnsavedChangesDialog.tsx     # 未保存更改三选一弹窗
    │   └── ui/                          # shadcn/ui 组件
    ├── contexts/
    │   ├── DiagramContext.tsx           # 多文件编辑器状态（Map<fileId, DiagramState>）
    │   └── FileSystemContext.tsx        # 文件系统全局状态（Zustand）
    ├── hooks/
    │   ├── useDrawio.ts                 # ★ draw.io 唯一操作门面
    │   └── useDebounce.ts               # 防抖（自动保存）
    ├── services/
    │   ├── db.ts                        # IndexedDB 初始化
    │   ├── fileService.ts               # 文件/文件夹 CRUD、导入解析
    │   └── aiService.ts                 # AI 流式调用 + 图片缩放
    ├── lib/
    │   ├── xml-helper.ts                # ★ XML 包装/解包/校验/转义
    │   ├── xml-helper.test.ts           # 单元测试
    │   └── utils.ts                     # shadcn cn()
    ├── config/drawio.ts                 # draw.io URL 参数配置
    └── types/                           # drawio / file / ai 类型定义
```

## 核心架构

分层结构（详见 `docs/architecture.md`）：

```
UI 层（shadcn/ui + Tailwind）
   ↓
状态层（DiagramContext · FileSystemContext）
   ↓
逻辑层（useDrawio ★ 唯一门面 / useAI / useDebounce）
   ↓
服务层（db.ts · fileService · aiService）
   ↓
工具层（xml-helper · utils） + 第三方集成（react-drawio · DeepSeek）
```

### 关键约束

1. 所有 draw.io 操作（加载/导出/保存/清除）**必须**经 `useDrawio` 门面；业务组件禁止直接操作 iframe / `postMessage`。
2. MVP 存储**只用 IndexedDB**，以 `.drawio`（XML 字符串）为存储格式。
3. AI 生成时**只产出 `<mxCell>` 片段**（不含 `id="0"/"1"` 根细胞、不含 `<mxfile>` 容器），宿主侧用 `wrapMxCells` 包装一次。
4. 保存/自动保存回调返回的 `data.xml` **已是完整骨架**，禁止二次 `wrapMxCells`。

## 文档

- [`docs/spec.md`](./docs/spec.md) — 产品规格与功能需求
- [`docs/architecture.md`](./docs/architecture.md) — 技术架构与关键设计决策
- [`docs/架构隐患.md`](./docs/架构隐患.md) — 架构审查意见（已吸收修正）
- [`docs/drawio集成重构方案.md`](./docs/drawio集成重构方案.md) — draw.io 集成方案落地记录
- [`docs/后续优化与开发路线图.md`](./docs/后续优化与开发路线图.md) — 后续优化方向与开发需求

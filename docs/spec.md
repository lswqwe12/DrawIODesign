# AI辅助UML设计工具

> **集成方案**：方案A — 采用 `react-drawio` npm 包进行Draw.io编辑器集成


## 一、项目概述

### 1.1 项目背景

本项目旨在构建一个带AI辅助功能的UML设计工具网页应用。产品核心定位为一个具备专业绘图能力、智能文件管理和AI辅助设计能力的在线UML建模平台。

### 1.2 项目目标

- 提供完整的文件夹及设计文件管理体系
- 通过 `react-drawio` npm 包深度集成draw.io编辑器
- 引入AI能力，支持设计图智能解读和自然语言生成设计图

### 1.3 技术选型依据

采用 `react-drawio`（方案A）的核心优势：
- **开箱即用**：提供 React 组件化封装，无需手动处理 iframe 生命周期
- **类型安全**：提供完整的 TypeScript 类型定义（`DrawIoEmbedRef`、`EventSave`、`EventAutoSave` 等）
- **ref 式编程**：通过 `useRef<DrawIoEmbedRef>` 即可调用 `exportDiagram` 等方法
- **事件驱动**：原生支持 `onLoad`、`onAutoSave`、`onSave`、`onExport` 等关键事件
- **社区验证**：已被 `next-ai-draw-io` 等知名开源项目采用并验证


## 二、功能模块详述

### 2.1 模块一：文件夹及设计文件管理

#### 2.1.1 核心功能需求

**（1）文件夹管理**
- 支持创建、重命名、删除文件夹
- 支持无限层级的文件夹嵌套（树形结构）
- 支持文件夹的拖拽移动和排序
- 支持“根目录/我的设计”作为默认工作区

**（2）设计文件管理**
- 支持创建新的UML设计文件（.drawio格式）
- 支持文件的重命名、删除、移动（跨文件夹）
- 支持文件的复制/克隆
- 支持文件的导入（上传已有的.drawio或.xml文件）
- 支持文件的导出（导出为.drawio、.xml、.png、.svg等格式）
- 支持文件的最近修改时间、创建时间、文件大小等元信息展示
- 支持文件的搜索（按文件名搜索）

**（3）文件列表视图**
- 左侧：文件夹树形导航面板（可折叠）
- 右侧：当前文件夹下的文件列表（列表视图或网格视图切换）
- 顶栏：面包屑导航，显示当前路径

**（4）文件操作交互**
- 右键上下文菜单（新建文件/文件夹、重命名、删除、移动等）
- 拖拽文件到不同文件夹
- 双击文件打开编辑

#### 2.1.2 数据存储方案

| 存储方式 | 说明 |
|---------|------|
| 本地存储（IndexedDB） | MVP阶段支持，无需后端 |
| 后端数据库 + 文件存储 | 生产环境推荐 |
| 文件格式 | 以 `.drawio`（XML格式）作为主要存储格式 |


### 2.2 模块二：Draw.io设计工具集成（基于react-drawio）

#### 2.2.1 安装与引入

```bash
npm i react-drawio
# 或
yarn add react-drawio
# 或
pnpm add react-drawio
```



#### 2.2.2 组件基本使用

```tsx
import { DrawIoEmbed, DrawIoEmbedRef } from 'react-drawio';
import { useRef, useState } from 'react';

function DiagramEditor() {
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  const [currentXml, setCurrentXml] = useState<string>('');

  return (
    <DrawIoEmbed
      ref={drawioRef}
      xml={currentXml}
      urlParameters={{
        ui: 'atlas',
        spin: true,
        libraries: true,
        saveAndExit: true,
      }}
      autosave={true}
      onLoad={handleLoad}
      onAutoSave={handleAutoSave}
      onSave={handleSave}
      onExport={handleExport}
      onClose={handleClose}
    />
  );
}
```



#### 2.2.3 DrawIoEmbed Props 完整说明

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ref` | `Ref<DrawIoEmbedRef>` | - | 组件引用，用于调用导出等方法 |
| `xml` | `string` | `undefined` | 预填充编辑器的XML数据 |
| `csv` | `string` | `undefined` | 预填充编辑器的CSV数据 |
| `autosave` | `boolean` | `false` | 启用自动保存，开启后内容变化时触发 `onAutoSave` |
| `urlParameters` | `UrlParameters` | `undefined` | URL参数配置 |
| `configuration` | `Object` | `undefined` | 编辑器配置选项 |
| `exportFormat` | `'html' \| 'html2' \| 'svg' \| 'xmlsvg' \| 'png' \| 'xmlpng'` | `'xmlsvg'` | 默认导出格式 |
| `baseUrl` | `string` | `https://embed.diagrams.net` | 自托管实例URL |
| `onLoad` | `(data: EventLoad) => void` | - | 编辑器加载完成回调 |
| `onAutoSave` | `(data: EventAutoSave) => void` | - | 自动保存触发回调（需 `autosave=true`） |
| `onSave` | `(data: EventSave) => void` | - | 用户点击保存回调 |
| `onClose` | `(data: EventExit) => void` | - | 编辑器退出回调 |
| `onConfigure` | `(data: EventConfigure) => void` | - | 配置事件回调 |
| `onExport` | `(data: EventExport) => void` | - | 导出完成回调 |

#### 2.2.4 URL Parameters 配置详解

`urlParameters` 支持以下参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| `embed` | `1` | **必须**。启用嵌入模式 |
| `proto` | `'json'` | **必须**。启用JSON协议进行消息传递 |
| `ui` | `'atlas' \| 'kennedy' \| 'min' \| 'dark'` | 编辑器主题 |
| `spin` | `boolean` | 显示加载动画 |
| `libraries` | `boolean` | 启用左侧形状库（默认禁用） |
| `saveAndExit` | `boolean` | 显示“保存并退出”按钮 |
| `noSaveBtn` | `boolean` | 隐藏保存按钮，替换为“保存并退出” |
| `noExitBtn` | `boolean` | 隐藏退出按钮 |
| `modified` | `string` | 修改状态提示 |
| `keepmodified` | `boolean` | 保存后保持修改状态 |
| `configure` | `1` | 发送配置事件，等待配置后再初始化 |

**推荐配置：**

```tsx
urlParameters={{
  embed: 1,
  proto: 'json',
  ui: 'atlas',
  spin: true,
  libraries: true,
  saveAndExit: true,
}}
```

#### 2.2.5 核心交互实现

**（1）编辑器加载与初始化**

```tsx
const handleLoad = (data: EventLoad) => {
  console.log('编辑器已加载');
  setIsDrawioReady(true);
  // 如果有XML数据，编辑器会自动加载
};
```

编辑器加载完成后会发送 `init` 事件，宿主应用可在此后发送 `load` 动作加载图表数据。

**（2）文件保存交互**

**手动保存：**
```tsx
const handleSave = (data: EventSave) => {
  // data.xml 包含当前图表的完整XML数据
  saveToFile(currentFileId, data.xml);
  showSaveStatus('已保存');
};
```

用户点击保存按钮或 `Ctrl+S` 时触发。

**自动保存：**
```tsx
// 启用 autosave prop
<DrawIoEmbed
  autosave={true}
  onAutoSave={(data) => {
    // 防抖处理，避免频繁写入
    debouncedSave(currentFileId, data.xml);
  }}
/>
```

开启 `autosave=true` 后，编辑器在内容变化时自动发送 `autosave` 事件。

**保存状态提示：**
- `🟢 已保存` - 文件已持久化
- `🟡 保存中...` - 正在写入
- `🔴 有未保存更改` - 内容已变更但未保存

**（3）文件打开与加载**

```tsx
const openFile = (file: File) => {
  setCurrentXml(file.xmlData);
  // DrawIoEmbed 组件收到 xml prop 变化后自动加载
};
```

通过更新 `xml` prop 即可实现文件加载。

**（4）编程式导出**

```tsx
const handleExportClick = () => {
  if (drawioRef.current) {
    drawioRef.current.exportDiagram({ 
      format: 'xmlsvg'  // 或 'png'、'svg'、'xmlpng'
    });
  }
};

const handleExport = (data: EventExport) => {
  // data.data 包含导出的数据
  downloadFile(data.data, 'diagram.svg');
};
```



**支持的导出格式：**

| 格式 | 说明 |
|------|------|
| `xmlsvg` | 含嵌入式XML的SVG（默认，适合历史快照） |
| `png` | Base64 PNG数据URL |
| `svg` | 纯SVG |
| `xmlpng` | 含嵌入式XML的PNG |

**（5）自定义菜单扩展**

虽然 `react-drawio` 不直接支持自定义菜单注入，但可通过以下方式实现：
- 在宿主应用工具栏中增加自定义按钮（如“保存到我的文件”、“AI解读”）
- 利用 `onConfigure` 事件进行编辑器配置
- 通过 `postMessage` 直接与编辑器通信（高级场景）

```tsx
// 通过 configure 配置编辑器
<DrawIoEmbed
  configuration={{
    defaultFonts: ['Humor Sans'],
    // 其他配置项
  }}
/>
```



**（6）生命周期管理**

```tsx
const handleClose = (data: EventExit) => {
  if (data.modified) {
    // 有未保存更改，提示用户
    showUnsavedWarning();
  }
};
```

编辑器退出时发送 `exit` 事件，包含 `modified` 标志。

#### 2.2.6 通信协议（底层原理）

`react-drawio` 底层使用 HTML5 `postMessage` API 进行通信：

**编辑器 → 宿主（Events）：**

| Event | 说明 | 关键参数 |
|-------|------|---------|
| `init` | 编辑器初始化完成 | - |
| `configure` | 请求宿主配置 | - |
| `autosave` | 自动保存 | `xml` |
| `save` | 用户保存 | `xml` |
| `export` | 导出完成 | `data` |
| `exit` | 编辑器退出 | `modified`, `xml` |

**宿主 → 编辑器（Actions）：**

| Action | 说明 | 关键参数 |
|--------|------|---------|
| `configure` | 配置编辑器 | `config` |
| `load` | 加载图表数据 | `xml`, `title`, `autosave` |
| `export` | 导出图表 | `format`, `xml` |
| `status` | 更新状态 | `messageKey`, `modified` |




### 2.3 模块三：AI辅助功能

#### 2.3.1 AI功能一：设计图智能解读

**功能描述：**
用户对当前UML设计图发起AI解读请求，AI分析图表内容并生成结构化解读报告。

**输入方式：**
- 点击“AI解读”按钮
- 可在输入框中补充解读侧重点（可选）

**技术实现：**

```tsx
const handleInterpret = async () => {
  // 1. 导出当前图表为PNG（用于多模态AI分析）
  if (drawioRef.current) {
    drawioRef.current.exportDiagram({ format: 'png' });
  }
};

const handleExport = async (data: EventExport) => {
  if (data.format === 'png') {
    // 2. 将PNG数据发送给LLM API
    const response = await fetch('/api/ai/interpret', {
      method: 'POST',
      body: JSON.stringify({
        image: data.data,  // Base64 PNG
        context: userInput,
      }),
    });
    // 3. 流式展示解读结果
    streamResponse(response);
  }
};
```

**输出内容：**
- 图表类型识别（类图、时序图、用例图、流程图等）
- 核心元素列举
- 关系分析
- 设计模式识别
- 改进建议

#### 2.3.2 AI功能二：一句话生成设计图

**功能描述：**
用户通过自然语言描述需求，AI自动生成对应的UML设计图并加载到编辑器中。

**支持的图表类型：**
- UML类图、时序图、用例图、状态机图
- 流程图、ERD、系统架构图

**技术实现：**

```tsx
const handleGenerate = async (prompt: string) => {
  // 1. 调用LLM API生成draw.io XML
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: prompt,
      diagramType: selectedType,
    }),
  });
  
  // 2. 解析返回的XML
  const { xml } = await response.json();
  
  // 3. 加载到编辑器
  setCurrentXml(xml);
};
```

**LLM生成XML的核心要求：**
- 生成符合 draw.io/mxGraph DTD 规范的 XML 文档
- 只生成 `<mxCell>` 元素，不包含根细胞（`id="0"` 或 `id="1"`）
- 遵循系统提示词中的 XML 验证规则和结构约束

**对话式迭代优化：**
- 用户可继续提出修改意见
- AI基于当前XML进行增量修改
- 支持多轮对话迭代

#### 2.3.3 AI对话交互界面

**界面布局：**
- 右侧滑出的AI对话面板（可调整宽度）
- 对话历史记录展示
- 输入框 + 发送按钮
- 功能模式切换（“解读图表” / “生成图表”）
- 快捷指令/模板建议

**交互流程：**
1. 用户打开AI面板
2. 选择功能模式
3. 输入文本或点击“解读当前图表”
4. AI处理并流式返回结果
5. 生成图表时自动加载到编辑器
6. 用户可继续对话进行迭代优化


## 三、非功能性需求

### 3.1 性能要求
- 编辑器首次加载时间 < 3秒
- 文件保存响应时间 < 1秒
- AI生成图表响应时间 < 15秒（流式输出）
- 自动保存防抖延迟：500ms

### 3.2 兼容性要求
- 支持 Chrome 90+、Firefox 88+、Edge 90+、Safari 14+
- 响应式设计，适配桌面端（优先）和平板端

### 3.3 安全性要求
- 用户数据隔离
- XSS防护
- AI API密钥安全存储（服务端）

### 3.4 可用性要求
- 直观的拖拽式文件管理
- 清晰的操作反馈
- 键盘快捷键支持
- 操作引导和新手提示


## 四、技术架构

### 4.1 前端技术栈

| 组件 | 推荐方案 | 说明 |
|------|---------|------|
| 框架 | React 18+ | 与 react-drawio 最佳兼容 |
| 状态管理 | Zustand / Context API | 轻量级状态管理 |
| UI组件库 | Ant Design / shadcn/ui | 文件管理、对话面板等 |
| 图表编辑器 | **react-drawio** | **方案A核心组件** |
| HTTP客户端 | Fetch API / Axios | 与后端通信 |

### 4.2 后端技术栈

| 组件 | 推荐方案 |
|------|---------|
| 运行时 | Node.js (Next.js) / Python |
| 框架 | Next.js App Router / FastAPI |
| 数据库 | PostgreSQL / SQLite |
| 文件存储 | 本地文件系统 / 云存储 |
| AI集成 | OpenAI API / Claude API / 智谱AI |

### 4.3 核心目录结构

```
src/
├── components/
│   ├── FileManager/
│   │   ├── FolderTree.tsx
│   │   ├── FileList.tsx
│   │   └── FileOperations.ts
│   ├── DiagramEditor/
│   │   ├── DiagramEditor.tsx      # DrawIoEmbed 封装
│   │   └── useDrawio.ts           # 自定义Hook
│   ├── AIPanel/
│   │   ├── AIPanel.tsx
│   │   ├── ChatHistory.tsx
│   │   └── useAI.ts
│   └── Layout/
│       ├── TopBar.tsx
│       └── StatusBar.tsx
├── contexts/
│   └── DiagramContext.tsx          # 图表状态管理
├── hooks/
│   ├── useDrawio.ts                # DrawIoEmbed 操作封装
│   └── useFileSystem.ts
├── services/
│   ├── fileService.ts
│   └── aiService.ts
└── types/
    └── drawio.ts                   # react-drawio 类型扩展
```

### 4.4 自定义Hook设计（useDrawio）

参考 `next-ai-draw-io` 的 `DiagramContext` 设计：

```tsx
interface UseDrawioReturn {
  chartXML: string;
  latestSvg: string;
  isReady: boolean;
  drawioRef: RefObject<DrawIoEmbedRef>;
  loadDiagram: (xml: string) => void;
  handleExport: (format?: ExportFormat) => void;
  saveDiagram: () => void;
  clearDiagram: () => void;
}

function useDrawio(): UseDrawioReturn {
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  const [chartXML, setChartXML] = useState('');
  const [isReady, setIsReady] = useState(false);

  const loadDiagram = (xml: string) => {
    setChartXML(xml);
  };

  const handleExport = (format: ExportFormat = 'xmlsvg') => {
    drawioRef.current?.exportDiagram({ format });
  };

  return { chartXML, latestSvg, isReady, drawioRef, loadDiagram, handleExport, ... };
}
```


## 五、开发阶段规划

### Phase 1：基础框架（2周）
- 项目初始化，安装 `react-drawio`
- 文件管理界面开发
- 基础文件操作

### Phase 2：Draw.io集成（2-3周）
- `DrawIoEmbed` 组件集成与配置
- 文件打开、保存、自动保存功能
- 导出功能
- 自定义Hook封装

### Phase 3：AI功能开发（3-4周）
- AI对话面板UI开发
- 设计图智能解读（PNG导出 + LLM多模态分析）
- 一句话生成设计图（LLM生成XML）
- LLM API集成与提示词工程

### Phase 4：优化与上线（1-2周）
- 性能优化
- 用户体验打磨
- 测试与Bug修复
- 部署上线


## 六、参考资料

1. react-drawio npm - https://www.npmjs.com/package/react-drawio
2. Draw.io Embed Mode - https://www.drawio.com/docs/reference/embed-mode/
3. Draw.io Integration Protocol - https://deepwiki.com/jgraph/drawio-integration
4. Draw.io Embedding Walkthrough - https://www.drawio.com/docs/tutorials/embedding-walkthrough/
5. next-ai-draw-io - https://github.com/DayuanJiang/next-ai-draw-io
6. drawio-skill - https://github.com/SKgiet2021/drawio-skill
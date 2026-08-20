/**
 * 文件夹节点
 * parentId 为 null 表示位于根目录（"我的设计"）
 */
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * 设计文件元信息
 * xml 以 .drawio（XML 字符串）形式存储，为完整 mxfile 骨架
 */
export interface FileMeta {
  id: string;
  name: string; // 含 .drawio 后缀，如 "类图.drawio"
  folderId: string | null; // null 表示位于根目录
  xml: string; // 完整 draw.io XML
  size: number; // xml 字节数（近似）
  createdAt: number;
  updatedAt: number;
}

/**
 * 用于文件夹树的树形节点（由扁平列表构建）
 */
export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
}

/**
 * 构建文件夹树时，根节点使用固定的虚拟 id
 */
export const ROOT_FOLDER_ID = "__root__";
export const ROOT_FOLDER_NAME = "我的设计";

import { getDB } from "./db";
import type { FileMeta, Folder, FolderTreeNode } from "@/types/file";
import {
  isValidDrawioXml,
  unwrapDiagram,
  wrapMxCells,
} from "@/lib/xml-helper";

/** 生成唯一 id（优先 crypto.randomUUID，降级为时间戳+随机数） */
function generateId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 近似字节大小（UTF-8） */
function byteLength(str: string): number {
  return typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(str).length
    : str.length;
}

/** 空图表的完整骨架（新文件默认内容） */
function emptyDiagram(): string {
  return wrapMxCells("");
}

// ============ 文件夹 ============

export async function listFolders(): Promise<Folder[]> {
  const db = await getDB();
  return db.getAll("folders");
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  const db = await getDB();
  return db.get("folders", id);
}

export async function createFolder(
  name: string,
  parentId: string | null
): Promise<Folder> {
  const db = await getDB();
  const now = Date.now();
  const folder: Folder = {
    id: generateId(),
    name,
    parentId,
    createdAt: now,
    updatedAt: now,
  };
  await db.add("folders", folder);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const db = await getDB();
  const folder = await db.get("folders", id);
  if (!folder) throw new Error(`文件夹不存在: ${id}`);
  folder.name = name;
  folder.updatedAt = Date.now();
  await db.put("folders", folder);
}

/** 判断 folderId 是否位于 subtreeRootId 的子树中（含自身） */
async function isInSubtree(
  db: Awaited<ReturnType<typeof getDB>>,
  folderId: string,
  subtreeRootId: string
): Promise<boolean> {
  const folders = await db.getAll("folders");
  const byId = new Map(folders.map((f) => [f.id, f]));
  const visited = new Set<string>();
  let current: string | null = folderId;
  while (current !== null) {
    if (visited.has(current)) return false; // 异常环，防御
    visited.add(current);
    if (current === subtreeRootId) return true;
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

export async function moveFolder(
  id: string,
  newParentId: string | null
): Promise<void> {
  const db = await getDB();
  const folder = await db.get("folders", id);
  if (!folder) throw new Error(`文件夹不存在: ${id}`);

  if (newParentId !== null && (await isInSubtree(db, newParentId, id))) {
    throw new Error("不能将文件夹移动到自身或其子文件夹");
  }

  folder.parentId = newParentId;
  folder.updatedAt = Date.now();
  await db.put("folders", folder);
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDB();
  const folders = await db.getAll("folders");
  const files = await db.getAll("files");

  // 收集该文件夹及所有子孙文件夹 id
  const toDelete = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders) {
      if (f.parentId !== null && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
        toDelete.add(f.id);
        changed = true;
      }
    }
  }

  const tx = db.transaction(["folders", "files"], "readwrite");
  const folderStore = tx.objectStore("folders");
  const fileStore = tx.objectStore("files");

  for (const fid of toDelete) {
    await folderStore.delete(fid);
  }
  for (const file of files) {
    if (file.folderId !== null && toDelete.has(file.folderId)) {
      await fileStore.delete(file.id);
    }
  }
  await tx.done;
}

// ============ 文件 ============

export async function listAllFiles(): Promise<FileMeta[]> {
  const db = await getDB();
  return db.getAll("files");
}

export async function listFiles(folderId: string | null): Promise<FileMeta[]> {
  const all = await listAllFiles();
  return all.filter((f) => f.folderId === folderId);
}

export async function getFile(id: string): Promise<FileMeta | undefined> {
  const db = await getDB();
  return db.get("files", id);
}

export async function createFile(
  name: string,
  folderId: string | null,
  xml?: string
): Promise<FileMeta> {
  const db = await getDB();
  const now = Date.now();
  const content = xml && isValidDrawioXml(xml) ? xml : emptyDiagram();
  const file: FileMeta = {
    id: generateId(),
    name,
    folderId,
    xml: content,
    size: byteLength(content),
    createdAt: now,
    updatedAt: now,
  };
  await db.add("files", file);
  return file;
}

export async function renameFile(id: string, name: string): Promise<void> {
  const db = await getDB();
  const file = await db.get("files", id);
  if (!file) throw new Error(`文件不存在: ${id}`);
  file.name = name;
  file.updatedAt = Date.now();
  await db.put("files", file);
}

export async function moveFile(
  id: string,
  newFolderId: string | null
): Promise<void> {
  const db = await getDB();
  const file = await db.get("files", id);
  if (!file) throw new Error(`文件不存在: ${id}`);
  file.folderId = newFolderId;
  file.updatedAt = Date.now();
  await db.put("files", file);
}

export async function deleteFile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("files", id);
}

export async function duplicateFile(id: string): Promise<FileMeta> {
  const db = await getDB();
  const file = await db.get("files", id);
  if (!file) throw new Error(`文件不存在: ${id}`);
  const now = Date.now();
  const copy: FileMeta = {
    ...file,
    id: generateId(),
    name: deriveCopyName(file.name),
    createdAt: now,
    updatedAt: now,
  };
  await db.add("files", copy);
  return copy;
}

/** 更新文件内容（编辑器保存/自动保存时调用） */
export async function updateFileContent(id: string, xml: string): Promise<void> {
  const db = await getDB();
  const file = await db.get("files", id);
  if (!file) throw new Error(`文件不存在: ${id}`);
  file.xml = xml;
  file.size = byteLength(xml);
  file.updatedAt = Date.now();
  await db.put("files", file);
}

export async function searchFiles(query: string): Promise<FileMeta[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await listAllFiles();
  return all.filter((f) => f.name.toLowerCase().includes(q));
}

// ============ 导入 / 树构建 ============

/** 生成副本名称：类图.drawio -> 类图 副本.drawio */
function deriveCopyName(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return `${name} 副本`;
  const base = name.slice(0, idx);
  const ext = name.slice(idx);
  return `${base} 副本${ext}`;
}

/** 从 <mxGraphModel> 中提取 <root> 下除根细胞(id="0"/"1")外的 mxCell 片段 */
function extractCellsFromModel(modelXml: string): string {
  const rootMatch = modelXml.match(/<root[\s>][\s\S]*?<\/root>/i);
  if (!rootMatch) return "";
  const cellRe = /<mxCell[\s\S]*?(?:\/>|<\/mxCell>)/gi;
  const cells: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(rootMatch[0])) !== null) {
    const cell = m[0];
    const idMatch = cell.match(/\bid="([^"]*)"/i);
    const id = idMatch ? idMatch[1] : null;
    if (id === "0" || id === "1") continue; // 跳过根细胞
    cells.push(cell);
  }
  return cells.join("\n");
}

/**
 * 导入 .drawio / .xml 文件。
 * 使用 DOMParser 校验并提取 XML，归一化为完整 mxfile 骨架后落库。
 */
export async function importFromFile(
  file: File,
  folderId: string | null,
  name?: string
): Promise<FileMeta> {
  const text = await file.text();
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) throw new Error("导入文件内容为空");

  const doc = new DOMParser().parseFromString(trimmed, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("导入的 XML 格式不正确");
  }

  const model = unwrapDiagram(trimmed);
  if (!model) throw new Error("未找到 <mxGraphModel> 节点");

  // 已是完整 mxfile，直接落库；仅有 model 则重新包裹为规范骨架
  const normalized = isValidDrawioXml(trimmed)
    ? trimmed
    : wrapMxCells(extractCellsFromModel(model));

  const baseName = (name ?? file.name).replace(/\.(drawio|xml)$/i, "");
  const finalName = baseName.endsWith(".drawio") ? baseName : `${baseName}.drawio`;

  return createFile(finalName, folderId, normalized);
}

/**
 * 由扁平文件夹列表构建树形结构（根节点 parentId 为 null）
 */
export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  for (const f of folders) {
    map.set(f.id, { ...f, children: [] });
  }
  const roots: FolderTreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId !== null && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

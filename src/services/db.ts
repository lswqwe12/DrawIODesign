import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { FileMeta, Folder } from "@/types/file";

/**
 * IndexedDB 表结构
 * - folders：文件夹，keyPath = id，by-parent 索引按 parentId 查询
 * - files：设计文件，keyPath = id，by-folder 索引按 folderId 查询
 */
interface UMLDB extends DBSchema {
  folders: {
    key: string;
    value: Folder;
    indexes: { "by-parent": string };
  };
  files: {
    key: string;
    value: FileMeta;
    indexes: { "by-folder": string };
  };
}

export const DB_NAME = "ai-uml-designer";
export const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<UMLDB>> | null = null;

/**
 * 获取（惰性创建）IndexedDB 连接。
 * 仅在客户端调用；SSR 环境下会显式抛错。
 */
export function getDB(): Promise<IDBPDatabase<UMLDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("当前环境不支持 IndexedDB"));
  }

  if (!dbPromise) {
    dbPromise = openDB<UMLDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("folders")) {
          const folderStore = db.createObjectStore("folders", { keyPath: "id" });
          folderStore.createIndex("by-parent", "parentId");
        }
        if (!db.objectStoreNames.contains("files")) {
          const fileStore = db.createObjectStore("files", { keyPath: "id" });
          fileStore.createIndex("by-folder", "folderId");
        }
      },
    });
  }

  return dbPromise;
}

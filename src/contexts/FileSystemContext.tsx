"use client";

import { create } from "zustand";
import type { FileMeta, Folder, FolderTreeNode } from "@/types/file";
import * as fileService from "@/services/fileService";

/**
 * 文件系统全局状态（Zustand）
 *
 * 职责：维护文件夹/文件的扁平列表 + 当前选中项，并对外暴露 CRUD 操作。
 * 所有操作委托给 fileService，落库到 IndexedDB 后统一 refresh。
 */
interface FileSystemState {
  folders: Folder[];
  files: FileMeta[];
  loading: boolean;
  initialized: boolean;
  selectedFolderId: string | null;
  selectedFileId: string | null;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  selectFolder: (folderId: string | null) => void;
  selectFile: (fileId: string | null) => void;

  createFolder: (name: string, parentId: string | null) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  moveFolder: (id: string, newParentId: string | null) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;

  createFile: (name: string, folderId: string | null, xml?: string) => Promise<FileMeta>;
  renameFile: (id: string, name: string) => Promise<void>;
  moveFile: (id: string, newFolderId: string | null) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  duplicateFile: (id: string) => Promise<FileMeta>;
  importFile: (file: File, folderId: string | null) => Promise<FileMeta>;
  saveFileContent: (id: string, xml: string) => Promise<void>;

  folderTree: () => FolderTreeNode[];
  filesInFolder: (folderId: string | null) => FileMeta[];
}

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
  folders: [],
  files: [],
  loading: false,
  initialized: false,
  selectedFolderId: null,
  selectedFileId: null,

  init: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      await get().refresh();
      set({ initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  refresh: async () => {
    const [folders, files] = await Promise.all([
      fileService.listFolders(),
      fileService.listAllFiles(),
    ]);
    set({ folders, files });
  },

  selectFolder: (folderId) => set({ selectedFolderId: folderId, selectedFileId: null }),
  selectFile: (fileId) => set({ selectedFileId: fileId, selectedFolderId: null }),

  createFolder: async (name, parentId) => {
    const folder = await fileService.createFolder(name, parentId);
    await get().refresh();
    return folder;
  },
  renameFolder: async (id, name) => {
    await fileService.renameFolder(id, name);
    await get().refresh();
  },
  moveFolder: async (id, newParentId) => {
    await fileService.moveFolder(id, newParentId);
    await get().refresh();
  },
  deleteFolder: async (id) => {
    await fileService.deleteFolder(id);
    await get().refresh();
  },

  createFile: async (name, folderId, xml) => {
    const file = await fileService.createFile(name, folderId, xml);
    await get().refresh();
    return file;
  },
  renameFile: async (id, name) => {
    await fileService.renameFile(id, name);
    await get().refresh();
  },
  moveFile: async (id, newFolderId) => {
    await fileService.moveFile(id, newFolderId);
    await get().refresh();
  },
  deleteFile: async (id) => {
    await fileService.deleteFile(id);
    await get().refresh();
  },
  duplicateFile: async (id) => {
    const file = await fileService.duplicateFile(id);
    await get().refresh();
    return file;
  },
  importFile: async (file, folderId) => {
    const imported = await fileService.importFromFile(file, folderId);
    await get().refresh();
    return imported;
  },
  saveFileContent: async (id, xml) => {
    await fileService.updateFileContent(id, xml);
    await get().refresh();
  },

  folderTree: () => fileService.buildFolderTree(get().folders),
  filesInFolder: (folderId) => get().files.filter((f) => f.folderId === folderId),
}));

/** 便捷 hook：获取文件系统全局状态 */
export function useFileSystem() {
  return useFileSystemStore();
}

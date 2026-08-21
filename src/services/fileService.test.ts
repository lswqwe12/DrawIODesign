import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { getDB } from "./db";
import {
  buildFolderTree,
  createFile,
  createFolder,
  deleteFolder,
  duplicateFile,
  listAllFiles,
  listFolders,
  moveFile,
  moveFolder,
  renameFile,
  searchFiles,
  updateFileContent,
} from "./fileService";

/** 清空 IndexedDB，隔离各测试用例 */
async function clearDB(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["folders", "files"], "readwrite");
  await tx.objectStore("folders").clear();
  await tx.objectStore("files").clear();
  await tx.done;
}

beforeEach(async () => {
  await clearDB();
});

describe("buildFolderTree", () => {
  it("把扁平文件夹列表构建为树形结构", () => {
    const now = Date.now();
    const folders = [
      { id: "a", name: "A", parentId: null, createdAt: now, updatedAt: now },
      { id: "b", name: "B", parentId: "a", createdAt: now, updatedAt: now },
      { id: "c", name: "C", parentId: "b", createdAt: now, updatedAt: now },
      { id: "d", name: "D", parentId: null, createdAt: now, updatedAt: now },
    ];
    const tree = buildFolderTree(folders);
    expect(tree).toHaveLength(2);
    const a = tree.find((n) => n.id === "a")!;
    expect(a.children).toHaveLength(1);
    expect(a.children[0].id).toBe("b");
    expect(a.children[0].children[0].id).toBe("c");
  });
});

describe("文件夹 CRUD", () => {
  it("createFolder 后 listFolders 可见，且 parentId 正确", async () => {
    const root = await createFolder("根", null);
    const child = await createFolder("子", root.id);
    const all = await listFolders();
    expect(all).toHaveLength(2);
    expect(child.parentId).toBe(root.id);
  });

  it("moveFolder 拒绝移动到自身子树", async () => {
    const a = await createFolder("A", null);
    const b = await createFolder("B", a.id);
    await expect(moveFolder(a.id, b.id)).rejects.toThrow(/自身|子文件夹/);
  });

  it("deleteFolder 级联删除子孙文件夹及其中的文件", async () => {
    const a = await createFolder("A", null);
    const b = await createFolder("B", a.id);
    const f = await createFile("x.drawio", b.id);
    await deleteFolder(a.id);
    expect(await listFolders()).toHaveLength(0);
    expect(await listAllFiles()).toHaveLength(0);
    expect(f.id).toBeTruthy();
  });
});

describe("文件 CRUD", () => {
  it("createFile 无 xml 时写入空骨架", async () => {
    const f = await createFile("类图.drawio", null);
    expect(f.xml).toContain("<mxfile");
    expect(f.xml).toContain('<mxCell id="0"');
  });

  it("createFile 传合法 xml 时原样保存", async () => {
    const f = await createFile("a.drawio", null, "<mxfile><mxGraphModel /></mxfile>");
    expect(f.xml).toBe("<mxfile><mxGraphModel /></mxfile>");
  });

  it("updateFileContent 更新内容与 size", async () => {
    const f = await createFile("a.drawio", null);
    await updateFileContent(f.id, "<mxfile><mxGraphModel><root /></mxGraphModel></mxfile>");
    const got = (await listAllFiles())[0];
    expect(got.xml).toContain("<mxGraphModel");
    expect(got.size).toBeGreaterThan(0);
  });

  it("renameFile 重命名并保留 id", async () => {
    const f = await createFile("a.drawio", null);
    await renameFile(f.id, "b.drawio");
    const got = (await listAllFiles())[0];
    expect(got.id).toBe(f.id);
    expect(got.name).toBe("b.drawio");
  });

  it("moveFile 修改 folderId", async () => {
    const f = await createFile("a.drawio", null);
    const folder = await createFolder("F", null);
    await moveFile(f.id, folder.id);
    expect((await listAllFiles())[0].folderId).toBe(folder.id);
  });

  it("duplicateFile 生成带「副本」后缀的独立副本", async () => {
    const f = await createFile("类图.drawio", null);
    const copy = await duplicateFile(f.id);
    expect(copy.id).not.toBe(f.id);
    expect(copy.name).toBe("类图 副本.drawio");
    expect(await listAllFiles()).toHaveLength(2);
  });

  it("searchFiles 按名称大小写不敏感过滤", async () => {
    await createFile("User类图.drawio", null);
    await createFile("订单.drawio", null);
    const hits = await searchFiles("user");
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe("User类图.drawio");
  });
});

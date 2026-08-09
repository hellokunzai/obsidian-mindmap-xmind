// XMind (.xmind) 文件的读写。
// .xmind 是 ZIP 包，核心数据在 content.json（sheet 数组），
// 另含 metadata.json 与 manifest.json。XMind 要求 JSON 字符串中的 & < > 用字面量，
// JSON.stringify 默认不会转义它们，因此可直接使用。
import JSZip from "jszip";
import type { XSheet } from "./model";

export async function parseXMind(data: ArrayBuffer): Promise<XSheet[]> {
  const zip = await JSZip.loadAsync(data);
  const content = zip.file("content.json");
  if (!content) {
    throw new Error("缺少 content.json，可能不是有效的 XMind 文件");
  }
  const text = await content.async("string");
  const sheets = JSON.parse(text);
  if (!Array.isArray(sheets)) {
    throw new Error("content.json 格式不正确（应为 sheet 数组）");
  }
  return sheets as XSheet[];
}

export async function serializeXMind(sheets: XSheet[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("content.json", JSON.stringify(sheets, null, 2));
  zip.file(
    "metadata.json",
    JSON.stringify(
      {
        creator: { name: "WorkBuddy Obsidian MindMap" },
        dataStructureVersion: "2",
      },
      null,
      2
    )
  );
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        "file-entries": {
          "content.json": { "media-type": "application/json" },
          "metadata.json": { "media-type": "application/json" },
        },
      },
      null,
      2
    )
  );
  return await zip.generateAsync({ type: "arraybuffer" });
}

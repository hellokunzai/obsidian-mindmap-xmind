// XMind (.xmind) 文件的读写。
// .xmind 是 ZIP 包，核心数据在 content.json（sheet 数组），
// 另含 metadata.json 与 manifest.json。XMind 要求 JSON 字符串中的 & < > 用字面量，
// JSON.stringify 默认不会转义它们，因此可直接使用。
import { unzip, zip, strFromU8, strToU8 } from "fflate";
import type { XSheet } from "./model";

function u8FromBuf(buf: ArrayBuffer): Uint8Array {
  return new Uint8Array(buf);
}

function bufFromU8(u8: Uint8Array): ArrayBuffer {
  // fflate 返回的 Uint8Array 可能是更大缓冲区的视图，取 slice 得到独立 ArrayBuffer
  return u8.buffer.slice(
    u8.byteOffset,
    u8.byteOffset + u8.byteLength
  ) as ArrayBuffer;
}

export async function parseXMind(data: ArrayBuffer): Promise<XSheet[]> {
  const entries = await new Promise<Record<string, Uint8Array>>(
    (resolve, reject) => {
      unzip(u8FromBuf(data), (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    }
  );

  const content = entries["content.json"];
  if (!content) {
    throw new Error("缺少 content.json，可能不是有效的 XMind 文件");
  }
  const text = strFromU8(content);
  const sheets = JSON.parse(text);
  if (!Array.isArray(sheets)) {
    throw new Error("content.json 格式不正确（应为 sheet 数组）");
  }
  return sheets as XSheet[];
}

export async function serializeXMind(sheets: XSheet[]): Promise<ArrayBuffer> {
  const files: Record<string, Uint8Array> = {
    "content.json": strToU8(JSON.stringify(sheets, null, 2)),
    "metadata.json": strToU8(
      JSON.stringify(
        {
          creator: { name: "hellokunzai" },
          dataStructureVersion: "2",
        },
        null,
        2
      )
    ),
    "manifest.json": strToU8(
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
    ),
  };

  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  return bufFromU8(zipped);
}

/**
 * Cửa vào duy nhất của engine đọc save.
 *
 * Không phụ thuộc DOM: nhận `ArrayBuffer`, trả object thuần. Nhờ vậy cùng một
 * hàm này chạy được trong Web Worker, trên main thread khi worker hỏng, và
 * trong Node để kiểm chứng trên file save thật (`scripts/probe-save.mjs`).
 *
 * `parseSaveBuffer` KHÔNG BAO GIỜ ném ngoại lệ. Lỗi bất ngờ được gói thành một
 * `SaveIssue` mức error kèm phần dữ liệu đã bóc được — parse dở còn hữu ích hơn
 * là một trang trắng.
 */

import { buildSaveDocument } from "./adapter";
import { buildCareer } from "./career/adapter";
import { readCareerPlayers } from "./career";
import { readContainer } from "./fbchunks";
import { ByteReader } from "./reader";
import { scanSave } from "./tlv";
import type { SaveDocument } from "./types";

export interface ParseOptions {
  fileName?: string;
  onProgress?: (ratio: number) => void;
  /**
   * Mọi playerId có trong roster xuất xưởng của game.
   *
   * Truyền vào để định vị được BẢNG HỌC VIỆN: bảng đó chỉ nhận ra được khi
   * biết ai là cầu thủ do career sinh ra, mà điều đó nằm ở `lib/fc26` — tầng
   * TRÊN tầng này. Nhận qua tham số thay vì import ngược lên, để `lib/save/*`
   * vẫn chạy được bằng Node mà không kéo theo asset.
   *
   * Không truyền thì bỏ qua bảng học viện; mọi thứ khác đọc như cũ.
   */
  shippedIds?: Set<number>;
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function emptyDocument(fileName: string, size: number, message: string): SaveDocument {
  return {
    meta: {
      fileName,
      fileSize: size,
      magic: "",
      isFbchunks: false,
      cmBnryOffset: null,
      headerWords: [],
      parseMs: 0,
      truncated: false,
    },
    counters: {
      fieldCount: 0,
      distinctNameCount: 0,
      stringTokenCount: 0,
      unknownRegionCount: 0,
      unknownBytes: 0,
      looseStringCount: 0,
      coverage: 0,
    },
    fields: [],
    fieldStats: [],
    stringTokens: [],
    unknownRegions: [],
    looseStrings: [],
    career: null,
    issues: [{ level: "error", message }],
  };
}

export function parseSaveBuffer(
  buffer: ArrayBuffer,
  options: ParseOptions = {},
): SaveDocument {
  const fileName = options.fileName ?? "";
  const startedAt = now();

  try {
    const reader = new ByteReader(buffer);
    const container = readContainer(reader);

    // Quét từ đầu file, KHÔNG bắt đầu từ cmBNRY: khảo sát cho thấy field tự mô
    // tả rải khắp file chứ không chỉ trong vùng đó, và bỏ qua phần đầu thì mất
    // luôn cơ hội thấy những gì nằm trước tag.
    const raw = scanSave(reader, { onProgress: options.onProgress });

    // Bảng cầu thủ nằm ở lớp khác hẳn lớp field tự mô tả: nó là bảng nhị phân
    // đóng gói bit, không có tên field đi kèm. Hai lớp đọc độc lập nhau, và một
    // lớp hỏng không được kéo lớp kia theo.
    const career = readCareerPlayers(buffer, options.shippedIds);

    const doc = buildSaveDocument({
      reader,
      container,
      raw,
      fileName,
      parseMs: Math.round(now() - startedAt),
    });
    doc.career = buildCareer(career);
    for (const message of career.issues) doc.issues.push({ level: "warn", message });
    return doc;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lỗi không xác định khi đọc file.";
    return emptyDocument(
      fileName,
      buffer.byteLength,
      `Parser dừng bất ngờ: ${message}. Đây là lỗi của parser, không phải của file — vui lòng ghi lại tên file và báo lại.`,
    );
  }
}

export { ByteReader } from "./reader";
export { scanSave } from "./tlv";
export { readContainer } from "./fbchunks";
export { SAVE_VALUE_TYPES } from "./adapter";
export * from "./types";

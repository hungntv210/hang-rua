/**
 * Chạy engine đọc save ngoài trình duyệt.
 *
 *   npx tsx scripts/probe-save.ts                    # tự kiểm bằng file giả lập
 *   npx tsx scripts/probe-save.ts .local/CmMgrC...   # dò file save thật
 *
 * Đây là lý do `lib/save/*` không được phép chạm DOM. Dự án không có test
 * framework, nên khả năng chạy chính đoạn code đó trên byte thật bằng Node là
 * cách duy nhất kiểm chứng parser mà không phải mở trình duyệt và tin vào mắt.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { parseSaveBuffer } from "../lib/save/index.ts";
import type { SaveDocument } from "../lib/save/types.ts";
import { buildSyntheticSave, FIXTURE_EXPECTATIONS } from "./save-fixture.ts";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function report(doc: SaveDocument): void {
  const { meta, counters } = doc;

  console.log("\n=== FILE ===");
  console.log(`Tên            : ${meta.fileName}`);
  console.log(`Kích thước     : ${formatBytes(meta.fileSize)}`);
  console.log(`Magic          : "${meta.magic}" (FBCHUNKS: ${meta.isFbchunks})`);
  console.log(`cmBNRY offset  : ${meta.cmBnryOffset ?? "không tìm thấy"}`);
  console.log(`Header words   : ${meta.headerWords.join(", ")}`);
  console.log(`Thời gian parse: ${meta.parseMs} ms`);

  console.log("\n=== KẾT QUẢ ===");
  console.log(`Field          : ${counters.fieldCount.toLocaleString("vi-VN")}`);
  console.log(`Tên field khác nhau: ${counters.distinctNameCount.toLocaleString("vi-VN")}`);
  console.log(`Vùng chưa giải mã  : ${counters.unknownRegionCount.toLocaleString("vi-VN")} (${formatBytes(counters.unknownBytes)})`);
  console.log(`Token chuỗi    : ${counters.stringTokenCount.toLocaleString("vi-VN")}`);
  console.log(`Chuỗi rời      : ${counters.looseStringCount.toLocaleString("vi-VN")}`);
  console.log(`Độ phủ         : ${(counters.coverage * 100).toFixed(1)}%`);

  if (doc.issues.length > 0) {
    console.log("\n=== GHI CHÚ ===");
    for (const issue of doc.issues) {
      console.log(`[${issue.level}] ${issue.message}`);
    }
  }

  console.log("\n=== 30 TÊN FIELD PHỔ BIẾN NHẤT ===");
  for (const stat of doc.fieldStats.slice(0, 30)) {
    const count = String(stat.count).padStart(8);
    console.log(
      `${count}  ${stat.name.padEnd(34)} ${stat.types.join("/").padEnd(16)} vd: ${stat.sample.slice(0, 40)}`,
    );
  }

  // Phân bố marker: nếu giả thuyết "byte đánh dấu kiểu" đúng thì bảng này sẽ
  // gọn và tương quan với cột kiểu. Nếu nó tản mát thì giả thuyết sai.
  const markers = new Map<string, number>();
  for (const field of doc.fields) {
    markers.set(field.markerHex, (markers.get(field.markerHex) ?? 0) + 1);
  }
  const topMarkers = [...markers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log("\n=== 4 BYTE ĐỨNG TRƯỚC TÊN FIELD (nghi là byte đánh dấu kiểu) ===");
  for (const [hex, count] of topMarkers) {
    console.log(`${String(count).padStart(8)}  ${hex}`);
  }

  console.log("\n=== 10 VÙNG CHƯA GIẢI MÃ LỚN NHẤT ===");
  for (const region of doc.unknownRegions.slice(0, 10)) {
    console.log(
      `offset ${String(region.offset).padStart(10)}  ${formatBytes(region.length).padStart(9)}  entropy ${region.entropy.toFixed(2)}  ${region.compressionGuess ?? "-"}`,
    );
    console.log(`    ${region.hexPreview}`);
  }

  console.log("\n=== 15 TOKEN CHUỖI ĐẦU TIÊN (file tự khai báo độ dài) ===");
  for (const item of doc.stringTokens.slice(0, 15)) {
    console.log(`offset ${String(item.offset).padStart(10)}  ${item.text.slice(0, 60)}`);
  }

  console.log("\n=== 15 CHUỖI RỜI ĐẦU TIÊN ===");
  for (const item of doc.looseStrings.slice(0, 15)) {
    console.log(`offset ${String(item.offset).padStart(10)}  ${item.text.slice(0, 60)}`);
  }
}

/** Đối chiếu với nội dung đã biết trước của fixture. Thoát mã 1 nếu lệch. */
function selfCheck(doc: SaveDocument): number {
  console.log("\n=== TỰ KIỂM TRÊN FILE GIẢ LẬP ===");
  let failures = 0;

  for (const expected of FIXTURE_EXPECTATIONS) {
    const found = doc.fields.find((field) => field.name === expected.name);
    if (!found) {
      console.log(`FAIL  không tìm thấy field "${expected.name}"`);
      failures += 1;
      continue;
    }
    if (found.type !== expected.type || found.display !== expected.display) {
      console.log(
        `FAIL  ${expected.name}: mong đợi ${expected.type}=${expected.display}, nhận ${found.type}=${found.display}`,
      );
      failures += 1;
      continue;
    }
    console.log(`ok    ${expected.name} = ${found.display} (${found.type}) @ ${found.offset}`);
  }

  const looseHits = ["Jahn Regensburg", "Sligo Rovers"];
  for (const needle of looseHits) {
    const hit = doc.looseStrings.some((item) => item.text.includes(needle));
    console.log(`${hit ? "ok   " : "FAIL "} chuỗi rời "${needle}" ${hit ? "" : "không thấy"}`);
    if (!hit) failures += 1;
  }

  const highEntropy = doc.unknownRegions.some((region) => region.entropy > 7);
  console.log(`${highEntropy ? "ok   " : "FAIL "} có vùng entropy > 7 bit/byte`);
  if (!highEntropy) failures += 1;

  console.log(
    failures === 0
      ? "\nTẤT CẢ ĐỀU ĐẠT."
      : `\n${failures} MỤC KHÔNG ĐẠT.`,
  );
  return failures;
}

function main(): void {
  const path = process.argv[2];

  if (!path) {
    const buffer = buildSyntheticSave();
    const doc = parseSaveBuffer(buffer, { fileName: "fixture-tong-hop.bin" });
    report(doc);
    process.exitCode = selfCheck(doc) === 0 ? 0 : 1;
    return;
  }

  const file = readFileSync(path);
  const buffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer;
  report(parseSaveBuffer(buffer, { fileName: basename(path) }));
}

main();

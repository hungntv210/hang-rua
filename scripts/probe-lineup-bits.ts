/**
 * Dò Ô ĐỘI HÌNH ở tầng BIT trong bản ghi cầu thủ 144 byte.
 *
 *   npx tsx scripts/probe-lineup-bits.ts <save> <fc26_cm_teamsheets.csv>
 *
 * ─── CÂU HỎI ────────────────────────────────────────────────────────────────
 *
 * Save biết rõ 23 người ra sân — hai bảng độc lập cùng cho một danh sách. Thứ
 * chưa tìm được là AI ĐÁ Ô NÀO. Quét theo byte đã cạn: playerId theo thứ tự,
 * chỉ số vào khối đội hình, chỉ số vào bảng cầu thủ, chỉ số vào thứ tự bảng
 * hợp đồng — tất cả 0 kết quả.
 *
 * Còn một chỗ chưa hỏi: chính bản ghi cầu thủ. Nếu mỗi cầu thủ mang một trường
 * "ô trong team sheet" đóng gói bit thì mọi phép quét u32/u16 đều mù với nó.
 *
 * ─── PHÉP THỬ DƯƠNG TÍNH ĐI QUA CÙNG ĐƯỜNG ──────────────────────────────────
 *
 * Dùng `potential` làm chứng: bộ dò phải tìm lại được nó ở ~100% trước khi bất
 * kỳ kết quả âm tính nào có nghĩa. Phiên bản đầu của bộ dò này trượt phép thử
 * đó hai lần — một lần vì bỏ sót độ rộng, một lần vì lập chỉ mục theo chỉ số
 * MẢNG thay vì chỉ số BẢN GHI (`decodeAllPlayers` bỏ qua bản ghi hỏng nên hai
 * thứ lệch dần). Cả hai lần nó vẫn in ra "không tìm thấy" một cách tự tin.
 */
import { readFileSync } from "node:fs";

import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodePlayer } from "../lib/save/career/players";

const [savePath, csvPath] = process.argv.slice(2);
if (!savePath || !csvPath) {
  console.error("dùng: npx tsx scripts/probe-lineup-bits.ts <save> <cm_teamsheets.csv>");
  process.exit(1);
}

const rows = readFileSync(csvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
const head = rows[0].split(",").map((h) => h.trim().toLowerCase());
const cells = rows[1].split(",");
const cell = (name: string) => {
  const i = head.indexOf(name);
  return i < 0 ? null : Number(cells[i]);
};
/** Ô 0–10 là đội hình xuất phát; 11 trở đi là dự bị. */
const slotOf = new Map<number, number>();
for (let i = 0; i < 52; i += 1) {
  const pid = cell(`playerid${i}`);
  if (pid !== null && pid > 0 && !slotOf.has(pid)) slotOf.set(pid, i);
}

const buf = readFileSync(savePath);
const bytes = new Uint8Array(buf);
const loc = locatePlayerTable(bytes);
if (!loc) {
  console.error("không định vị được bảng cầu thủ");
  process.exit(1);
}
const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);

// Chỉ mục theo CHỈ SỐ BẢN GHI — xem chú thích đầu file.
const recOf = new Map<number, number>();
const potentialOf = new Map<number, number>();
for (let i = 0; i < loc.count; i += 1) {
  const p = decodePlayer(reader, i);
  if (!p || p.playerId <= 0 || recOf.has(p.playerId)) continue;
  recOf.set(p.playerId, i);
  if (p.potential !== null) potentialOf.set(p.playerId, p.potential);
}

const TOTAL_BITS = loc.recordBytes * 8;
const MIN_WIDTH = 3;
const MAX_WIDTH = 16;

function scan(label: string, expected: Map<number, number>): boolean {
  const entries = [...expected].filter(([pid]) => recOf.has(pid));
  if (entries.length < 8) {
    console.log(`  ${label}: chỉ ${entries.length} người đối chiếu được — bỏ qua`);
    return false;
  }
  let best = { bit: -1, width: 0, hits: 0, add: 0 };
  for (let bit = 0; bit + MIN_WIDTH <= TOTAL_BITS; bit += 1) {
    for (let width = MIN_WIDTH; width <= MAX_WIDTH && bit + width <= TOTAL_BITS; width += 1) {
      const first = reader.field(recOf.get(entries[0][0])!, bit, width);
      if (first === null) continue;
      const add = entries[0][1] - first;
      let hits = 0;
      for (const [pid, want] of entries) {
        if (reader.field(recOf.get(pid)!, bit, width) === want - add) hits += 1;
      }
      if (hits > best.hits) best = { bit, width, hits, add };
      if (hits === entries.length) {
        console.log(
          `  ${label}: KHỚP HOÀN TOÀN — bit ${bit}, rộng ${width}, cộng ${add} (${hits}/${entries.length})`,
        );
        return true;
      }
    }
  }
  const pct = ((best.hits / entries.length) * 100).toFixed(1);
  console.log(
    `  ${label}: cao nhất ${best.hits}/${entries.length} = ${pct}% — ` +
      `bit ${best.bit}, rộng ${best.width}, cộng ${best.add}`,
  );
  return false;
}

console.log(`bảng cầu thủ: ${loc.count} bản ghi × ${loc.recordBytes} byte`);
console.log(`team sheet: ${slotOf.size} người có ô\n`);

console.log("── phép thử dương tính ──");
const control = new Map<number, number>();
for (const [pid] of slotOf) {
  const v = potentialOf.get(pid);
  if (v !== undefined) control.set(pid, v);
}
const controlOk = scan("potential", control);
if (!controlOk) {
  console.log("\nBỘ DÒ HỎNG — phép thử dương tính không đạt, mọi kết quả dưới đây vô nghĩa.");
  process.exit(1);
}

console.log("\n── ô đội hình ──");
// Cách 1: ô đầy đủ 0..51 cho cả đội hình lẫn dự bị.
scan("ô 0–51 (cả đội)", slotOf);

// Cách 2: chỉ 11 người đá chính, ô 0..10 — bảng có thể chỉ đánh dấu XI.
const xiOnly = new Map([...slotOf].filter(([, s]) => s < 11));
scan("ô 0–10 (chỉ đá chính)", xiOnly);

// Cách 3: cờ nhị phân "có đá chính không" — rẻ nhất về bit, và là thứ tối
// thiểu cần để dựng đội hình nếu vị trí suy từ vị trí sở trường.
const isStarter = new Map([...slotOf].map(([pid, s]) => [pid, s < 11 ? 1 : 0]));
scan("cờ đá chính (0/1)", isStarter);

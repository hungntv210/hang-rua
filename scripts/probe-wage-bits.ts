/**
 * Dò LƯƠNG ở tầng BIT trong bản ghi cầu thủ 144 byte.
 *
 *   npx tsx scripts/probe-wage-bits.ts <save> <fc26_career_playercontract.csv>
 *
 * ─── VÌ SAO DÒ LẠI CHỖ ĐÃ BỊ LOẠI ───────────────────────────────────────────
 *
 * `scripts/probe-wage.ts` loại bản ghi cầu thủ bằng LẬP LUẬN: bảng `players`
 * của game có 149 cột và không cột nào là lương, nên lương phải ở bảng khác.
 * Lập luận đúng về bảng GỐC — nhưng bản ghi trong save là bản tuần tự hoá
 * riêng của save, và nó có thể mang thêm trường của career mà bảng gốc không
 * có. Đó là suy diễn, không phải phép đo, nên chỗ này chưa thật sự bị loại.
 *
 * Quét theo byte đã dò cạn và không thấy gì: 843 lần playerId xuất hiện, chỉ
 * 20 lần có lương trong bán kính 512 byte và không ở khoảng cách cố định nào.
 * Nếu lương đóng gói bit thì mọi phép quét u32/u16 đều mù với nó.
 *
 * ─── PHÉP THỬ DƯƠNG TÍNH ĐI QUA CÙNG ĐƯỜNG ──────────────────────────────────
 *
 * Trước khi tin bất kỳ kết quả âm tính nào, bộ dò phải tìm lại được một trường
 * ĐÃ BIẾT bằng đúng cơ chế đó. Ở đây dùng `potential` (bit 520, rộng 7). Không
 * đạt ~100% thì bộ dò hỏng, và mọi kết luận "không tìm thấy" là vô nghĩa —
 * bài học đã trả giá một lần trong dự án này.
 */
import { readFileSync } from "node:fs";

import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodePlayer } from "../lib/save/career/players";

const [savePath, csvPath] = process.argv.slice(2);
if (!savePath || !csvPath) {
  console.error("dùng: npx tsx scripts/probe-wage-bits.ts <save> <career_playercontract.csv>");
  process.exit(1);
}

const rows = readFileSync(csvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
const head = rows[0].split(",").map((h) => h.trim().toLowerCase());
const iPid = head.indexOf("playerid");
const iWage = head.indexOf("wage");
if (iPid < 0 || iWage < 0) {
  console.error("CSV phải có cột `playerid` và `wage`");
  process.exit(1);
}
const wageOf = new Map<number, number>();
for (const line of rows.slice(1)) {
  const c = line.split(",");
  const pid = Number(c[iPid]);
  const w = Number(c[iWage]);
  if (Number.isFinite(pid) && Number.isFinite(w) && w > 0) wageOf.set(pid, w);
}

const buf = readFileSync(savePath);
const bytes = new Uint8Array(buf);
const loc = locatePlayerTable(bytes);
if (!loc) {
  console.error("không định vị được bảng cầu thủ");
  process.exit(1);
}
const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);
/*
 * Lập chỉ mục theo CHỈ SỐ BẢN GHI, không theo chỉ số mảng.
 *
 * `decodeAllPlayers` bỏ qua bản ghi hỏng, nên mảng nó trả về ngắn hơn bảng
 * (21.647 so với 21.679) và chỉ số lệch dần kể từ lần bỏ đầu tiên. Phiên bản
 * đầu của script này dùng chỉ số mảng và vì thế đọc bit của NGƯỜI KHÁC — đủ
 * để làm phép thử dương tính tụt xuống 25% và mọi kết luận sau đó vô nghĩa.
 */
const recOf = new Map<number, number>();
const potentialOf = new Map<number, number>();
for (let i = 0; i < loc.count; i += 1) {
  const p = decodePlayer(reader, i);
  if (!p || p.playerId <= 0 || recOf.has(p.playerId)) continue;
  recOf.set(p.playerId, i);
  if (p.potential !== null) potentialOf.set(p.playerId, p.potential);
}

const targets = [...wageOf.entries()].filter(([pid]) => recOf.has(pid));
console.log(`bảng cầu thủ: ${loc.count} bản ghi × ${loc.recordBytes} byte (${loc.recordBytes * 8} bit)`);
console.log(`đối chiếu được ${targets.length}/${wageOf.size} cầu thủ có lương\n`);

const TOTAL_BITS = loc.recordBytes * 8;
const MIN_WIDTH = 4;
const MAX_WIDTH = 30;

/**
 * Các phép biến đổi cần thử.
 *
 * Lương thường là bội của 100 hoặc 500, nên game rất có thể lưu `wage/100` để
 * tiết kiệm bit: 70.000 cần 17 bit ở dạng thô nhưng chỉ 10 bit khi chia 100.
 */
const FORMS: Array<{ name: string; of: (wage: number) => number | null }> = [
  { name: "thô", of: (w) => w },
  { name: "/100", of: (w) => (w % 100 === 0 ? w / 100 : null) },
  { name: "/500", of: (w) => (w % 500 === 0 ? w / 500 : null) },
  { name: "/1000", of: (w) => (w % 1000 === 0 ? w / 1000 : null) },
];

/**
 * Quét mọi (bit, độ rộng), tự SUY hằng cộng từ dữ liệu.
 *
 * Không so bit thô với giá trị mong đợi: schema của dự án cho thấy trường
 * thật thường lệch một hằng số (`potential: f(520, 7, 1)`, `contractUntil:
 * f(590, 6, 1984)`). Phiên bản đầu của script này bỏ qua điều đó và làm chính
 * phép thử dương tính trượt — `potential` chỉ đạt 4/40 trong khi nó nằm ngay
 * ở bit 520.
 *
 * Cách đúng: lấy hằng cộng của người ĐẦU TIÊN rồi đòi mọi người còn lại khớp
 * với cùng hằng đó. Một trường thật cho một hằng duy nhất; trùng hợp thì không.
 */
function scan(label: string, expected: Map<number, number>): void {
  const entries = [...expected];
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
        return;
      }
    }
  }
  const pct = ((best.hits / entries.length) * 100).toFixed(1);
  console.log(
    `  ${label}: cao nhất ${best.hits}/${entries.length} = ${pct}% — ` +
      `bit ${best.bit}, rộng ${best.width}, cộng ${best.add}`,
  );
}

// ── Phép thử dương tính ─────────────────────────────────────────────────────
console.log("── phép thử dương tính: tìm lại `potential` (bit 520, rộng 7) ──");
const control = new Map<number, number>();
for (const [pid] of targets) {
  const v = potentialOf.get(pid);
  if (v !== undefined) control.set(pid, v);
}
scan("potential", control);

// ── Lương ───────────────────────────────────────────────────────────────────
console.log("\n── lương ──");
for (const form of FORMS) {
  const want = new Map<number, number>();
  for (const [pid, w] of targets) {
    const v = form.of(w);
    if (v !== null) want.set(pid, v);
  }
  if (want.size < 10) {
    console.log(`  ${form.name}: chỉ ${want.size} cầu thủ hợp dạng này — bỏ qua`);
    continue;
  }
  scan(`${form.name} (${want.size} người)`, want);
}

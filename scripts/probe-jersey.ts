/**
 * Số áo có nằm trong bản ghi cầu thủ không?
 *
 *   npx tsx scripts/probe-jersey.ts <save> <fc26_teamplayerlinks.csv> <teamid>
 *
 * ─── VÌ SAO HỎI ─────────────────────────────────────────────────────────────
 *
 * Số áo đang lấy từ bảng team sheet nướng sẵn. Bỏ bảng đó đi thì mất số áo, và
 * áo không số làm sơ đồ mất gần hết thông tin nhận dạng nhanh.
 *
 * ─── VÌ SAO 24 MẪU LÀ ĐỦ ────────────────────────────────────────────────────
 *
 * Ít mẫu thường là lý do để không tin kết quả. Ở đây thì không: một trường 5 bit
 * trùng khít cả 24 giá trị do may là (1/32)^24, nhân với ~1.152 vị trí bit và
 * vài bề rộng vẫn là số không thực tế. Với cổng 100% thì 24 mẫu an toàn tuyệt
 * đối — điều KHÔNG đúng nếu hạ ngưỡng xuống 90%.
 *
 * ─── DỰ ĐOÁN TRƯỚC KHI CHẠY ─────────────────────────────────────────────────
 *
 * Nhiều khả năng KHÔNG có: số áo thuộc về cặp (cầu thủ, đội) chứ không thuộc về
 * cầu thủ — một người có số khác nhau ở CLB và đội tuyển. Ghi dự đoán ra đây để
 * kết quả âm tính vẫn là một phép đo chứ không phải một sự thất vọng.
 */
import { readFileSync } from "node:fs";

import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { CORE_FIELDS, PLAYER_RECORD_BYTES } from "../lib/save/career/schema";

const RECORD_BITS = PLAYER_RECORD_BYTES * 8;

const [savePath, csvPath, teamId] = process.argv.slice(2);
if (!savePath || !csvPath || !teamId) {
  console.error("dùng: npx tsx scripts/probe-jersey.ts <save> <teamplayerlinks.csv> <teamid>");
  process.exit(1);
}

const bytes = new Uint8Array(readFileSync(savePath));
const loc = locatePlayerTable(bytes);
if (!loc) {
  console.error("không định vị được bảng cầu thủ");
  process.exit(1);
}
const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);

const text = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
const ci = (n: string) => cols.indexOf(n);

const want = new Map<number, number>();
for (const l of lines.slice(1)) {
  const c = l.split(",");
  if (c[ci("teamid")] !== teamId) continue;
  want.set(Number(c[ci("playerid")]), Number(c[ci("jerseynumber")]));
}
console.log(`ground truth: ${want.size} cầu thủ của đội ${teamId}`);

// Ghép bản ghi ↔ số áo.
const rows: Array<{ record: number; jersey: number }> = [];
for (let r = 0; r < loc.count; r += 1) {
  const pid = reader.field(r, CORE_FIELDS.playerId.bit, CORE_FIELDS.playerId.width);
  if (pid === null) continue;
  const j = want.get(pid);
  if (j !== undefined) rows.push({ record: r, jersey: j });
}
console.log(`ghép được ${rows.length} bản ghi\n`);
if (rows.length < 10) {
  console.error("quá ít mẫu để kết luận bất cứ điều gì. Dừng.");
  process.exit(1);
}

/** Mode — suy hằng số cộng từ dữ liệu, không đoán. */
function mode(values: number[]): number {
  const m = new Map<number, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  let best = 0;
  let bestN = 0;
  for (const [v, n] of m) if (n > bestN) { best = v; bestN = n; }
  return best;
}

const hits: Array<{ bit: number; width: number; add: number }> = [];
for (let width = 5; width <= 8; width += 1) {
  for (let bit = 0; bit + width <= RECORD_BITS; bit += 1) {
    const raws: number[] = [];
    let short = false;
    for (const r of rows) {
      const v = reader.field(r.record, bit, width);
      if (v === null) { short = true; break; }
      raws.push(v);
    }
    if (short) continue;
    // Chặn bẫy hằng số: trường không đổi thì mọi "khớp" đều vô nghĩa.
    if (new Set(raws).size < 8) continue;

    const add = mode(rows.map((r, i) => r.jersey - raws[i]));
    let hit = 0;
    for (let i = 0; i < rows.length; i += 1) if (raws[i] + add === rows[i].jersey) hit += 1;
    if (hit === rows.length) hits.push({ bit, width, add });
  }
}

if (hits.length === 0) {
  console.log("KHÔNG có trường nào khớp 100% — số áo không nằm trong bản ghi cầu thủ.");
  console.log("Đúng như dự đoán: số áo thuộc về cặp (cầu thủ, đội), không thuộc về cầu thủ.");
} else {
  console.log("trường khớp 100%:");
  for (const h of hits.slice(0, 8)) {
    console.log(`  bit ${h.bit} rộng ${h.width} add ${h.add}`);
  }
}

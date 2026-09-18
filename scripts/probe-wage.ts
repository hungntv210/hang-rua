/**
 * Dò bảng hợp đồng career (`career_playercontract`) trong save — để lấy LƯƠNG.
 *
 *   npx tsx scripts/probe-wage.ts <save> <fc26_career_playercontract.csv>
 *
 * ─── VÌ SAO KHÔNG DÒ TRONG BẢN GHI CẦU THỦ ──────────────────────────────────
 *
 * Lương không nằm ở đó. Export Live Editor cho thấy `players` (21.437 dòng, 149
 * cột) KHÔNG có cột lương nào; lương chỉ có ở `career_playercontract`, một bảng
 * 45 dòng chỉ chứa hai CLB mà người chơi cầm. Nên đây là bài toán định vị BẢNG
 * KHÁC, cùng loại với `squad.ts`, chứ không phải bài toán dò bit.
 *
 * ─── CÁCH LÀM ───────────────────────────────────────────────────────────────
 *
 * Bảng có 45 dòng và mỗi dòng có `playerid`. Nếu lưu dạng mảng bản ghi cố định
 * thì các playerid ấy phải xuất hiện trong file cách nhau ĐÚNG một bước. Nên:
 *
 *   1. tìm mọi offset mà u32 little-endian bằng một playerid đã biết;
 *   2. với mỗi (neo, bước), đếm xem bao nhiêu playerid rơi đúng vào lưới;
 *   3. với lưới tốt nhất, dò xem lương nằm ở byte nào trong bản ghi.
 *
 * Bước 3 là thứ phân biệt một bảng thật với một trùng hợp: 45 số lương khớp
 * đúng một vị trí cố định thì không thể do may.
 */
import { readFileSync } from "node:fs";

/** Bước bản ghi hợp lý cho một bảng 15 cột. */
const MIN_STRIDE = 8;
const MAX_STRIDE = 512;
/** Dưới mức này thì lưới chỉ là trùng hợp. */
const MIN_GRID_HITS = 20;

const [savePath, csvPath] = process.argv.slice(2);
if (!savePath || !csvPath) {
  console.error("dùng: npx tsx scripts/probe-wage.ts <save> <fc26_career_playercontract.csv>");
  process.exit(1);
}

const bytes = new Uint8Array(readFileSync(savePath));
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const text = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
const ci = (n: string) => cols.indexOf(n);

interface Contract {
  playerid: number;
  wage: number;
  teamid: number;
  duration: number;
}
const truth: Contract[] = lines.slice(1).map((l) => {
  const c = l.split(",");
  return {
    playerid: Number(c[ci("playerid")]),
    wage: Number(c[ci("wage")]),
    teamid: Number(c[ci("teamid")]),
    duration: Number(c[ci("duration_months")]),
  };
});
const wageOf = new Map(truth.map((t) => [t.playerid, t.wage]));
console.log(
  `ground truth: ${truth.length} hợp đồng, lương ${Math.min(
    ...truth.map((t) => t.wage),
  )} … ${Math.max(...truth.map((t) => t.wage))}`,
);

// ── 1. Mọi offset chứa một playerid đã biết ─────────────────────────────────
const idAt = new Map<number, number>(); // offset -> playerid
const wanted = new Set(truth.map((t) => t.playerid));
for (let o = 0; o + 4 <= bytes.length; o += 1) {
  const v = view.getUint32(o, true);
  if (wanted.has(v)) idAt.set(o, v);
}
const offsets = [...idAt.keys()].sort((a, b) => a - b);
console.log(`tìm thấy ${offsets.length} lần xuất hiện của ${wanted.size} playerid trong file\n`);

// ── 2. Lưới (neo, bước) phủ nhiều playerid nhất ─────────────────────────────
interface Grid {
  anchor: number;
  stride: number;
  ids: Map<number, number>; // playerid -> offset
}
let best: Grid | null = null;

for (let i = 0; i < offsets.length; i += 1) {
  for (let j = i + 1; j < offsets.length; j += 1) {
    const stride = offsets[j] - offsets[i];
    if (stride < MIN_STRIDE) continue;
    if (stride > MAX_STRIDE) break;

    // Đi lùi về đầu lưới rồi quét xuôi — neo phải là bản ghi đầu tiên.
    let anchor = offsets[i];
    while (idAt.has(anchor - stride)) anchor -= stride;

    const ids = new Map<number, number>();
    for (let o = anchor; o < bytes.length - 4; o += stride) {
      const id = idAt.get(o);
      if (id === undefined) break;
      if (ids.has(id)) break;
      ids.set(id, o);
    }
    if (!best || ids.size > best.ids.size) best = { anchor, stride, ids };
  }
}

if (!best || best.ids.size < MIN_GRID_HITS) {
  console.log(
    `── không tìm ra lưới nào phủ ≥${MIN_GRID_HITS} playerid ` +
      `(tốt nhất: ${best ? best.ids.size : 0})`,
  );
  console.log("   → bảng hợp đồng KHÔNG lưu dạng mảng bản ghi cố định có playerid u32.");
  process.exit(0);
}

console.log(
  `── lưới tốt nhất: neo ${best.anchor}, bước ${best.stride} byte, ` +
    `phủ ${best.ids.size}/${truth.length} playerid ──\n`,
);

// ── 3. Lương nằm ở BIT nào trong bản ghi? ───────────────────────────────────
//
// Neo 8.843.741 không chia hết cho 4, nên bảng này đóng gói theo bit đúng như
// bảng cầu thủ. Dò theo byte không thể trúng; phải dò theo bit.
//
// Lương tới 130.000 nên cần ≥17 bit. Xác suất một trường 17 bit trùng khít
// 40/40 giá trị do may là (2^-17)^40 — nên với cỡ mẫu 40, ngưỡng 100% vẫn an
// toàn tuyệt đối. Nhưng phải là 100%: hạ xuống 80% thì mất đúng lớp bảo vệ ấy.
const readBits = (startBit: number, width: number): number | null => {
  const endByte = (startBit + width - 1) >> 3;
  if (startBit < 0 || endByte >= bytes.length) return null;
  let v = 0;
  for (let i = 0; i < width; i += 1) {
    const b = startBit + i;
    v += ((bytes[b >> 3] >> (b & 7)) & 1) * 2 ** i;
  }
  return v;
};

const strideBits = best.stride * 8;
const pairs = [...best.ids.entries()].map(([pid, o]) => ({
  baseBit: o * 8,
  wage: wageOf.get(pid)!,
  pid,
}));

interface Hit {
  bit: number;
  width: number;
  scale: number;
  hit: number;
}
const hits: Hit[] = [];
// Lương có thể lưu chia nhỏ (đơn vị 100, 500, 1000) để tiết kiệm bit — thử luôn.
const SCALES = [1, 10, 100, 500, 1000];

for (let width = 12; width <= 24; width += 1) {
  for (let rel = -strideBits; rel + width <= strideBits; rel += 1) {
    for (const scale of SCALES) {
      let hit = 0;
      const distinct = new Set<number>();
      for (const p of pairs) {
        if (p.wage % scale !== 0) break;
        const v = readBits(p.baseBit + rel, width);
        if (v === null) break;
        distinct.add(v);
        if (v * scale === p.wage) hit += 1;
      }
      if (hit === pairs.length && distinct.size >= 8) hits.push({ bit: rel, width, scale, hit });
    }
  }
}

if (hits.length === 0) {
  console.log("── không có trường bit nào khớp lương 100% ──");
  console.log("   → hoặc lưới 176 byte không phải bảng hợp đồng, hoặc lương lưu cách khác.");
} else {
  console.log("── trường bit khớp lương 100% ──");
  for (const h of hits.slice(0, 8)) {
    console.log(
      `  bit ${h.bit >= 0 ? "+" : ""}${h.bit} so với playerid, rộng ${h.width}` +
        `${h.scale === 1 ? "" : `, đơn vị ${h.scale}`} → ${h.hit}/${pairs.length}`,
    );
  }
}

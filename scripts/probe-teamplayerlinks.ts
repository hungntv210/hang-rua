/**
 * SPIKE — bảng `teamplayerlinks` có nằm trong file save không?
 *
 *   npx tsx scripts/probe-teamplayerlinks.ts <save> <teamplayerlinks.csv> <teamid>
 *
 * ─── VÌ SAO CÂU HỎI NÀY ĐÁNG DÒ ─────────────────────────────────────────────
 *
 * `teamplayerlinks` mang hai thứ mà trang đang phải đi xin từ bản export:
 *
 *     jerseynumber   số áo
 *     position       0-27 = suất đá chính thứ mấy, 28 = dự bị, 29 = dự phòng
 *
 * Cột `position` chính là ĐỘI HÌNH XUẤT PHÁT. Tìm được nó trong save nghĩa là
 * một file save đủ để dựng mọi thứ, không cần chạy Lua cho từng save.
 *
 * ─── VÌ SAO LẦN NÀY KHÁC NĂM LẦN DÒ TRƯỚC ───────────────────────────────────
 *
 * Năm lần trước dò MÙ: đoán một cách lưu (mảng u32, mảng chỉ số, hoán vị
 * ngược…) rồi quét cả file tìm dãy khớp. Không lần nào có giả thuyết về CẤU
 * TRÚC, chỉ có giả thuyết về ĐỊNH DẠNG.
 *
 * Lần này có một quan sát cụ thể: vùng ~8.699.600 có các bản ghi 12 byte bắt
 * đầu bằng một playerId, rồi hai trường 4 byte chưa rõ nghĩa. Lượt trước chỉ
 * quét ±40 bản ghi quanh một điểm nên thấy 1/24 cầu thủ của đội.
 *
 * Nên cách dò cũng khác: không đoán stride nữa. Tìm MỌI vị trí mà playerId
 * xuất hiện, rồi hỏi "có độ lệch nào đọc ra đúng số áo cho cả 24 người không".
 * Cấu trúc tự lộ ra từ kết quả thay vì phải đoán trước.
 *
 * ─── VÌ SAO 24 MẪU LÀ ĐỦ ────────────────────────────────────────────────────
 *
 * Mỗi playerId xuất hiện ~25 lần trong file, nên với một độ lệch bất kỳ, xác
 * suất MỘT trong số đó tình cờ đọc ra đúng số áo là ~25/256 ≈ 10%. Cả 24 người
 * cùng trúng do may là 10^-24. Với cổng 24/24 thì an toàn tuyệt đối — điều
 * KHÔNG còn đúng nếu hạ ngưỡng.
 */
import { readFileSync } from "node:fs";

const [savePath, csvPath, teamArg] = process.argv.slice(2);
if (!savePath || !csvPath || !teamArg) {
  console.error("dùng: npx tsx scripts/probe-teamplayerlinks.ts <save> <csv> <teamid>");
  process.exit(1);
}
const teamId = Number(teamArg);

const bytes = new Uint8Array(readFileSync(savePath));
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

// ── Ground truth ────────────────────────────────────────────────────────────
const text = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
const ci = (n: string) => cols.indexOf(n);

interface Row {
  pid: number;
  jersey: number;
  position: number;
}
const truth: Row[] = [];
for (const l of lines.slice(1)) {
  const c = l.split(",");
  if (Number(c[ci("teamid")]) !== teamId) continue;
  truth.push({
    pid: Number(c[ci("playerid")]),
    jersey: Number(c[ci("jerseynumber")]),
    position: Number(c[ci("position")]),
  });
}
console.log(`ground truth: ${truth.length} cầu thủ của đội ${teamId}`);
if (truth.length < 10) {
  console.error("quá ít mẫu để kết luận. Dừng.");
  process.exit(1);
}

// ── Mọi vị trí playerId xuất hiện dưới dạng u32 ─────────────────────────────
const wanted = new Map<number, Row>(truth.map((r) => [r.pid, r]));
const at = new Map<number, number[]>();
for (let o = 0; o + 4 <= bytes.length; o += 1) {
  const v = view.getUint32(o, true);
  if (!wanted.has(v)) continue;
  const list = at.get(v);
  if (list) list.push(o);
  else at.set(v, [o]);
}
const total = [...at.values()].reduce((s, a) => s + a.length, 0);
console.log(`${total} lần xuất hiện, trung bình ${(total / truth.length).toFixed(1)} lần/cầu thủ\n`);

// ── Đọc một trường ở mức BIT, để bắt cả bảng đóng gói theo bit ──────────────
function readBits(startBit: number, width: number): number | null {
  const endByte = (startBit + width - 1) >> 3;
  if (startBit < 0 || endByte >= bytes.length) return null;
  let v = 0;
  for (let i = 0; i < width; i += 1) {
    const b = startBit + i;
    v += ((bytes[b >> 3] >> (b & 7)) & 1) * 2 ** i;
  }
  return v;
}

/**
 * Có độ lệch bit nào đọc ra đúng `want(row)` cho MỌI cầu thủ không?
 *
 * Quét theo bit chứ không theo byte: bảng cầu thủ trong save đóng gói theo bit,
 * nên không có lý do gì bảng này lại phải thẳng hàng byte.
 */
function hunt(label: string, want: (r: Row) => number, widths: number[], span: number) {
  const hits: Array<{ delta: number; width: number; add: number }> = [];
  // Mức khớp CAO NHẤT bất kỳ độ lệch nào đạt được. "Không tìm thấy" và "tìm
  // thấy 22/24" là hai kết luận trái ngược, mà cả hai đều in ra cùng một dòng
  // nếu chỉ đếm số lần đạt ngưỡng.
  let best = { n: 0, delta: 0, width: 0 };

  for (const width of widths) {
    for (let delta = -span * 8; delta <= span * 8; delta += 1) {
      // Hằng số cộng suy từ chính dữ liệu, không đoán — cùng cách
      // `probe-fields.ts` suy `add`.
      const first = truth[0];
      const firstOffsets = at.get(first.pid) ?? [];
      const adds = new Set<number>();
      for (const o of firstOffsets) {
        const v = readBits(o * 8 + delta, width);
        if (v !== null) adds.add(want(first) - v);
      }

      for (const add of adds) {
        let ok = 0;
        for (const r of truth) {
          const offs = at.get(r.pid) ?? [];
          if (offs.some((o) => readBits(o * 8 + delta, width) === want(r) - add)) ok += 1;
        }
        if (ok > best.n) best = { n: ok, delta, width };
        if (ok === truth.length) {
          hits.push({ delta, width, add });
          break;
        }
      }
    }
  }

  console.log(`── ${label} ──`);
  console.log(
    `  khớp cao nhất: ${best.n}/${truth.length} ở lệch ${best.delta} bit rộng ${best.width}`,
  );
  if (hits.length === 0) {
    console.log("  không độ lệch nào khớp cả " + truth.length + " cầu thủ\n");
    return null;
  }
  for (const h of hits.slice(0, 6)) {
    console.log(
      `  lệch ${h.delta} bit (${(h.delta / 8).toFixed(2)} byte) rộng ${h.width}` +
        `${h.add ? ` add ${h.add}` : ""} → ${truth.length}/${truth.length}`,
    );
  }
  console.log();
  return hits[0];
}

// Số áo 1-99 cần 7 bit; mã vị trí 0-29 cần 5 bit. Quét rộng ±48 byte quanh
// playerId — đủ phủ một bản ghi 12 byte lẫn một bản ghi vài chục byte.
const jersey = hunt("SỐ ÁO", (r) => r.jersey, [5, 6, 7, 8, 16], 48);
const position = hunt("MÃ VỊ TRÍ (đội hình xuất phát)", (r) => r.position, [5, 6, 7, 8, 16], 48);

console.log("════ KẾT LUẬN ════");
if (position) {
  console.log("TÌM RA mã vị trí trong save — đội hình xuất phát đọc được từ file save.");
} else if (jersey) {
  console.log("Tìm ra số áo nhưng KHÔNG tìm ra mã vị trí.");
} else {
  console.log(
    "KHÔNG tìm ra cả hai. `teamplayerlinks` không nằm trong save dưới dạng\n" +
      "trường có độ lệch cố định so với playerId.",
  );
}

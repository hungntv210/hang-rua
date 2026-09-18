/**
 * Phép thử quyết định cho LƯƠNG: 45 con số lương đã biết có nằm trong file không?
 *
 *   npx tsx scripts/probe-wage-scan.ts <save> <fc26_career_playercontract.csv>
 *
 * Hai lượt dò trước đi tìm CẤU TRÚC (bảng, bước, offset) rồi mới tìm giá trị.
 * Cách đó chỉ trả lời được "không thấy ở chỗ tôi đã nhìn". Lượt này đảo lại: quét
 * TOÀN BỘ file ở mọi vị trí bit, mọi bề rộng 12-21 bit, xem 45 giá trị ấy có mặt
 * ở đâu không. Không tìm thấy ở đây là một kết luận thật, không phải một chỗ
 * chưa nhìn tới.
 *
 * Rồi gom cụm: nếu có bảng hợp đồng thì nhiều giá trị lương phải nằm cách nhau
 * một bước cố định. Rải rác ngẫu nhiên nghĩa là chỉ trùng số.
 *
 * Phép thử dương tính đi kèm: quét cùng cách với 45 `playerid`, những con số
 * CHẮC CHẮN có trong file. Bộ quét phải tìm ra chúng.
 */
import { readFileSync } from "node:fs";

const [savePath, csvPath] = process.argv.slice(2);
const bytes = new Uint8Array(readFileSync(savePath));

const text = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
const ci = (n: string) => cols.indexOf(n);

const wages: number[] = [];
const pids: number[] = [];
for (const l of lines.slice(1)) {
  const c = l.split(",");
  wages.push(Number(c[ci("wage")]));
  pids.push(Number(c[ci("playerid")]));
}

const totalBits = bytes.length * 8;

/**
 * Quét toàn file tìm mọi vị trí bit chứa một giá trị trong `targets`.
 *
 * Đọc bằng cửa sổ 4 byte dịch bit, không dùng vòng lặp theo từng bit — 120 triệu
 * vị trí × 20 bit là mười tỉ phép tính, chạy cả phút mà không cần thiết.
 */
function scan(targets: Set<number>, width: number): Map<number, number[]> {
  const mask = width === 32 ? -1 >>> 0 : (1 << width) - 1;
  const found = new Map<number, number[]>();
  const last = totalBits - width;
  for (let p = 0; p <= last; p += 1) {
    const b = p >> 3;
    const s = p & 7;
    const v =
      ((bytes[b] >>> s) |
        (bytes[b + 1] << (8 - s)) |
        (bytes[b + 2] << (16 - s)) |
        (bytes[b + 3] << (24 - s))) &
      mask;
    if (targets.has(v)) {
      const arr = found.get(v);
      if (arr) arr.push(p);
      else found.set(v, [p]);
    }
  }
  return found;
}

function summarise(label: string, values: number[], widths: number[]) {
  console.log(`\n════ ${label} ════`);
  const set = new Set(values.filter((v) => Number.isFinite(v) && v > 0));
  for (const width of widths) {
    const cap = (1 << width) - 1;
    const fit = [...set].filter((v) => v <= cap);
    if (fit.length === 0) continue;
    const found = scan(new Set(fit), width);
    const covered = found.size;
    const total = [...found.values()].reduce((s, a) => s + a.length, 0);
    console.log(
      `  rộng ${String(width).padStart(2)}: ${covered}/${fit.length} giá trị có mặt, ` +
        `${total} vị trí`,
    );

    // Gom cụm: có bước lặp nào cho ra nhiều giá trị KHÁC NHAU không?
    if (covered >= 10) {
      const flat: Array<[number, number]> = [];
      for (const [v, ps] of found) for (const p of ps) flat.push([p, v]);
      flat.sort((a, b) => a[0] - b[0]);
      const strides = new Map<number, Set<number>>();
      for (let i = 0; i < flat.length; i += 1) {
        for (let j = i + 1; j < flat.length && flat[j][0] - flat[i][0] <= 4096; j += 1) {
          const d = flat[j][0] - flat[i][0];
          if (d < 64 || d % 8 !== 0) continue;
          let s = strides.get(d);
          if (!s) strides.set(d, (s = new Set()));
          s.add(flat[i][1]);
          s.add(flat[j][1]);
        }
      }
      const top = [...strides.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 3);
      for (const [d, s] of top) {
        console.log(`      bước ${d / 8} byte phủ ${s.size} giá trị khác nhau`);
      }
    }
  }
}

// Phép thử dương tính: playerid chắc chắn có trong file.
summarise("PHÉP THỬ DƯƠNG TÍNH — 45 playerid (chắc chắn có mặt)", pids, [20, 21]);
summarise("LƯƠNG — nguyên giá trị", wages, [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
summarise(
  "LƯƠNG — chia 100",
  wages.filter((w) => w % 100 === 0).map((w) => w / 100),
  [8, 9, 10, 11, 12, 13, 14],
);
summarise(
  "LƯƠNG — chia 1000",
  wages.filter((w) => w % 1000 === 0).map((w) => w / 1000),
  [7, 8, 9, 10, 11],
);

/**
 * Dò hạn hợp đồng trong bản ghi cầu thủ — theo giả thuyết NGÀY, không phải NĂM.
 *
 *   npx tsx scripts/probe-contract.ts <save> <fc26_players.csv>
 *
 * ─── VÌ SAO LƯỢT DÒ TRƯỚC TRƯỢT ─────────────────────────────────────────────
 *
 * `probe-fields.ts` đối chiếu bit thô với cột `contractvaliduntil`, một con số
 * NĂM (2026, 2027...). Tốt nhất 50,8%, dưới ngưỡng. Kết luận lúc đó: "chưa kết
 * luận".
 *
 * Nhưng cùng lượt ấy `playerjointeamdate` lại trúng ở bit 1057 rộng 18 — một
 * trường đếm NGÀY. Và cột `birthdate` trong export cũng là số ngày (146.529)
 * chứ không phải 19830115. Nếu hạn hợp đồng lưu cùng kiểu thì phép so khớp thô
 * với một con số năm KHÔNG BAO GIỜ trúng, dù trường nằm ngay đó — 2027 và
 * ~162.000 không có cách nào bằng nhau.
 *
 * Nên ở đây so khớp SAU quy đổi: raw → ngày → năm → so với cột năm.
 *
 * ─── HẰNG SỐ QUY ĐỔI KHÔNG ĐOÁN ─────────────────────────────────────────────
 *
 * Epoch của DB (quy ước lịch Gregory, gốc ~1582) suy ra CHÍNH XÁC từ ngày sinh:
 * cùng một cầu thủ có `birthdate` trong export và trường 15 bit đã giải mã trong
 * save, hiệu của chúng là hằng số cần tìm. Nếu hiệu đó không phải một hằng số
 * duy nhất trên toàn bảng thì giả thuyết sai ngay từ đầu và script dừng.
 *
 * Còn độ lệch riêng của trường hợp đồng thì suy từ mode của
 * (ngày-mốc-của-năm − raw), đúng cách `probe-fields.ts` suy hằng số `add`.
 *
 * ─── PHÉP THỬ DƯƠNG TÍNH ────────────────────────────────────────────────────
 *
 * Chạy cùng bộ máy trên `playerjointeamdate`, một trường ĐÃ biết đáp án
 * (bit 1057, rộng 18). Bộ dò phải tự tìm lại được nó. Không có phép thử này thì
 * một kết quả âm tính chẳng chứng minh được gì.
 */

import { readFileSync } from "node:fs";

import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { CORE_FIELDS, ATTRIBUTE_FIELDS, PLAYER_RECORD_BYTES } from "../lib/save/career/schema";

const RECORD_BITS = PLAYER_RECORD_BYTES * 8;
const DAY_MS = 86_400_000;

/** Ngưỡng cổng chặn thời điểm — dưới mức này thì save và export khác trạng thái. */
const GATE_MIN = 0.98;
/** Số cầu thủ dùng ở vòng sàng. */
const SCREEN_N = 900;
/** Trường ngày phải có ít nhất ngần này giá trị phân biệt — chặn bẫy hằng số. */
const MIN_DISTINCT = 8;
/** Ngưỡng vòng sàng — để rộng cho khỏi loại nhầm, vòng sau mới chấm thật. */
const SCREEN_MIN_RATE = 0.45;
/** Dưới mức này thì không đáng in ra. */
const REPORT_MIN_RATE = 0.5;

// ── CSV ─────────────────────────────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') cur += c;
      else if (line[i + 1] === '"') { cur += '"'; i += 1; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

interface Truth {
  col: (name: string) => number;
  rows: Map<number, string[]>;
}

function readTruth(path: string): Truth {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const columns = splitCsvLine(lines[0]).map((c) => c.trim().toLowerCase());
  const idCol = columns.findIndex((c) => c === "playerid_key" || c === "playerid");
  if (idCol < 0) throw new Error("CSV không có cột playerid");

  const rows = new Map<number, string[]>();
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const id = Number(cells[idCol]);
    if (!Number.isFinite(id) || id <= 0) continue;
    rows.set(id, cells);
  }
  return { col: (n) => columns.indexOf(n), rows };
}

const num = (cells: string[] | undefined, c: number): number | null => {
  if (!cells || c < 0) return null;
  const raw = (cells[c] ?? "").trim();
  // Ô trống PHẢI là null: `Number("")` trả 0 và đã từng tạo ra một kết quả
  // "khớp 100%" hoàn toàn giả.
  if (raw === "") return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
};

/** Mode của một mảng số — dùng để suy hằng số lệch, không dùng trung bình. */
function mode(values: number[]): { value: number; share: number } {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = 0;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return { value: best, share: values.length ? bestN / values.length : 0 };
}

// ── Chạy ────────────────────────────────────────────────────────────────────

const [savePath, csvPath] = process.argv.slice(2);
if (!savePath || !csvPath) {
  console.error("dùng: npx tsx scripts/probe-contract.ts <save> <fc26_players.csv>");
  process.exit(1);
}

const bytes = new Uint8Array(readFileSync(savePath));
const loc = locatePlayerTable(bytes);
if (!loc) {
  console.error("không định vị được bảng cầu thủ");
  process.exit(1);
}
const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);
console.log(
  `bảng: base=${loc.base} count=${loc.count} chất lượng khoá=${(loc.keyQuality * 100).toFixed(1)}%`,
);

const truth = readTruth(csvPath);
console.log(`export: ${truth.rows.size} dòng`);

// Ghép bản ghi ↔ dòng export qua playerId.
interface Joined {
  record: number;
  cells: string[];
}
const joined: Joined[] = [];
for (let r = 0; r < loc.count; r += 1) {
  const pid = reader.field(r, CORE_FIELDS.playerId.bit, CORE_FIELDS.playerId.width);
  if (pid === null) continue;
  const cells = truth.rows.get(pid);
  if (cells) joined.push({ record: r, cells });
}
console.log(`ghép được ${joined.length} cầu thủ\n`);

// ── Cổng chặn thời điểm ─────────────────────────────────────────────────────
console.log("── cổng chặn thời điểm ──");
const GATES: Array<[string, number, number, number]> = [
  ["finishing", ATTRIBUTE_FIELDS.finishing.bit, 7, 1],
  ["reactions", ATTRIBUTE_FIELDS.reactions.bit, 7, 1],
  ["potential", CORE_FIELDS.potential.bit, 7, 1],
  ["height", CORE_FIELDS.heightCm.bit, 7, 130],
  ["weight", CORE_FIELDS.weightKg.bit, 7, 30],
];
let gateOk = true;
for (const [label, bit, width, add] of GATES) {
  const c = truth.col(label);
  let hit = 0;
  let seen = 0;
  for (const j of joined) {
    const want = num(j.cells, c);
    if (want === null) continue;
    seen += 1;
    if (reader.field(j.record, bit, width)! + add === want) hit += 1;
  }
  const rate = seen ? hit / seen : 0;
  console.log(`  ${label.padEnd(10)} ${(rate * 100).toFixed(1)}%  (${hit}/${seen})`);
  if (rate < GATE_MIN) gateOk = false;
}
if (!gateOk) {
  console.error("\nCỔNG CHẶN TRƯỢT — save và export mô tả hai trạng thái khác nhau. Dừng.");
  process.exit(1);
}

// ── Hằng số epoch: suy từ ngày sinh ─────────────────────────────────────────
// `birthdate` trong export và trường 15 bit trong save là cùng một ngày, đo bằng
// hai gốc khác nhau. Hiệu của chúng chính là hằng số quy đổi cần tìm.
const cBirth = truth.col("birthdate");
const diffs: number[] = [];
for (const j of joined) {
  const csv = num(j.cells, cBirth);
  if (csv === null) continue;
  diffs.push(csv - reader.field(j.record, CORE_FIELDS.birthDate.bit, CORE_FIELDS.birthDate.width)!);
}
const epoch = mode(diffs);
console.log(
  `\n── epoch DB ──\n  lệch = ${epoch.value} ngày, chiếm ${(epoch.share * 100).toFixed(2)}% mẫu`,
);
if (epoch.share < 0.99) {
  console.error("  hiệu KHÔNG phải hằng số — giả thuyết ngày sai từ gốc. Dừng.");
  process.exit(1);
}

/** Ngày DB → ngày Unix. `add` của `birthDate` đã quy về Unix nên chỉ trừ thêm epoch. */
const dbDayToUnixDay = (d: number) => d - epoch.value + CORE_FIELDS.birthDate.add;
const unixDayToDbDay = (d: number) => d + epoch.value - CORE_FIELDS.birthDate.add;
const yearOfDbDay = (d: number) => new Date(dbDayToUnixDay(d) * DAY_MS).getUTCFullYear();

// Kiểm tỉnh táo: năm sinh giải ra phải nằm trong dải hợp lý.
{
  const years = joined
    .slice(0, 400)
    .map((j) => yearOfDbDay(num(j.cells, cBirth) ?? 0))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);
  console.log(`  năm sinh giải ra: ${years[0]} … ${years[years.length - 1]} (kiểm tỉnh táo)`);
}

// ── Bộ dò ───────────────────────────────────────────────────────────────────

interface Cand {
  bit: number;
  width: number;
  offset: number;
  rate: number;
  hit: number;
  seen: number;
}

/**
 * Dò một trường ngày trong bản ghi, đối chiếu với một cột của export.
 *
 * Hai kiểu cột, và phân biệt được chúng là điều kiện để phép thử có nghĩa:
 *
 *   `day`  — cột cũng là SỐ NGÀY (`playerjointeamdate`, `birthdate`). Chấm bằng
 *            khớp ngày tuyệt đối. Đây là kiểu dùng cho phép thử dương tính.
 *   `year` — cột chỉ là một con số NĂM (`contractvaliduntil`). Chấm bằng năm
 *            giải ra từ trường ngày.
 *
 * Lần viết đầu chỉ có kiểu `year` và đem áp cho cả phép thử dương tính, tức so
 * 2024 với 161.000. Phép thử dĩ nhiên trượt, và một phép thử dương tính trượt
 * làm mọi kết quả âm tính sau đó vô nghĩa — đúng cái bẫy mà nó sinh ra để chặn.
 *
 * `monthDay` là mốc trong năm dùng để suy hằng số lệch ở kiểu `year`; FC đặt hạn
 * hợp đồng vào 30/06. Nó KHÔNG tham gia chấm điểm.
 */
function probeDateField(
  colName: string,
  kind: "day" | "year",
  monthDay: [number, number],
  widths: number[],
): Cand[] {
  const c = truth.col(colName);
  if (c < 0) {
    console.log(`  (export không có cột ${colName})`);
    return [];
  }

  const rows = joined.filter((j) => num(j.cells, c) !== null);
  const sample = rows.slice(0, SCREEN_N);
  const out: Cand[] = [];

  for (const width of widths) {
    for (let bit = 0; bit + width <= RECORD_BITS; bit += 1) {
      // ── vòng sàng ──
      // Sàng bằng chính TỈ LỆ KHỚP trên mẫu, không bằng một thống kê thay thế.
      //
      // Bản đầu sàng bằng độ dốc "ngày trên năm" và đặt ngưỡng 355-375. Trên
      // trường thật đã biết đáp án, độ dốc đo được 340,6 — nên bộ lọc loại đúng
      // thứ nó phải giữ, và phép thử dương tính trượt. Ngày gia nhập dồn vào kỳ
      // chuyển nhượng chứ không rải đều, nên trung bình của nhóm năm đầu và
      // nhóm năm cuối không nói lên độ dốc thật.
      const raws: number[] = [];
      const cells: number[] = [];
      const distinct = new Set<number>();
      let short = false;
      for (const j of sample) {
        const v = reader.field(j.record, bit, width);
        if (v === null) {
          short = true;
          break;
        }
        raws.push(v);
        cells.push(num(j.cells, c)!);
        distinct.add(v);
      }
      // Chặn bẫy hằng số: trường gần như không đổi thì mọi "khớp" chỉ là một
      // giá trị duy nhất trùng với mode của cột.
      if (short || distinct.size < MIN_DISTINCT) continue;

      // Hằng số lệch suy từ mode của (giá trị mong đợi − raw), đúng cách
      // `probe-fields.ts` suy hằng số `add`.
      const offs: number[] = [];
      for (let i = 0; i < raws.length; i += 1) {
        const target =
          kind === "day"
            ? cells[i]
            : unixDayToDbDay(
                Math.floor(Date.UTC(cells[i], monthDay[0] - 1, monthDay[1]) / DAY_MS),
              );
        offs.push(target - raws[i]);
      }
      const off = mode(offs).value;

      const decode = (v: number) => (kind === "day" ? v + off : yearOfDbDay(v + off));
      let screenHit = 0;
      const decoded = new Set<number>();
      for (let i = 0; i < raws.length; i += 1) {
        const d = decode(raws[i]);
        decoded.add(d);
        if (d === cells[i]) screenHit += 1;
      }
      // Giá trị giải ra cũng phải đa dạng: một trường hằng số vẫn có thể trúng
      // 29% chỉ nhờ khớp năm phổ biến nhất (2028).
      if (decoded.size < 4 || screenHit / raws.length < SCREEN_MIN_RATE) continue;

      // ── chấm tuyệt đối trên toàn bộ ──
      let hit = 0;
      for (const j of rows) {
        const v = reader.field(j.record, bit, width);
        if (v === null) continue;
        if (decode(v) === num(j.cells, c)) hit += 1;
      }
      const rate = hit / rows.length;
      if (rate >= REPORT_MIN_RATE) out.push({ bit, width, offset: off, rate, hit, seen: rows.length });
    }
  }

  out.sort((a, b) => b.rate - a.rate);
  return out;
}

function report(label: string, cands: Cand[]) {
  console.log(`\n── ${label} ──`);
  if (cands.length === 0) {
    console.log("  không ứng viên nào ≥50%");
    return;
  }
  for (const c of cands.slice(0, 5)) {
    console.log(
      `  bit ${String(c.bit).padStart(4)} rộng ${c.width}  lệch ${c.offset}  ` +
        `→ ${(c.rate * 100).toFixed(2)}%  (${c.hit}/${c.seen})`,
    );
  }
}

// Phép thử dương tính TRƯỚC: bộ máy phải tự tìm lại một trường đã biết đáp án.
// Nếu nó trượt thì mọi kết quả âm tính bên dưới không chứng minh được gì.
console.log(
  "\n════ PHÉP THỬ DƯƠNG TÍNH: playerjointeamdate (đáp án đã biết: bit 1057 rộng 18) ════",
);
const control = probeDateField("playerjointeamdate", "day", [1, 1], [17, 18, 19]);
report("playerjointeamdate", control);
const controlOk = control.some((c) => c.bit === 1057 && c.width === 18 && c.rate >= 0.8);
console.log(controlOk ? "  ✓ bộ dò tìm lại được offset đã biết" : "  ✗ KHÔNG tìm lại được");

console.log("\n════ MỤC TIÊU: contractvaliduntil ════");
report(
  "contractvaliduntil",
  probeDateField("contractvaliduntil", "year", [6, 30], [14, 15, 16, 17, 18, 19, 20]),
);
if (!controlOk) {
  console.log(
    "\nLƯU Ý: phép thử dương tính trượt, nên kết quả âm tính ở trên KHÔNG kết luận được gì.",
  );
}

/**
 * Tuyến A — dò vị trí bit của các trường chưa giải mã trong bản ghi cầu thủ.
 *
 *   npx tsx scripts/probe-fields.ts <save> <fc26_players.csv> [cot1,cot2,...]
 *
 * Đối chiếu từng tổ hợp (offset bit × độ rộng) với cột tương ứng trong file
 * export của Live Editor, chấm bằng KHỚP TUYỆT ĐỐI.
 *
 * ─── Ba điều bắt buộc, cả ba đều rút từ lỗi đã mắc ───────────────────────────
 *
 * 1. CỔNG CHẶN THỜI ĐIỂM. Trước khi dò bất cứ trường nào, đo lại các trường ĐÃ
 *    BIẾT CHẮC. Nếu chúng không khớp ~100% thì export và save mô tả hai trạng
 *    thái khác nhau, và mọi kết luận sau đó vô nghĩa. Ba lần dò trước thất bại
 *    một phần vì đúng chuyện này mà không ai đo: trường đã biết chắc khi đối
 *    chiếu với dataset công khai cũng chỉ trúng 51-64%.
 *
 * 2. KHÔNG DÙNG TƯƠNG QUAN ĐỂ CHỐT. Vòng dò đầu tiên đặt `potential` ở bit 519
 *    (r = 0,96) và `dob` ở bit 719 (r = 0,9998); cả hai LỆCH MỘT BIT. Đọc sớm
 *    một bit cho `v = rác + 2×thật`, và Pearson mù trước phép biến đổi đó.
 *
 * 3. CHẶN BẪY HẰNG SỐ. `gk_positioning` từng báo khớp 100% ở bit 280. Thực chất
 *    cột đó để trống với cầu thủ ngoài sân, `Number("")` trả 0 chứ không phải
 *    NaN, và "khớp" là `0 === 0` lặp 12.559 lần. Ở đây: ứng viên phải có đủ giá
 *    trị phân biệt ở CẢ hai phía mới được tính.
 *
 * Hằng số cộng không phải đoán: script suy ra nó từ phân bố hiệu
 * (thật − thô). Chỉ số lưu 0-based nên hiệu thường là +1, nhưng để dữ liệu nói.
 */

import { readFileSync } from "node:fs";

import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import {
  CORE_FIELDS,
  ATTRIBUTE_FIELDS,
  PLAYER_RECORD_BYTES,
  positionName,
} from "../lib/save/career/schema";

const RECORD_BITS = PLAYER_RECORD_BYTES * 8;
const SCREEN_SAMPLE = 700;      // số cầu thủ dùng ở vòng sàng
const SCREEN_MIN_RATE = 0.45;   // ngưỡng sàng, để rộng cho khỏi loại nhầm
const MIN_DISTINCT = 8;         // số giá trị phân biệt tối thiểu — chặn bẫy hằng số
const GATE_MIN_RATE = 0.98;     // cổng chặn thời điểm

const MAX_WIDTH_ATTR = 8;
const MAX_WIDTH_WIDE = 24;

/** Cột nào trong CSV ứng với trường nào đã biết — thử lần lượt, lấy cột có mặt. */
const KNOWN_GATES: Array<{ label: string; columns: string[]; bit: number; width: number }> = [
  { label: "finishing", columns: ["finishing", "attacking_finishing"], bit: ATTRIBUTE_FIELDS.finishing.bit, width: 7 },
  { label: "reactions", columns: ["reactions", "movement_reactions"], bit: ATTRIBUTE_FIELDS.reactions.bit, width: 7 },
  { label: "potential", columns: ["potential"], bit: CORE_FIELDS.potential.bit, width: 7 },
  { label: "height", columns: ["height", "height_cm"], bit: CORE_FIELDS.heightCm.bit, width: 7 },
  { label: "weight", columns: ["weight", "weight_kg"], bit: CORE_FIELDS.weightKg.bit, width: 7 },
];

/** Mặc định dò gì nếu người dùng không nêu tên cột. */
const DEFAULT_TARGETS = [
  "volleys",
  "defensiveawareness",
  "marking",
  "gkpositioning",
  "value",
  "wage",
  "contractvaliduntil",
];

// ────────────────────────────────────────────────────────────────────────────
// Đọc CSV
// ────────────────────────────────────────────────────────────────────────────

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
  columns: string[];
  /** playerId -> giá trị từng cột. Ô trống là `null`, KHÔNG phải 0. */
  rows: Map<number, Array<number | null>>;
}

function readTruth(path: string): Truth {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const columns = splitCsvLine(lines[0]).map((c) => c.trim().toLowerCase());

  // Chấp nhận cả kiểu đặt tên của dataset công khai, để chạy được phép thử âm tính.
  const idCol = columns.findIndex(
    (c) => c === "playerid_key" || c === "playerid" || c === "player_id",
  );
  if (idCol < 0) throw new Error("CSV không có cột playerid");

  const rows = new Map<number, Array<number | null>>();
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const id = Number(cells[idCol]);
    if (!Number.isFinite(id) || id <= 0) continue;
    rows.set(
      id,
      columns.map((_, c) => {
        const raw = (cells[c] ?? "").trim();
        // Ô trống PHẢI là null. `Number("")` trả 0, và chính chỗ đó đã tạo ra
        // một kết quả "khớp 100%" hoàn toàn giả ở vòng dò trước.
        if (raw === "") return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      }),
    );
  }
  return { columns, rows };
}

// ────────────────────────────────────────────────────────────────────────────
// Chấm điểm một tổ hợp (bit, width)
// ────────────────────────────────────────────────────────────────────────────

interface Score {
  bit: number;
  width: number;
  /** Hằng số cộng suy ra từ phân bố hiệu, không phải đoán. */
  add: number;
  rate: number;
  matched: number;
  total: number;
  distinctRaw: number;
}

/**
 * Chấm bằng khớp tuyệt đối, và suy ra `add` từ hiệu (thật − thô).
 *
 * Nếu trường đúng thì hiệu là một HẰNG SỐ với mọi cầu thủ; ta chỉ cần tìm hiệu
 * xuất hiện nhiều nhất rồi đếm xem bao nhiêu cầu thủ đạt đúng hiệu đó. Cách này
 * tự tìm ra `add` thay vì thử từng giá trị, và không bao giờ bị lừa bởi phép
 * biến đổi affine như tương quan Pearson.
 */
function score(
  reader: BitRecordReader,
  pairs: Array<{ record: number; truth: number }>,
  bit: number,
  width: number,
): Score | null {
  const deltas = new Map<number, number>();
  const rawSeen = new Set<number>();
  let total = 0;

  for (const { record, truth } of pairs) {
    const raw = reader.field(record, bit, width);
    if (raw === null) return null;
    rawSeen.add(raw);
    deltas.set(truth - raw, (deltas.get(truth - raw) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return null;

  let bestAdd = 0;
  let bestCount = 0;
  for (const [delta, count] of deltas) {
    if (count > bestCount) { bestCount = count; bestAdd = delta; }
  }

  return {
    bit, width, add: bestAdd,
    rate: bestCount / total,
    matched: bestCount,
    total,
    distinctRaw: rawSeen.size,
  };
}

/**
 * Kiểm chéo bằng hình dạng phân bố — bước BẮT BUỘC, không phải tuỳ chọn.
 *
 * Khớp tuyệt đối cao vẫn có thể là giả. Vòng dò trước báo `gk_positioning` khớp
 * 100% ở bit 280, nhưng đó là `0 === 0` lặp 12.559 lần. Thứ bắt được nó không
 * phải tỉ lệ khớp mà là NGỮ NGHĨA của trường.
 *
 * MỐC SO SÁNH LẤY TỪ CHÍNH FILE SAVE, không phải hằng số viết cứng. Đo trên save
 * thật: `gkDiving` cho GK 63,8 / ngoài sân 10,2 (chênh 53,6), `gkReflexes` chênh
 * 55,2 — còn ứng viên giả ở bit 280 chênh 31,2. Một ngưỡng cứng kiểu "chênh > 25"
 * sẽ CHO LỌT ứng viên giả đó; đã thử và đúng là nó lọt. Thứ phân biệt được là
 * ứng viên phải giống các chỉ số thủ môn THẬT trong cùng file: trung bình nhóm
 * GK phải ngang 60-70, không phải 32.
 */
interface Shape {
  gkMean: number;
  outMean: number;
  gap: number;
}

function shapeOf(
  reader: BitRecordReader,
  records: number[],
  bit: number,
  width: number,
  add: number,
): Shape {
  const gk: number[] = [];
  const outfield: number[] = [];
  for (const record of records) {
    const raw = reader.field(record, bit, width);
    if (raw === null) continue;
    const pos = reader.field(record, CORE_FIELDS.position.bit, CORE_FIELDS.position.width);
    (positionName(pos) === "GK" ? gk : outfield).push(raw + add);
  }
  const mean = (a: number[]) => (a.length === 0 ? 0 : a.reduce((x, y) => x + y, 0) / a.length);
  const gkMean = mean(gk);
  const outMean = mean(outfield);
  return { gkMean, outMean, gap: Math.abs(gkMean - outMean) };
}

/** Mốc "một chỉ số thủ môn thật trông thế nào" — đo trên chính save này. */
function gkReference(reader: BitRecordReader, records: number[]): Shape {
  const refs = [
    ATTRIBUTE_FIELDS.gkDiving,
    ATTRIBUTE_FIELDS.gkHandling,
    ATTRIBUTE_FIELDS.gkKicking,
    ATTRIBUTE_FIELDS.gkReflexes,
  ].map((f) => shapeOf(reader, records, f.bit, f.width, f.add));
  const avg = (pick: (s: Shape) => number) =>
    refs.reduce((sum, s) => sum + pick(s), 0) / refs.length;
  return { gkMean: avg((s) => s.gkMean), outMean: avg((s) => s.outMean), gap: avg((s) => s.gap) };
}

function shapeReport(shape: Shape, ref: Shape): string {
  const line =
    `GK ${shape.gkMean.toFixed(1)} / ngoài sân ${shape.outMean.toFixed(1)} ` +
    `(chênh ${shape.gap.toFixed(1)}; mốc thủ môn thật ${ref.gap.toFixed(1)})`;
  // Phép kiểm này CHỈ có nghĩa với trường nằm trong dải chỉ số 1-99. Không có
  // chặn này thì một trường ngày tháng (giá trị ~161.000) cũng được gắn nhãn
  // "hợp với chỉ số thủ môn", vì chênh lệch của nó đương nhiên vượt mọi mốc.
  const isAttributeRange =
    shape.gkMean > 0 && shape.gkMean <= 99 && shape.outMean > 0 && shape.outMean <= 99;
  if (!isAttributeRange) return `${line} → ngoài dải chỉ số, phép kiểm thủ môn không áp dụng`;

  // Phải giống chỉ số thủ môn thật ở CẢ hai mặt: biên độ tách VÀ mức giá trị.
  const looksGk =
    shape.gap >= ref.gap * 0.8 && shape.gkMean >= ref.gkMean * 0.8;
  if (looksGk) return `${line} → hợp với chỉ số thủ môn`;
  if (shape.gap >= ref.gap * 0.5) {
    return `${line} → tách nhưng KHÔNG đạt mức chỉ số thủ môn thật, nghi trường tương quan`;
  }
  return line;
}

// ────────────────────────────────────────────────────────────────────────────
// Chạy
// ────────────────────────────────────────────────────────────────────────────

const savePath = process.argv[2];
const csvPath = process.argv[3];
if (!savePath || !csvPath) {
  console.error("Dùng: npx tsx scripts/probe-fields.ts <save> <fc26_players.csv> [cot,cot,...]");
  process.exit(1);
}

const file = readFileSync(savePath);
const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);

const table = locatePlayerTable(bytes);
if (!table) {
  console.error("Không định vị được bảng cầu thủ trong file save.");
  process.exit(1);
}
const reader = new BitRecordReader(bytes, table.base, table.recordBytes, table.count);
console.log(
  `Bảng cầu thủ: offset ${table.base}, ${table.count} bản ghi, ` +
  `${table.recordBytes} byte/bản ghi, chất lượng khoá ${(table.keyQuality * 100).toFixed(1)}%`,
);

// playerId -> chỉ số bản ghi
const recordOf = new Map<number, number>();
for (let i = 0; i < table.count; i += 1) {
  const id = reader.field(i, CORE_FIELDS.playerId.bit, CORE_FIELDS.playerId.width);
  if (id !== null && id > 0 && !recordOf.has(id)) recordOf.set(id, i);
}

const truth = readTruth(csvPath);
console.log(`Export: ${truth.rows.size} cầu thủ, ${truth.columns.length} cột`);

const common: number[] = [];
for (const id of truth.rows.keys()) if (recordOf.has(id)) common.push(id);
console.log(`Trùng nhau: ${common.length} cầu thủ\n`);

if (common.length < 500) {
  console.error("Quá ít cầu thủ trùng nhau — export và save có vẻ không cùng một career.");
  process.exit(1);
}

/** Dựng danh sách (bản ghi, giá trị thật) cho một cột, bỏ ô trống. */
function pairsFor(column: string, ids: number[]): Array<{ record: number; truth: number }> {
  const c = truth.columns.indexOf(column);
  if (c < 0) return [];
  const out: Array<{ record: number; truth: number }> = [];
  for (const id of ids) {
    const v = truth.rows.get(id)?.[c];
    if (v === null || v === undefined) continue;
    out.push({ record: recordOf.get(id) as number, truth: v });
  }
  return out;
}

// ── CỔNG CHẶN THỜI ĐIỂM ─────────────────────────────────────────────────────
/**
 * `--baseline`: chấp nhận nguồn đã trôi, và lấy chính các trường đã biết làm mốc.
 *
 * Dùng khi nguồn đối chiếu là DB gốc của game (`base_players.csv`) chứ không
 * phải export cùng thời điểm. Save đã trôi khỏi trạng thái đầu career, nên
 * không trường nào khớp 100% — kể cả trường đã biết chắc.
 *
 * VÌ SAO VẪN DÒ ĐƯỢC: cái ta cần tìm là VỊ TRÍ BIT, không phải giá trị. Một
 * trường 7 bit đặt sai chỗ chỉ trúng ngẫu nhiên ~1/128 ≈ 0,8%. Nếu `finishing`
 * ở đúng chỗ đạt 64% thì `volleys` ở đúng chỗ cũng phải quanh đó — cao hơn nhiễu
 * tới tám chục lần. Tỉ lệ tín hiệu/nhiễu đó đủ để chỉ ra offset.
 *
 * NHƯNG KẾT QUẢ LÀ TẠM. Không được đưa thẳng vào `schema.ts`: phải xác nhận lại
 * bằng một export cùng thời điểm, nơi cổng chặn tuyệt đối chạy được. Chế độ này
 * để THU HẸP chỗ cần tìm, không phải để kết luận.
 */
const RELATIVE = process.argv.includes("--baseline");

console.log(
  RELATIVE
    ? "── Mốc so sánh (chế độ --baseline, nguồn đã trôi) ──"
    : "── Cổng chặn thời điểm ──",
);
const gateRates: number[] = [];
let gatesRun = 0;
let gatesPassed = 0;
for (const gate of KNOWN_GATES) {
  const column = gate.columns.find((c) => truth.columns.includes(c));
  if (!column) {
    console.log(`  bỏ qua  ${gate.label} — export không có cột này`);
    continue;
  }
  const pairs = pairsFor(column, common);
  if (pairs.length === 0) {
    console.log(`  bỏ qua  ${gate.label} — cột rỗng`);
    continue;
  }
  const s = score(reader, pairs, gate.bit, gate.width);
  gatesRun += 1;
  const rate = s?.rate ?? 0;
  gateRates.push(rate);
  const ok = rate >= GATE_MIN_RATE;
  if (ok) gatesPassed += 1;
  console.log(
    `  ${RELATIVE ? "mốc   " : ok ? "đạt   " : "TRƯỢT "}${gate.label.padEnd(12)} ` +
    `${(rate * 100).toFixed(1)}% khớp (bit ${gate.bit}, +${s?.add ?? "?"})`,
  );
}

if (gatesRun === 0) {
  console.error("\nKhông chạy được cổng nào — export thiếu mọi cột đã biết. Dừng.");
  process.exit(1);
}
/**
 * Mốc dùng cho chế độ `--baseline`: lấy các chỉ số 7 bit đã biết chắc.
 *
 * Không lấy `height`/`weight` vào mốc dù chúng khớp cao hơn (~91%): thể hình gần
 * như không đổi trong career, nên chúng trôi ít hơn hẳn chỉ số. Lấy chúng làm
 * mốc cho chỉ số sẽ đặt ngưỡng quá cao và loại nhầm ứng viên đúng.
 */
const ATTR_GATE_COUNT = 3;   // finishing, reactions, potential — xem KNOWN_GATES
const baseline =
  gateRates.slice(0, ATTR_GATE_COUNT).reduce((a, b) => a + b, 0) /
  Math.max(1, Math.min(ATTR_GATE_COUNT, gateRates.length));

if (RELATIVE) {
  if (baseline < 0.3) {
    console.error(
      `\nMốc chỉ ${(baseline * 100).toFixed(1)}% — nguồn trôi quá xa so với save.\n` +
      "Dưới mức này thì tín hiệu của trường chưa biết không tách được khỏi nhiễu.",
    );
    process.exit(1);
  }
  console.log(
    `\nMốc chỉ số: ${(baseline * 100).toFixed(1)}%. Trúng ngẫu nhiên của trường 7 bit\n` +
    `là ~0,8%, nên ứng viên đúng phải nằm quanh mốc chứ không phải quanh 0.\n` +
    "KẾT QUẢ LÀ TẠM — phải xác nhận lại bằng export cùng thời điểm.\n",
  );
} else {
  if (gatesPassed < gatesRun) {
    console.error(
      `\nCỔNG CHẶN TRƯỢT (${gatesPassed}/${gatesRun}). Export và file save KHÔNG cùng một\n` +
      "thời điểm — hoặc bạn đã chơi tiếp sau khi export, hoặc file save là bản cũ.\n" +
      "Mọi kết quả dò sau đây sẽ vô nghĩa, nên dừng ở đây.\n\n" +
      "Cách sửa: vào career, chạy lại script Lua, LƯU GAME NGAY, dùng đúng save đó.\n\n" +
      "Nếu nguồn đối chiếu CỐ Ý là DB gốc của game (base_players.csv) thì thêm\n" +
      "`--baseline` để dò theo mốc tương đối — kết quả khi đó là tạm, không chốt.",
    );
    process.exit(1);
  }
  console.log(`Cổng chặn đạt ${gatesPassed}/${gatesRun}. Dữ liệu cùng thời điểm.\n`);
}

// ── DÒ ──────────────────────────────────────────────────────────────────────
// Bỏ cờ ra khỏi vị trí tham số, nếu không `--baseline` sẽ bị hiểu là tên cột.
const positional = process.argv.slice(4).filter((a) => !a.startsWith("--"));
const requested = (positional[0]?.split(",") ?? DEFAULT_TARGETS).map((t) =>
  t.trim().toLowerCase(),
);

const targets = requested.filter((t) => truth.columns.includes(t));
const skipped = requested.filter((t) => !truth.columns.includes(t));
if (skipped.length > 0) console.log(`Bỏ qua (export không có cột): ${skipped.join(", ")}\n`);

/**
 * Ngưỡng co theo mốc.
 *
 * Ở chế độ tuyệt đối, trường đúng phải khớp ~100%, nên ngưỡng thắng 95%. Ở chế
 * độ `--baseline`, trường đúng chỉ khớp ngang mốc (nguồn đã trôi), nên đòi 95%
 * là loại sạch mọi ứng viên — kể cả ứng viên đúng.
 */
const winRate = RELATIVE ? baseline * 0.85 : 0.95;
const screenMin = RELATIVE ? Math.min(SCREEN_MIN_RATE, baseline * 0.6) : SCREEN_MIN_RATE;
if (RELATIVE) {
  console.log(
    `Ngưỡng theo mốc: sàng ≥ ${(screenMin * 100).toFixed(1)}%, ` +
    `báo ĐẠT ≥ ${(winRate * 100).toFixed(1)}%\n`,
  );
}

const sample = common.slice(0, SCREEN_SAMPLE);

// Mốc phân bố đo một lần trên toàn bảng, dùng lại cho mọi ứng viên.
const allRecords = common.map((id) => recordOf.get(id) as number);
const gkRef = gkReference(reader, allRecords);
console.log(
  `Mốc chỉ số thủ môn trong save này: GK ${gkRef.gkMean.toFixed(1)} / ` +
    `ngoài sân ${gkRef.outMean.toFixed(1)}, chênh ${gkRef.gap.toFixed(1)}
`,
);

for (const column of targets) {
  const samplePairs = pairsFor(column, sample);
  const allPairs = pairsFor(column, common);

  console.log(`── ${column} ──`);
  if (allPairs.length < 200) {
    console.log(`  cột hầu như rỗng (${allPairs.length} giá trị) — bỏ qua\n`);
    continue;
  }

  const truthDistinct = new Set(allPairs.map((p) => p.truth)).size;
  const isWide = Math.max(...allPairs.map((p) => p.truth)) > 200;
  const maxWidth = isWide ? MAX_WIDTH_WIDE : MAX_WIDTH_ATTR;

  if (truthDistinct < MIN_DISTINCT) {
    // Chính xác cái bẫy đã lừa vòng dò trước: cột gần như một giá trị thì "khớp"
    // chỉ là trùng hằng số, không mang thông tin.
    console.log(
      `  chỉ ${truthDistinct} giá trị phân biệt — quá ít để kết luận, bỏ qua\n`,
    );
    continue;
  }

  // Vòng 1: sàng nhanh trên mẫu.
  const survivors: Score[] = [];
  for (let width = 1; width <= maxWidth; width += 1) {
    for (let bit = 0; bit + width <= RECORD_BITS; bit += 1) {
      const s = score(reader, samplePairs, bit, width);
      if (s && s.rate >= screenMin && s.distinctRaw >= MIN_DISTINCT) survivors.push(s);
    }
  }

  // Vòng 2: xác minh trên toàn bộ.
  const verified = survivors
    .map((s) => score(reader, allPairs, s.bit, s.width))
    .filter((s): s is Score => s !== null && s.distinctRaw >= MIN_DISTINCT)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  if (verified.length === 0) {
    console.log(`  không có ứng viên nào vượt ngưỡng (${allPairs.length} mẫu)\n`);
    continue;
  }

  for (const s of verified) {
    const verdict = s.rate >= winRate ? "  >>> ĐẠT" : "       ";
    console.log(
      `${verdict} bit ${String(s.bit).padStart(4)} rộng ${String(s.width).padStart(2)} ` +
      `add ${String(s.add).padStart(3)} → ${(s.rate * 100).toFixed(1)}% ` +
      `(${s.matched}/${s.total}, ${s.distinctRaw} giá trị phân biệt)`,
    );
    const shape = shapeOf(reader, allRecords, s.bit, s.width, s.add);
    console.log(`          phân bố: ${shapeReport(shape, gkRef)}`);
  }
  console.log();
}

console.log(
  RELATIVE
    ? "Chế độ --baseline: mọi kết quả trên là TẠM. Trước khi đưa vào schema.ts phải\n" +
      "xác nhận lại bằng export cùng thời điểm, nơi cổng chặn tuyệt đối chạy được."
    : "Ứng viên ĐẠT phải thoả CẢ HAI: khớp ≥95% VÀ phân bố hợp với ngữ nghĩa của\n" +
      "trường. Chỉ đạt tỉ lệ khớp thì chưa đủ — xem chú thích ở đầu file.",
);

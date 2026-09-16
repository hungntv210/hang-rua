/**
 * Huấn luyện mô hình tính overall rồi sinh ra `lib/save/career/ovr-model.ts`.
 *
 *   npx tsx scripts/train-ovr.ts <players.csv> [file-save-de-doi-chieu]
 *
 * Overall KHÔNG có trong file save — đã quét toàn bộ 1.152 vị trí bit mà không
 * trường nào khớp. Nó là hàm tất định của các chỉ số nên EA không lưu. Ở đây ta
 * học lại hàm đó bằng hồi quy tuyến tính trên dataset công khai, nơi có sẵn cả
 * chỉ số lẫn overall.
 *
 * Huấn luyện phải diễn ra TRONG CÙNG MỘT NGUỒN. Lấy chỉ số từ save rồi ghép với
 * overall của dataset thì đang học lẫn cả độ lệch phiên bản: cách đó cho lệch ≤1
 * chỉ 76%, trong khi huấn luyện đúng cách đạt 99,7%.
 */

import { readFileSync, writeFileSync } from "node:fs";

const ATTR_COLUMNS = [
  "attacking_crossing", "attacking_finishing", "attacking_heading_accuracy",
  "attacking_short_passing", "skill_dribbling", "skill_curve", "skill_fk_accuracy",
  "skill_long_passing", "skill_ball_control", "movement_acceleration",
  "movement_sprint_speed", "movement_agility", "movement_reactions", "movement_balance",
  "power_shot_power", "power_jumping", "power_stamina", "power_strength",
  "power_long_shots", "mentality_aggression", "mentality_interceptions",
  "mentality_positioning", "mentality_vision", "mentality_penalties",
  "mentality_composure", "defending_standing_tackle", "defending_sliding_tackle",
  "goalkeeping_diving", "goalkeeping_handling", "goalkeeping_kicking",
  "goalkeeping_reflexes",
];
/** Thứ tự này PHẢI khớp `ATTRIBUTE_ORDER` trong `lib/save/career/schema.ts`. */
const FEATURES = [...ATTR_COLUMNS, "international_reputation"];
const NF = FEATURES.length;

/** Số mẫu tối thiểu để một vị trí có mô hình riêng; dưới ngưỡng thì dùng mô hình chung. */
const MIN_SAMPLES = 80;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

interface Row { x: number[]; y: number; pos: string }

function loadRows(csvPath: string): Row[] {
  const lines = readFileSync(csvPath, "utf8").split(/\r?\n/);
  const head = splitCsvLine(lines[0]);
  const featIdx = FEATURES.map((c) => head.indexOf(c));
  const ovrIdx = head.indexOf("overall");
  const posIdx = head.indexOf("player_positions");
  if (featIdx.some((i) => i < 0) || ovrIdx < 0 || posIdx < 0) {
    throw new Error("CSV thiếu cột bắt buộc — kiểm tra lại nguồn dataset.");
  }

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i]) continue;
    const f = splitCsvLine(lines[i]);
    const x = featIdx.map((k) => Number(f[k]));
    const y = Number(f[ovrIdx]);
    const pos = String(f[posIdx]).split(",")[0].trim();
    if (pos && Number.isFinite(y) && x.every(Number.isFinite)) rows.push({ x, y, pos });
  }
  return rows;
}

/**
 * Bình phương tối thiểu có ridge, giải bằng khử Gauss-Jordan.
 *
 * Ridge rất nhỏ (1e-4) chỉ để ma trận không suy biến khi hai chỉ số gần như
 * trùng nhau trong một nhóm vị trí nhỏ — không nhằm co trọng số.
 */
function fit(rows: Row[]): number[] {
  const n = NF + 1;
  const a: number[][] = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));

  for (const row of rows) {
    const v = [...row.x, 1];
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) a[i][j] += v[i] * v[j];
      a[i][n] += v[i] * row.y;
    }
  }
  for (let i = 0; i < n; i += 1) a[i][i] += 1e-4;

  for (let c = 0; c < n; c += 1) {
    let pivot = c;
    for (let r = c + 1; r < n; r += 1) {
      if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    }
    [a[c], a[pivot]] = [a[pivot], a[c]];
    const d = a[c][c] || 1e-9;
    for (let j = c; j <= n; j += 1) a[c][j] /= d;
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const m = a[r][c];
      if (!m) continue;
      for (let j = c; j <= n; j += 1) a[r][j] -= m * a[c][j];
    }
  }
  return a.map((r) => r[n]);
}

const predict = (w: number[], x: number[]): number =>
  Math.round(x.reduce((acc, v, i) => acc + v * w[i], 0) + w[NF]);

function groupBy(rows: Row[]): Map<string, Row[]> {
  const g = new Map<string, Row[]>();
  for (const r of rows) {
    if (!g.has(r.pos)) g.set(r.pos, []);
    g.get(r.pos)!.push(r);
  }
  return g;
}

function buildModels(rows: Row[]): Record<string, number[]> {
  const generic = fit(rows);
  const out: Record<string, number[]> = { _generic: generic };
  for (const [pos, group] of groupBy(rows)) {
    if (group.length >= MIN_SAMPLES) out[pos] = fit(group);
  }
  return out;
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Cần đường dẫn players.csv");
  process.exit(1);
}

const all = loadRows(csvPath);
console.log(`${all.length} mẫu, ${NF} biến`);

// Giữ lại 1/5 để đánh giá. Chia theo chỉ số nên lặp lại cho cùng kết quả.
const train = all.filter((_, i) => i % 5 !== 0);
const test = all.filter((_, i) => i % 5 === 0);
const holdout = buildModels(train);

let exact = 0;
let withinOne = 0;
let maxError = 0;
for (const row of test) {
  const w = holdout[row.pos] ?? holdout._generic;
  const d = Math.abs(predict(w, row.x) - row.y);
  if (d === 0) exact += 1;
  if (d <= 1) withinOne += 1;
  if (d > maxError) maxError = d;
}
const acc = {
  exact: exact / test.length,
  withinOne: withinOne / test.length,
  maxError,
};
console.log(
  `tập giữ lại ${test.length}: đúng ${(acc.exact * 100).toFixed(1)}%, ` +
  `lệch ≤1 ${(acc.withinOne * 100).toFixed(1)}%, lệch lớn nhất ${acc.maxError}`,
);

// Mô hình xuất ra dùng TOÀN BỘ dữ liệu; số liệu ở trên là của tập giữ lại.
const models = buildModels(all);
const round = (n: number) => Number(n.toFixed(6));
const body = Object.entries(models)
  .map(([k, w]) => `  ${JSON.stringify(k)}: [${w.map(round).join(", ")}],`)
  .join("\n");

const banner = [
  "/**",
  " * Trọng số tính overall. TỆP NÀY ĐƯỢC SINH RA — chạy",
  " * `npx tsx scripts/train-ovr.ts <players.csv>` để cập nhật, đừng sửa tay.",
  " *",
  " * Overall KHÔNG được lưu trong file save: đã quét toàn bộ 1.152 vị trí bit mà",
  " * không trường nào khớp. Nó là hàm tất định của các chỉ số nên EA không lưu.",
  " *",
  " * Vì đây là giá trị TÍNH chứ không phải ĐỌC, UI phải nói rõ điều đó — trình bày",
  " * nó như số lấy thẳng từ file là nói sai với người dùng.",
  " */",
  "",
  "/** Thứ tự biến: 31 chỉ số theo `ATTRIBUTE_ORDER`, rồi internationalReputation. */",
  `export const OVR_FEATURE_COUNT = ${NF};`,
  "",
  "/** Mỗi mảng dài OVR_FEATURE_COUNT + 1; phần tử cuối là hệ số tự do. */",
  "export const OVR_MODELS: Record<string, number[]> = {",
  body,
  "};",
  "",
  "/** Đo trên tập giữ lại 20%. Dùng để ghi chú sai số trên UI. */",
  "export const OVR_ACCURACY = {",
  `  exact: ${round(acc.exact)},`,
  `  withinOne: ${round(acc.withinOne)},`,
  `  maxError: ${acc.maxError},`,
  "} as const;",
  "",
].join("\n");

const outPath = "lib/save/career/ovr-model.ts";
writeFileSync(outPath, banner);
console.log(`đã ghi ${Object.keys(models).length} mô hình -> ${outPath}`);

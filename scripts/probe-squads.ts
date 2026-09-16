/**
 * Tuyến B — dò CLB hiện tại trong career.
 *
 *   npx tsx scripts/probe-squads.ts <save> [fc26_teamplayerlinks.csv]
 *
 * Không có CSV: chỉ phân tích cấu trúc vùng đội hình (chạy được ngay).
 * Có CSV: chấm điểm các giả thuyết bằng ground truth playerId → teamId.
 *
 * ─── VÌ SAO ĐÂY LÀ BÀI TOÁN KHÁC VỚI `probe-fields.ts` ──────────────────────
 *
 * Các chỉ số là trường bit nằm TRONG bản ghi cầu thủ 144 byte đã biết vị trí.
 * CLB thì không: nó là một QUAN HỆ. Trong DB của game nó nằm ở bảng riêng
 * (`teamplayerlinks`), nên trong save nhiều khả năng cũng vậy. Đây là dò cấu
 * trúc bảng, không phải dò offset bit.
 *
 * Khảo sát trước đã tìm ra một bảng dạng `01 [u32 playerId][u16 position]` ở
 * vùng 8,6-9,4MB, cầu thủ trong đó CÓ gom nhóm — nhưng tỉ lệ đội chiếm đa số
 * chỉ 8/21, nên nó là phần tử TLV chung chứ không phải danh sách đội hình sạch.
 *
 * ─── GIỚI HẠN SÁU GIẢ THUYẾT ────────────────────────────────────────────────
 *
 * Sáu giả thuyết liệt kê sẵn trong spec `2026-09-16-live-editor-decode-design`.
 * Hết sáu mà không đạt ≥95% thì DỪNG và gỡ cột CLB.
 *
 * Giới hạn này có chủ ý. Ba lần dò trước cho thấy việc dò không có tiêu chí
 * dừng thì kéo dài vô hạn, và không ai biết lúc nào nên kết luận "không có".
 */

import { readFileSync } from "node:fs";

import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { CORE_FIELDS } from "../lib/save/career/schema";

const WIN_RATE = 0.95;
/** Khoảng trống tối đa giữa hai bản ghi còn coi là cùng một nhóm, tính bằng byte. */
const GROUP_GAP = 64;

const savePath = process.argv[2];
if (!savePath) {
  console.error("Dùng: npx tsx scripts/probe-squads.ts <save> [fc26_teamplayerlinks.csv]");
  process.exit(1);
}

const file = readFileSync(savePath);
const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);

// ────────────────────────────────────────────────────────────────────────────
// Tập playerId hợp lệ, lấy từ chính bảng cầu thủ
// ────────────────────────────────────────────────────────────────────────────

const table = locatePlayerTable(bytes);
if (!table) {
  console.error("Không định vị được bảng cầu thủ.");
  process.exit(1);
}
const reader = new BitRecordReader(bytes, table.base, table.recordBytes, table.count);

const validIds = new Set<number>();
for (let i = 0; i < table.count; i += 1) {
  const id = reader.field(i, CORE_FIELDS.playerId.bit, CORE_FIELDS.playerId.width);
  if (id !== null && id > 0) validIds.add(id);
}
console.log(`Bảng cầu thủ: ${validIds.size} ID hợp lệ tại offset ${table.base}`);

// ────────────────────────────────────────────────────────────────────────────
// Tìm các bản ghi `01 [u32 playerId][u16 position]`
// ────────────────────────────────────────────────────────────────────────────

const u32 = (o: number) =>
  bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24);
const u16 = (o: number) => bytes[o] | (bytes[o + 1] << 8);

interface Hit {
  offset: number;
  playerId: number;
  position: number;
}

const hits: Hit[] = [];
for (let o = 0; o + 7 < bytes.length; o += 1) {
  if (bytes[o] !== 0x01) continue;
  const id = u32(o + 1) >>> 0;
  if (!validIds.has(id)) continue;
  const pos = u16(o + 5);
  // Mã vị trí FIFA chạy 0-27. Ràng buộc này loại phần lớn trùng ngẫu nhiên.
  if (pos > 27) continue;
  hits.push({ offset: o, playerId: id, position: pos });
}

console.log(`Tìm thấy ${hits.length} bản ghi khớp mẫu \`01 [playerId][position]\``);
if (hits.length === 0) {
  console.error("Không có bản ghi nào — mẫu này không có trong file. Giả thuyết 1-3 bất khả thi.");
  process.exit(1);
}

const first = hits[0].offset;
const last = hits[hits.length - 1].offset;
console.log(
  `Vùng: ${(first / 1e6).toFixed(2)}MB – ${(last / 1e6).toFixed(2)}MB ` +
  `(${(((last - first) / 1024) | 0).toLocaleString("vi-VN")} KB)`,
);

// Bước lặp phổ biến nhất — nếu bảng đều đặn thì một giá trị sẽ áp đảo.
const strides = new Map<number, number>();
for (let i = 1; i < hits.length; i += 1) {
  const d = hits[i].offset - hits[i - 1].offset;
  if (d > 0 && d <= 256) strides.set(d, (strides.get(d) ?? 0) + 1);
}
const topStrides = [...strides.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(
  "Bước lặp phổ biến: " +
  topStrides.map(([d, n]) => `${d} byte (${n} lần)`).join(", "),
);

/**
 * Khoá vào dải liên tục theo bước lặp áp đảo.
 *
 * Quét thô cho ra rất nhiều trùng ngẫu nhiên: một byte 0x01 tình cờ đứng trước
 * bốn byte tình cờ tạo thành playerId hợp lệ. Chúng rải khắp file và làm hỏng
 * mọi phép gom nhóm — lần chạy đầu cho trung vị cỡ nhóm bằng 1 đúng vì thế.
 *
 * Bảng thật thì đều: các bản ghi cách nhau đúng một bước. Nên lọc lấy những
 * đoạn có ít nhất `MIN_RUN` bản ghi liên tiếp cùng bước, và bỏ phần còn lại.
 */
const MIN_RUN = 8;
const stride = topStrides[0]?.[0] ?? 0;
const runs: Hit[][] = [];
{
  let run: Hit[] = [hits[0]];
  for (let i = 1; i < hits.length; i += 1) {
    if (hits[i].offset - hits[i - 1].offset === stride) {
      run.push(hits[i]);
    } else {
      if (run.length >= MIN_RUN) runs.push(run);
      run = [hits[i]];
    }
  }
  if (run.length >= MIN_RUN) runs.push(run);
}

const dense = runs.flat();
console.log(
  `Lọc theo bước ${stride} byte: giữ ${dense.length}/${hits.length} bản ghi ` +
  `trong ${runs.length} dải liên tục ` +
  `(bỏ ${hits.length - dense.length} trùng ngẫu nhiên rải rác)`,
);

if (dense.length === 0) {
  console.error("Không có dải liên tục nào — mẫu này không tạo thành bảng đều.");
  process.exit(1);
}
console.log(
  `Vùng đặc: ${(dense[0].offset / 1e6).toFixed(2)}MB – ` +
  `${(dense[dense.length - 1].offset / 1e6).toFixed(2)}MB, ` +
  `${new Set(dense.map((h) => h.playerId)).size} cầu thủ khác nhau`,
);

// ────────────────────────────────────────────────────────────────────────────
// Gom nhóm trong vùng đặc
// ────────────────────────────────────────────────────────────────────────────

interface Group {
  start: number;
  end: number;
  members: Hit[];
}

const groups: Group[] = runs.map((r) => ({
  start: r[0].offset,
  end: r[r.length - 1].offset,
  members: r,
}));

const sizes = groups.map((g) => g.members.length).sort((a, b) => a - b);
const median = sizes[Math.floor(sizes.length / 2)];
console.log(
  `Gom được ${groups.length} nhóm; cỡ nhóm nhỏ nhất ${sizes[0]}, ` +
  `trung vị ${median}, lớn nhất ${sizes[sizes.length - 1]}`,
);
// Một đội bóng đá có 18-33 cầu thủ. Trung vị ngoài dải đó là dấu hiệu nhóm
// không tương ứng với đội.
console.log(
  median >= 15 && median <= 40
    ? "  -> cỡ nhóm hợp với đội hình một CLB"
    : "  -> cỡ nhóm KHÔNG giống đội hình CLB, nghi nhóm mang nghĩa khác",
);

/**
 * Tìm mã đội bằng RÀNG BUỘC CẤU TRÚC, không cần ground truth.
 *
 * Nếu một trường là mã đội thì nó phải HẰNG ĐỊNH trong mỗi nhóm — mọi cầu thủ
 * cùng đội hình mang cùng mã. Đó là ràng buộc rất chặt, và tự kiểm được từ chính
 * file save, không phải chờ export.
 *
 * Phép đếm "bao nhiêu giá trị phân biệt" thì KHÔNG đủ: một lượt chạy cho 21 giá
 * trị trên 141 nhóm mà vẫn bị gắn nhãn "hợp với số lượng đội", chỉ vì 21 lọt một
 * dải rộng. Số giá trị phân biệt phải xấp xỉ số NHÓM mới có nghĩa.
 */
console.log("\nDò mã đội bằng ràng buộc hằng-định-trong-nhóm:");
{
  interface Cand { off: number; width: number; constRate: number; distinct: number }
  const cands: Cand[] = [];
  for (let off = 0; off + 2 <= stride; off += 1) {
    for (const width of [2, 4]) {
      if (off + width > stride) continue;
      const readAt = (h: Hit) =>
        width === 2 ? u16(h.offset + off) : u32(h.offset + off) >>> 0;
      let constGroups = 0;
      const values = new Set<number>();
      for (const g of groups) {
        const firstValue = readAt(g.members[0]);
        values.add(firstValue);
        if (g.members.every((m) => readAt(m) === firstValue)) constGroups += 1;
      }
      cands.push({ off, width, constRate: constGroups / groups.length, distinct: values.size });
    }
  }

  const ranked = cands.sort((a, b) => b.constRate - a.constRate).slice(0, 6);
  for (const c of ranked) {
    // Mã đội phải thoả CẢ HAI: hằng định trong nhóm, VÀ số giá trị xấp xỉ số nhóm.
    const plausible =
      c.constRate >= 0.95 &&
      c.distinct >= groups.length * 0.5 &&
      c.distinct <= groups.length * 1.5;
    console.log(
      `  +${String(c.off).padStart(2)} u${c.width * 8}: ` +
      `hằng định ở ${(c.constRate * 100).toFixed(1)}% nhóm, ` +
      `${c.distinct} giá trị / ${groups.length} nhóm` +
      (plausible ? "  <<< ỨNG VIÊN MÃ ĐỘI" : ""),
    );
  }
  if (!ranked.some((c) => c.constRate >= 0.95)) {
    console.log(
      "  Không trường nào hằng định trong nhóm -> mã đội KHÔNG nằm trong bản ghi này.\n" +
      "  Giả thuyết 2 bị bác bỏ bằng cấu trúc, không cần ground truth.",
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Ground truth (nếu có)
// ────────────────────────────────────────────────────────────────────────────

const csvPath = process.argv[3];
if (!csvPath) {
  console.log(
    "\nChưa có `fc26_teamplayerlinks.csv` nên dừng ở phân tích cấu trúc.\n" +
    "Chạy `scripts/fc26-dump-db.lua` trong game để lấy ground truth, rồi:\n" +
    `  npx tsx scripts/probe-squads.ts ${savePath} dataset_fc26/fc26_teamplayerlinks.csv`,
  );
  process.exit(0);
}

const truth = new Map<number, number>();
{
  const lines = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const pi = head.indexOf("playerid");
  const ti = head.indexOf("teamid");
  if (pi < 0 || ti < 0) {
    console.error(`${csvPath}: cần cột playerid và teamid. Đọc được: ${head.join(", ")}`);
    process.exit(1);
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i]) continue;
    const f = lines[i].split(",");
    const p = Number(f[pi]);
    const t = Number(f[ti]);
    // Một cầu thủ có thể có nhiều liên kết (CLB + đội tuyển). Giữ liên kết đầu
    // tiên: bảng của game xếp CLB trước.
    if (Number.isFinite(p) && Number.isFinite(t) && p > 0 && t > 0 && !truth.has(p)) {
      truth.set(p, t);
    }
  }
}
console.log(`\nGround truth: ${truth.size} liên kết cầu thủ → đội\n`);

/** Chấm một phép ánh xạ playerId → teamId đoán được. */
function evaluate(label: string, guess: Map<number, number>): boolean {
  let checked = 0;
  let correct = 0;
  for (const [pid, tid] of guess) {
    const real = truth.get(pid);
    if (real === undefined) continue;
    checked += 1;
    if (real === tid) correct += 1;
  }
  const rate = checked === 0 ? 0 : correct / checked;
  const pass = rate >= WIN_RATE && checked >= 500;
  console.log(
    `${pass ? ">>> ĐẠT " : "    trượt"} ${label.padEnd(52)} ` +
    `${(rate * 100).toFixed(1)}% (${correct}/${checked})`,
  );
  return pass;
}

// ── Giả thuyết 1: header mang teamId ngay trước cầu thủ đầu nhóm ────────────
for (const back of [2, 4, 6, 8, 12, 16]) {
  for (const width of [2, 4]) {
    const guess = new Map<number, number>();
    for (const g of groups) {
      const o = g.start - back;
      if (o < 0) continue;
      const tid = width === 2 ? u16(o) : u32(o) >>> 0;
      for (const m of g.members) guess.set(m.playerId, tid);
    }
    if (evaluate(`GT1 header u${width * 8} cách đầu nhóm ${back} byte`, guess)) process.exit(0);
  }
}

// ── Giả thuyết 2: teamId là trường thứ ba trong chính bản ghi ───────────────
for (const off of [7, 9, 11, 5]) {
  for (const width of [2, 4]) {
    const guess = new Map<number, number>();
    for (const h of dense) {
      const o = h.offset + off;
      if (o + width > bytes.length) continue;
      guess.set(h.playerId, width === 2 ? u16(o) : u32(o) >>> 0);
    }
    if (evaluate(`GT2 teamId trong bản ghi tại +${off}, u${width * 8}`, guess)) process.exit(0);
  }
}

// ── Giả thuyết 5: thứ tự nhóm trùng thứ tự teamId tăng dần ──────────────────
{
  const teamIds = [...new Set(truth.values())].sort((a, b) => a - b);
  const guess = new Map<number, number>();
  groups.forEach((g, i) => {
    const tid = teamIds[i];
    if (tid === undefined) return;
    for (const m of g.members) guess.set(m.playerId, tid);
  });
  evaluate("GT5 nhóm thứ n = đội thứ n (teamId tăng dần)", guess);
}

// ── Giả thuyết 6: quét toàn file tìm playerId đứng cạnh teamId đúng ─────────
// Đây là giả thuyết tốn nhất nhưng cũng tổng quát nhất: nếu quan hệ tồn tại ở
// BẤT KỲ đâu dưới dạng hai số cạnh nhau, nó sẽ lộ ra ở đây.
/**
 * Quét MỌI lần xuất hiện, và lấy mức nhiễu từ NHÓM ĐỐI CHỨNG XÁO TRỘN.
 *
 * Bản đầu sai hai chỗ. Thứ nhất nó `break` sau lần khớp `playerId` đầu tiên,
 * mà một playerId xuất hiện ở nhiều bảng khác nhau trong file — lần đầu tiên
 * gần như chắc chắn không phải bảng đội hình. Thứ hai, "trúng ngẫu nhiên" được
 * tính bằng `sample/65536`, một công thức không có nghĩa gì.
 *
 * Mức nhiễu ở đây không suy ra bằng giấy bút được: teamId là số nhỏ, mà byte
 * nhỏ thì đầy rẫy trong file. Cách đúng là đo nó: chạy lại y hệt với teamId bị
 * XÁO TRỘN giữa các cầu thủ. Bất cứ thứ gì thật phải vượt hẳn mức đối chứng đó.
 */
{
  const sample = [...truth.entries()].slice(0, 6000);
  const D_MIN = -24;
  const D_MAX = 24;

  /** Một lượt quét: trả về số lần trúng theo từng khoảng cách. */
  function sweep(pairs: Array<[number, number]>): Map<number, number> {
    const want = new Map<number, number>();
    for (const [pid, tid] of pairs) want.set(pid, tid);
    const hits = new Map<number, number>();

    for (let o = 0; o + 4 <= bytes.length; o += 1) {
      const tid = want.get(u32(o) >>> 0);
      if (tid === undefined) continue;
      for (let d = D_MIN; d <= D_MAX; d += 1) {
        const q = o + 4 + d;
        if (q < 0 || q + 2 > bytes.length) continue;
        if (u16(q) === tid) hits.set(d, (hits.get(d) ?? 0) + 1);
      }
    }
    return hits;
  }

  const real = sweep(sample);

  // Đối chứng: cùng playerId, nhưng teamId bị tráo sang cầu thủ khác.
  const tids = sample.map(([, t]) => t);
  for (let i = tids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [tids[i], tids[j]] = [tids[j], tids[i]];
  }
  const control = sweep(sample.map(([p], i) => [p, tids[i]] as [number, number]));

  const rows = [...real.entries()]
    .map(([d, n]) => ({ d, n, c: control.get(d) ?? 0 }))
    .sort((a, b) => b.n - b.c - (a.n - a.c))
    .slice(0, 6);

  console.log("\nGT6 playerId đứng cạnh teamId đúng — so với đối chứng xáo trộn:");
  let anySignal = false;
  for (const { d, n, c } of rows) {
    // Vượt gấp ba lần nhiễu mới đáng nói; dưới mức đó là trùng do byte nhỏ.
    const signal = n > c * 3 && n > 50;
    if (signal) anySignal = true;
    console.log(
      `  ${d >= 0 ? "+" : ""}${String(d).padStart(3)}: thật ${String(n).padStart(5)} / ` +
      `đối chứng ${String(c).padStart(5)}${signal ? "   <<< VƯỢT NHIỄU" : ""}`,
    );
  }
  if (!anySignal) {
    console.log("  Không khoảng cách nào vượt nhiễu -> GT6 bị bác bỏ.");
  }
}

console.log(
  "\nGT3 (bảng ánh xạ thứ hai) chưa chạy tự động được.\n" +
  "GT4 chạy bằng: npx tsx scripts/probe-fields.ts <save> <fc26_players.csv> current_teamid\n" +
  "\nKhông giả thuyết nào đạt ≥95% thì theo spec: GỠ CỘT CLB, dừng tuyến B.",
);

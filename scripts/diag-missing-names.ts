/**
 * Vì sao một số cầu thủ không có tên?
 *
 *   npx tsx scripts/diag-missing-names.ts <save>
 *
 * Chuỗi tra tên có bốn bậc, và "không có tên" nghĩa là trượt cả bốn:
 *
 *   1. tên do career sinh ra, đọc thẳng chuỗi trong save
 *   2. `players.json` tra theo playerId (roster xuất xưởng)
 *   3. kho tên, tra theo chỉ số firstNameId/lastNameId/commonNameId
 *   4. `#playerId`
 *
 * Script này chia nhóm không tên theo BẬC TRƯỢT, vì mỗi bậc hỏng vì một lý do
 * khác nhau và cần cách sửa khác nhau. Một con số tổng "20% không có tên" không
 * nói được nên sửa ở đâu.
 */
import { readFileSync } from "node:fs";

import { readNewgenNames } from "../lib/save/career/newgen-names";
import { parseSaveBuffer } from "../lib/save";

const savePath = process.argv[2];
if (!savePath) {
  console.error("dùng: npx tsx scripts/diag-missing-names.ts <save>");
  process.exit(1);
}

const db = JSON.parse(readFileSync("public/fc26/players.json", "utf8")) as {
  ids: number[];
  names: string[];
};
const dbName = new Map<number, string>();
db.ids.forEach((id, i) => dbName.set(id, db.names[i]));

interface Packed {
  id: number[];
  text: string[];
}
const pool = JSON.parse(readFileSync("public/fc26/names.json", "utf8")) as {
  exact?: boolean;
  pool?: Packed;
  first?: Packed;
  last?: Packed;
  common?: Packed;
};
/*
 * Dựng MAP id→chữ, không phải SET id.
 *
 * `Fc26Names.resolve` đòi chuỗi khác rỗng: `f && l ? ... : null`. Một id có
 * trong kho nhưng chữ rỗng sẽ trượt ở đó, trong khi phép kiểm "id có trong
 * kho" lại báo đạt. Phiên bản đầu của script này đo bằng SET và vì thế kết
 * luận 99,9% có tên, trong khi giao diện rõ ràng còn người không tên.
 */
const asMap = (p: Packed | undefined) => {
  const m = new Map<number, string>();
  if (!p) return m;
  for (let i = 0; i < p.id.length; i += 1) m.set(p.id[i], p.text[i]);
  return m;
};
// Bảng gốc là MỘT kho dùng chung; asset cũ thì ba kho riêng.
const single = pool.pool ? asMap(pool.pool) : null;
const firstMap = single ?? asMap(pool.first);
const lastMap = single ?? asMap(pool.last);
const commonMap = single ?? asMap(pool.common);
/** Có chữ dùng được, chứ không chỉ có id. */
const firstPool = { has: (id: number) => !!firstMap.get(id) };
const lastPool = { has: (id: number) => !!lastMap.get(id) };
const commonPool = { has: (id: number) => !!commonMap.get(id) };
// Bảng gốc từ khi build-fc26-namepool.ts thay thế bản suy ra — không còn "độ
// chính xác" nào để báo, nên bỏ hẳn nhánh đó thay vì giữ một giá trị chết.
console.log(
  `kho tên: ${firstMap.size} tên, ${lastMap.size} họ, ${commonMap.size} tên thường dùng ` +
    `(${pool.exact ? "bảng gốc, chính xác tuyệt đối" : "suy ra"})`,
);

const buffer = readFileSync(savePath);
const arr = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const doc = parseSaveBuffer(arr, { fileName: savePath });
const career = doc.career;
if (!career) {
  console.error("không đọc được career");
  process.exit(1);
}
const newgen = readNewgenNames(new Uint8Array(buffer));

console.log(`\nbảng cầu thủ: ${career.players.length} người sau khi lọc`);
console.log(`tên đọc thẳng từ save: ${newgen.size}`);

// ── Phân nhóm ───────────────────────────────────────────────────────────────
type Why =
  | "có tên"
  | "kho tên thiếu HỌ"
  | "kho tên thiếu TÊN"
  | "kho tên thiếu cả hai"
  | "save không có chỉ số tên"
  | "kho tên thiếu tên thường dùng";

const why = new Map<Why, number>();
const examples = new Map<Why, string[]>();
const bump = (w: Why, note: string) => {
  why.set(w, (why.get(w) ?? 0) + 1);
  const list = examples.get(w) ?? [];
  if (list.length < 4) list.push(note);
  examples.set(w, list);
};

for (const p of career.players) {
  // Bậc 1 và 2 do `SaveReaderClient` ghép; ở đây tính lại để phân nhóm được.
  if (newgen.has(p.playerId) || dbName.has(p.playerId)) {
    bump("có tên", "");
    continue;
  }

  const { firstNameId: f, lastNameId: l, commonNameId: c } = p;
  if (c) {
    if (commonPool.has(c)) bump("có tên", "");
    else bump("kho tên thiếu tên thường dùng", `#${p.playerId} common=${c}`);
    continue;
  }
  if (f === null || l === null || (f === 0 && l === 0)) {
    bump("save không có chỉ số tên", `#${p.playerId} first=${f} last=${l}`);
    continue;
  }
  const hasF = firstPool.has(f);
  const hasL = lastPool.has(l);
  if (hasF && hasL) bump("có tên", "");
  else if (!hasF && !hasL) bump("kho tên thiếu cả hai", `#${p.playerId} first=${f} last=${l}`);
  else if (!hasL) bump("kho tên thiếu HỌ", `#${p.playerId} last=${l}`);
  else bump("kho tên thiếu TÊN", `#${p.playerId} first=${f}`);
}

// Soi từng người cụ thể khi truyền thêm ID vào dòng lệnh.
const focus = process.argv.slice(3).map(Number);
if (focus.length) {
  console.log("\n── soi từng người ──");
  for (const id of focus) {
    const p = career.players.find((x) => x.playerId === id);
    if (!p) {
      console.log(`  #${id} KHÔNG có trong danh sách đã lọc`);
      continue;
    }
    const dbHas = dbName.has(id);
    console.log(
      `  #${id} newgen=${newgen.has(id)} db=${dbHas}${dbHas ? ` ("${dbName.get(id)}")` : ""} ` +
        `first=${p.firstNameId}${p.firstNameId !== null ? `(${firstPool.has(p.firstNameId)})` : ""} ` +
        `last=${p.lastNameId}${p.lastNameId !== null ? `(${lastPool.has(p.lastNameId)})` : ""} ` +
        `common=${p.commonNameId}${p.commonNameId ? `(${commonPool.has(p.commonNameId)})` : ""} ` +
        `→ name=${JSON.stringify(p.name)}`,
    );
  }
}

// DB có bản ghi nhưng tên RỖNG thì vẫn hiện ra `#id` — một dạng trượt riêng mà
// phép đếm "có trong DB" không thấy.
const emptyInDb = db.names.filter((n) => !n || !n.trim()).length;
console.log(`\nDB nhúng: ${emptyInDb}/${db.ids.length} bản ghi có tên RỖNG`);

const total = career.players.length;
console.log("\n── vì sao không có tên ──");
for (const [w, n] of [...why.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)} (${((n / total) * 100).toFixed(1)}%)  ${w}`);
  const ex = examples.get(w) ?? [];
  if (w !== "có tên" && ex.length) console.log(`         vd: ${ex.join(", ")}`);
}

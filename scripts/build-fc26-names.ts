/**
 * Dựng kho tên của FC 26 thành asset tĩnh.
 *
 *   npx tsx scripts/build-fc26-names.ts <export-co-chi-so> <export-co-chu> [ra.json]
 *
 * ─── VÌ SAO CẦN ─────────────────────────────────────────────────────────────
 *
 * Save không lưu tên cầu thủ dưới dạng chữ — nó lưu CHỈ SỐ trỏ vào kho tên của
 * bản cài game (`firstnameid`, `lastnameid`, `commonnameid`, đọc được ở bit
 * 200/216/248, khớp 100%).
 *
 * Với cầu thủ có sẵn thì không sao: `players.json` đã có tên nguyên văn tra theo
 * `playerId`. Nhưng cầu thủ do career SINH RA thì không có trong dataset nào cả,
 * và save chỉ lưu chuỗi tên cho một phần nhỏ trong số họ — đo được: 22/55, toàn
 * dải ID cao. Với 33 người còn lại, tên không có trong file dưới dạng chữ (chỉ
 * 14/33 có họ xuất hiện ở đâu đó, và 0 trong số đó gắn với playerId ở gần).
 *
 * Kho tên thì khác: nó là HẰNG SỐ THEO PHIÊN BẢN GAME. Mọi career đều rút tên
 * regen từ cùng kho này, nên nướng nó vào asset tĩnh là hợp lệ — cùng lý do đã
 * cho phép nướng tên cầu thủ. Và khác hẳn việc nướng tên regen của MỘT career:
 * cái đó gieo dữ liệu của người này cho người khác, còn cái này thì không.
 *
 * ─── CÁCH DỰNG ──────────────────────────────────────────────────────────────
 *
 * Ghép hai bản export của cùng một career:
 *   - bản có `firstnameid`/`lastnameid`/`commonnameid`
 *   - bản có `player_name` dạng chữ (từ `GetPlayerName`)
 *
 * Cầu thủ có `commonnameid = 0` thì tên hiển thị là "tên + họ", tách được. Cầu
 * thủ có tên thường dùng thì lấy nguyên văn làm mục của `commonnameid`.
 *
 * Xung đột giải bằng BỎ PHIẾU ĐA SỐ chứ không phải ghi đè. Cách ghi đè cho
 * 95,2% đúng; bỏ phiếu cho 97,6%. Xung đột là có thật vì `GetPlayerName` đôi khi
 * trả về dạng rút gọn ("M. Lewis-Skelly") thay vì "tên + họ".
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const idsPath = process.argv[2];
const textPath = process.argv[3];
const outPath = process.argv[4] ?? "public/fc26/names.json";
if (!idsPath || !textPath) {
  console.error(
    "Dùng: npx tsx scripts/build-fc26-names.ts <export-co-chi-so> <export-co-chu> [ra.json]",
  );
  process.exit(1);
}

function readCsv(path: string): Array<Record<string, string>> {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const head = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    // Tên cầu thủ có thể chứa dấu phẩy trong ngoặc kép.
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (quoted) {
        if (c !== '"') cur += c;
        else if (line[i + 1] === '"') { cur += '"'; i += 1; }
        else quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === ",") { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur);
    const row: Record<string, string> = {};
    head.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** playerId → (firstnameid, lastnameid, commonnameid). */
const ids = new Map<number, [number, number, number]>();
for (const r of readCsv(idsPath)) {
  const pid = num(r.playerid_key || r.playerid);
  if (pid > 0) ids.set(pid, [num(r.firstnameid), num(r.lastnameid), num(r.commonnameid)]);
}

/** playerId → tên hiển thị. */
const text = new Map<number, string>();
for (const r of readCsv(textPath)) {
  const pid = num(r.playerid_key || r.playerid);
  const name = (r.player_name ?? "").trim();
  if (pid > 0 && name) text.set(pid, name);
}

console.log(`${ids.size} cầu thủ có chỉ số tên, ${text.size} có tên dạng chữ`);
if (ids.size === 0 || text.size === 0) {
  console.error("Một trong hai nguồn rỗng — kiểm lại thứ tự tham số.");
  process.exit(1);
}

// ── Bỏ phiếu ────────────────────────────────────────────────────────────────

type Votes = Map<number, Map<string, number>>;
const vote = (v: Votes, id: number, value: string) => {
  if (id <= 0 || !value) return;
  if (!v.has(id)) v.set(id, new Map());
  const m = v.get(id)!;
  m.set(value, (m.get(value) ?? 0) + 1);
};
const winner = (v: Votes): Map<number, string> => {
  const out = new Map<number, string>();
  for (const [id, counts] of v) {
    let best = "";
    let bestN = 0;
    for (const [value, n] of counts) if (n > bestN) { bestN = n; best = value; }
    if (best) out.set(id, best);
  }
  return out;
};

const firstVotes: Votes = new Map();
const lastVotes: Votes = new Map();
const commonVotes: Votes = new Map();

for (const [pid, [fi, li, ci]] of ids) {
  const full = text.get(pid);
  if (!full) continue;
  if (ci !== 0) {
    commonVotes.has(ci);
    vote(commonVotes, ci, full);
    continue;
  }
  const parts = full.split(" ");
  if (parts.length < 2) continue;
  vote(firstVotes, fi, parts.slice(0, -1).join(" "));
  vote(lastVotes, li, parts[parts.length - 1]);
}

const first = winner(firstVotes);
const last = winner(lastVotes);
const common = winner(commonVotes);

// ── Đo lại trên chính dữ liệu nguồn ─────────────────────────────────────────

const resolve = (fi: number, li: number, ci: number): string | null => {
  if (ci !== 0) return common.get(ci) ?? null;
  const f = first.get(fi);
  const l = last.get(li);
  return f && l ? `${f} ${l}` : null;
};

let ok = 0;
let total = 0;
for (const [pid, [fi, li, ci]] of ids) {
  const full = text.get(pid);
  if (!full) continue;
  total += 1;
  if (resolve(fi, li, ci) === full) ok += 1;
}
console.log(
  `Từ điển: ${first.size} tên + ${last.size} họ + ${common.size} tên thường dùng`,
);
console.log(`Tự kiểm trên nguồn: ${ok}/${total} = ${((ok / total) * 100).toFixed(1)}% khớp từng chữ`);

// ── Ghi ra ──────────────────────────────────────────────────────────────────

/** Mảng song song thay vì object: cùng dữ liệu, không lặp lại dấu ngoặc kép. */
const pack = (m: Map<number, string>) => {
  const keys = [...m.keys()].sort((a, b) => a - b);
  return { id: keys, text: keys.map((k) => m.get(k) as string) };
};

const payload = {
  source: `${idsPath} + ${textPath}`,
  builtAt: new Date().toISOString().slice(0, 10),
  accuracy: Math.round((ok / total) * 1000) / 1000,
  first: pack(first),
  last: pack(last),
  common: pack(common),
};

mkdirSync(dirname(outPath), { recursive: true });
const json = JSON.stringify(payload);
writeFileSync(outPath, json);
console.log(`-> ${outPath} (${(json.length / 1024).toFixed(0)} KB chưa nén)`);

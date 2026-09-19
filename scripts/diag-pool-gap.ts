/**
 * Vì sao 15% cầu thủ không tra được tên bằng kho tên?
 *
 *   npx tsx scripts/diag-pool-gap.ts <save>
 *
 * Chia nhóm theo NGUYÊN NHÂN, vì mỗi nguyên nhân cần cách sửa khác nhau:
 * chỉ số tên bằng 0 trong save thì phải tra ngược từ `playerId`; chỉ số có
 * nhưng vắng trong kho thì phải bổ sung kho.
 */
import { readFileSync } from "node:fs";

import { parseSaveBuffer } from "../lib/save";

const path = process.argv[2];
const pool = JSON.parse(readFileSync("public/fc26/names.json", "utf8")) as {
  pool: { id: number[]; text: string[] };
};
const text = new Map<number, string>();
pool.pool.id.forEach((id, i) => text.set(id, pool.pool.text[i]));

const buf = readFileSync(path);
const doc = parseSaveBuffer(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  { fileName: path },
);
const players = doc.career!.players;

const why = new Map<string, number>();
const ex = new Map<string, string[]>();
const bump = (k: string, s: string) => {
  why.set(k, (why.get(k) ?? 0) + 1);
  const a = ex.get(k) ?? [];
  if (a.length < 3) a.push(s);
  ex.set(k, a);
};

for (const p of players) {
  const { firstNameId: f, lastNameId: l, commonNameId: c, playerId: id } = p;
  if (c && text.get(c)) { bump("tra được (common)", ""); continue; }
  if (f && l && text.get(f) && text.get(l)) { bump("tra được (first+last)", ""); continue; }
  const z = (x: number | null) => x === null || x === 0;
  if (z(f) && z(l) && z(c)) bump("CẢ BA chỉ số = 0 trong save", `#${id}`);
  else if (z(f) || z(l)) bump("một chỉ số = 0", `#${id} f=${f} l=${l} c=${c}`);
  else bump("chỉ số CÓ nhưng vắng trong kho", `#${id} f=${f}(${!!text.get(f!)}) l=${l}(${!!text.get(l!)})`);
}

const n = players.length;
for (const [k, v] of [...why].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(v).padStart(6)} (${((v / n) * 100).toFixed(2)}%)  ${k}`);
  const a = ex.get(k) ?? [];
  if (a[0]) console.log(`                    vd: ${a.join(", ")}`);
}

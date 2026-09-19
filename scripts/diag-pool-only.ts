/**
 * Bỏ hẳn `players.json` thì còn bao nhiêu cầu thủ có tên?
 *
 *   npx tsx scripts/diag-pool-only.ts <save...>
 *
 * `players.json` (1,9MB, ghép từ ba dataset công khai) tra tên theo `playerId`.
 * Kho tên (`names.json`, bảng `playernames` gốc) tra theo `nameId` mà CHÍNH save
 * mang theo. Nếu kho tên một mình đã phủ gần hết, thì vai trò TÊN của
 * `players.json` là thừa — và nó chỉ còn cần cho CLB/giải/quốc tịch.
 *
 * Đo trên nhiều save vì đây là câu hỏi về tính tổng quát, không phải về một save.
 */
import { readFileSync } from "node:fs";

import { readNewgenNames } from "../lib/save/career/newgen-names";
import { parseSaveBuffer } from "../lib/save";

const paths = process.argv.slice(2);
const pool = JSON.parse(readFileSync("public/fc26/names.json", "utf8")) as {
  pool?: { id: number[]; text: string[] };
};
const text = new Map<number, string>();
if (pool.pool) pool.pool.id.forEach((id, i) => text.set(id, pool.pool!.text[i]));
console.log(`kho tên: ${text.size} mục`);

const db = JSON.parse(readFileSync("public/fc26/players.json", "utf8")) as {
  ids: number[];
  names: string[];
};
const dbName = new Map<number, string>();
db.ids.forEach((id, i) => { if (db.names[i]?.trim()) dbName.set(id, db.names[i]); });

for (const p of paths) {
  const buf = readFileSync(p);
  const doc = parseSaveBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { fileName: p },
  );
  const players = doc.career?.players ?? [];
  if (!players.length) continue;
  const newgen = readNewgenNames(new Uint8Array(buf));

  let poolOnly = 0;   // chỉ save + kho tên, KHÔNG players.json
  let full = 0;       // chuỗi hiện tại, có players.json
  let onlyDb = 0;     // players.json cứu được mà kho tên không
  for (const pl of players) {
    const viaSave = newgen.has(pl.playerId);
    const c = pl.commonNameId;
    const f = pl.firstNameId;
    const l = pl.lastNameId;
    const viaPool =
      (c ? !!text.get(c) : false) || (!!f && !!l && !!text.get(f) && !!text.get(l));
    const viaDb = dbName.has(pl.playerId);
    if (viaSave || viaPool) poolOnly += 1;
    if (viaSave || viaPool || viaDb) full += 1;
    if (!viaSave && !viaPool && viaDb) onlyDb += 1;
  }
  const n = players.length;
  const pc = (x: number) => `${((x / n) * 100).toFixed(2)}%`;
  console.log(
    `\n${p.split(/[\/]/).pop()}  (${n} cầu thủ)\n` +
      `   save + kho tên, KHÔNG players.json : ${poolOnly} (${pc(poolOnly)})\n` +
      `   chuỗi hiện tại (có players.json)   : ${full} (${pc(full)})\n` +
      `   riêng players.json cứu được        : ${onlyDb}`,
  );
}

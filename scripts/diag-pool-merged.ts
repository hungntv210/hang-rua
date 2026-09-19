/**
 * Ghép `playernames` + `dcplayernames` thì kho tên phủ được bao nhiêu?
 *
 *   npx tsx scripts/diag-pool-merged.ts <save...>
 *
 * `playernames` phủ nameid 0–41.189; `dcplayernames` phủ từ 44.000 trở lên
 * (5.624 mục, tên thêm qua bản cập nhật đội hình). Bản dựng kho tên hiện tại
 * chỉ lấy bảng thứ nhất — đó là lý do 15% cầu thủ phải nhờ `players.json` tra
 * theo `playerId`. Script này đo xem ghép hai bảng có đóng được khoảng đó không.
 */
import { readFileSync } from "node:fs";

import { readNewgenNames } from "../lib/save/career/newgen-names";
import { parseSaveBuffer } from "../lib/save";

const LE = "dataset_fc26/Live Editor";
const text = new Map<number, string>();
for (const f of [`${LE}/fc26_playernames.csv`, `${LE}/fc26_dcplayernames.csv`]) {
  const lines = readFileSync(f, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  for (const line of lines.slice(1)) {
    const i = line.indexOf(",");
    const id = Number(line.slice(0, i));
    const s = line.slice(i + 1).trim();
    if (Number.isFinite(id) && s) text.set(id, s);
  }
}
console.log(`kho ghép: ${text.size} tên`);

for (const p of process.argv.slice(2)) {
  const buf = readFileSync(p);
  const doc = parseSaveBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { fileName: p },
  );
  const players = doc.career?.players ?? [];
  if (!players.length) continue;
  const newgen = readNewgenNames(new Uint8Array(buf));

  let ok = 0;
  const miss: string[] = [];
  for (const pl of players) {
    const { firstNameId: f, lastNameId: l, commonNameId: c } = pl;
    if (
      newgen.has(pl.playerId) ||
      (c && text.get(c)) ||
      (f && l && text.get(f) && text.get(l))
    ) { ok += 1; continue; }
    if (miss.length < 4) miss.push(`#${pl.playerId} f=${f} l=${l} c=${c}`);
  }
  const n = players.length;
  console.log(
    `\n${p.split(/[\/]/).pop()}: ${ok}/${n} = ${((ok / n) * 100).toFixed(2)}% ` +
      `KHÔNG cần players.json` + (miss.length ? `\n   còn thiếu: ${miss.join(", ")}` : ""),
  );
}

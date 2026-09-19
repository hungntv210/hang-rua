/**
 * Cờ Ultimate Team đang lọc bỏ ai?
 *
 *   npx tsx scripts/diag-ut-flag.ts <save...>
 *
 * `SaveReaderClient` bỏ hẳn khỏi danh sách mọi cầu thủ mà `players.json` đánh
 * dấu là nội dung Ultimate Team. Cờ đó đến từ dataset CÔNG KHAI. Bảng `players`
 * GỐC của game lại là roster Career thuần — không có Icon nào. Nếu một người
 * vừa bị cờ UT vừa có trong bảng gốc, thì trang đang giấu cầu thủ thật.
 */
import { readFileSync } from "node:fs";

import { parseSaveBuffer } from "../lib/save";

const db = JSON.parse(readFileSync("public/fc26/players.json", "utf8")) as {
  ids: number[];
  names: string[];
  utIds?: number[];
};
const ut = new Set(db.utIds ?? []);
const name = new Map<number, string>();
db.ids.forEach((id, i) => name.set(id, db.names[i]));

const lines = readFileSync("dataset_fc26/Live Editor/fc26_players.csv", "utf8")
  .replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
const iPid = lines[0].split(",").map((h) => h.trim().toLowerCase()).indexOf("playerid");
const shipped = new Set(lines.slice(1).map((l) => Number(l.split(",")[iPid])));

console.log(`cờ UT: ${ut.size} id   ·   bảng gốc game: ${shipped.size} cầu thủ\n`);

for (const p of process.argv.slice(2)) {
  const buf = readFileSync(p);
  const doc = parseSaveBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { fileName: p },
  );
  const players = doc.career?.players ?? [];
  if (!players.length) continue;
  const flagged = players.filter((x) => ut.has(x.playerId));
  const wrong = flagged.filter((x) => shipped.has(x.playerId));
  console.log(
    `${p.split(/[\/]/).pop()}: ${players.length} cầu thủ, bị lọc ${flagged.length}\n` +
      `   trong đó CÓ trong bảng gốc (tức cầu thủ Career thật): ${wrong.length}`,
  );
  for (const x of wrong.slice(0, 5)) {
    console.log(`      #${x.playerId} ${name.get(x.playerId) ?? "?"} · ${x.age} tuổi · CS ${x.overall}`);
  }
}

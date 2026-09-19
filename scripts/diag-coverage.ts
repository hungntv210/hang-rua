/**
 * Bảng gốc của game phủ được bao nhiêu phần của MỖI save?
 *
 *   npx tsx scripts/diag-coverage.ts <save...>
 *
 * Câu hỏi quyết định trước khi đổi nguồn `players.json`: nếu dựng DB từ bảng
 * `players` của game thay cho ba dataset công khai, có save nào bị nghèo tên đi
 * không? Đo trên NHIỀU save, vì một save không nói được gì về tính tổng quát.
 */
import { readFileSync } from "node:fs";

import { parseSaveBuffer } from "../lib/save";

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error("dùng: npx tsx scripts/diag-coverage.ts <save...>");
  process.exit(1);
}

const csv = (f: string) => {
  const lines = readFileSync(f, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return { head, rows: lines.slice(1).map((l) => l.split(",")) };
};

const LE = "dataset_fc26/Live Editor";
const P = csv(`${LE}/fc26_players.csv`);
const iPid = P.head.indexOf("playerid");
const gameIds = new Set(P.rows.map((r) => Number(r[iPid])));

const pub = JSON.parse(readFileSync("public/fc26/players.json", "utf8")) as { ids: number[] };
const pubIds = new Set(pub.ids);

console.log(`bảng game: ${gameIds.size} cầu thủ   ·   DB công khai hiện dùng: ${pubIds.size}`);

for (const p of paths) {
  const buf = readFileSync(p);
  const doc = parseSaveBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { fileName: p },
  );
  const players = doc.career?.players ?? [];
  if (!players.length) {
    console.log(`\n${p.split(/[\/]/).pop()}: KHÔNG đọc được career`);
    continue;
  }
  let inGame = 0;
  let inPub = 0;
  let neither = 0;
  for (const pl of players) {
    const g = gameIds.has(pl.playerId);
    const u = pubIds.has(pl.playerId);
    if (g) inGame += 1;
    if (u) inPub += 1;
    if (!g && !u) neither += 1;
  }
  const n = players.length;
  const pc = (x: number) => `${((x / n) * 100).toFixed(2)}%`;
  console.log(
    `\n${p.split(/[\/]/).pop()}: ${n} cầu thủ\n` +
      `   bảng game phủ : ${inGame} (${pc(inGame)})\n` +
      `   DB công khai  : ${inPub} (${pc(inPub)})\n` +
      `   cả hai đều thiếu: ${neither} (${pc(neither)})  ← phải là cầu thủ do career sinh ra`,
  );
}

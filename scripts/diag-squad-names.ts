/**
 * Đội hình trong một file save là những ai?
 *
 *   npx tsx scripts/diag-squad-names.ts <save>
 *
 * Tra tên qua DB nhúng và qua kho tên trong save, đúng cách trang làm — để
 * trả lời "save này là đội nào" mà không phải mở trình duyệt.
 */
import { readFileSync } from "node:fs";

import { buildLineup, pickSquad, type FormationShape, type LineupPlayer } from "../lib/fc26/lineup";
import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodeAllPlayers } from "../lib/save/career/players";
import { positionName } from "../lib/save/career/schema";
import { findSquads } from "../lib/save/career/squad";

const savePath = process.argv[2];
if (!savePath) {
  console.error("dùng: npx tsx scripts/diag-squad-names.ts <save>");
  process.exit(1);
}

const db = JSON.parse(readFileSync("public/fc26/players.json", "utf8")) as {
  ids: number[];
  names: string[];
  clubs: string[];
};
const nameOf = new Map<number, string>();
const clubOf = new Map<number, string>();
db.ids.forEach((id, i) => {
  nameOf.set(id, db.names[i]);
  clubOf.set(id, db.clubs[i]);
});

const bytes = new Uint8Array(readFileSync(savePath));
const loc = locatePlayerTable(bytes);
if (!loc) {
  console.error("không định vị được bảng cầu thủ");
  process.exit(1);
}
const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);
const raw = decodeAllPlayers(reader, loc.count);
const byId = new Map<number, LineupPlayer>(
  raw.map((p) => [
    p.playerId,
    { playerId: p.playerId, position: positionName(p.positionCode), overall: p.overall },
  ]),
);
const rawById = new Map(raw.map((p) => [p.playerId, p]));

const blocks = findSquads(bytes, new Set(byId.keys()));
console.log(`${blocks.length} khối; bảng cầu thủ ${raw.length} bản ghi\n`);

const squad = pickSquad(blocks.map((b) => b.playerIds), byId);
if (!squad) {
  console.error("không chọn được khối đội hình");
  process.exit(1);
}

const rows = squad
  .map((id) => ({ id, p: byId.get(id)!, r: rawById.get(id)! }))
  .sort((a, b) => (b.p.overall ?? 0) - (a.p.overall ?? 0));

const clubs = new Map<string, number>();
console.log(`đội ${squad.length} cầu thủ:`);
for (const { id, p, r } of rows) {
  const name = nameOf.get(id);
  const club = clubOf.get(id) ?? "";
  if (club) clubs.set(club, (clubs.get(club) ?? 0) + 1);
  // Cầu thủ do career sinh ra không có trong DB nhúng — đánh dấu rõ thay vì
  // để trống, vì "không có tên" và "tên rỗng" là hai chuyện khác nhau.
  const label = name ?? (id >= 400000 ? "(career sinh ra)" : "(không có trong DB)");
  console.log(
    `  #${String(id).padStart(7)} ${String(p.overall ?? "??").padStart(2)}/${String(
      r.potential ?? "??",
    ).padEnd(2)} ${p.position.padEnd(4)} HĐ ${String(r.contractUntil ?? "????")} ` +
      `${label.padEnd(24)} ${club}`,
  );
}

console.log("\nCLB gốc của các cầu thủ (theo dataset đầu mùa):");
for (const [club, n] of [...clubs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log(`  ${String(n).padStart(2)} × ${club}`);
}
const regen = squad.filter((id) => id >= 400000).length;
console.log(`\n${regen}/${squad.length} cầu thủ do career sinh ra (ID ≥ 400000)`);

// Đội hình gợi ý — đúng thứ trang sẽ vẽ khi chưa có bản export career.
const shapes: FormationShape[] = JSON.parse(
  readFileSync("public/fc26/formations.json", "utf8"),
).formations;
const lineup = buildLineup(squad, byId, shapes, positionName);
if (lineup) {
  console.log(
    `\nđội hình gợi ý — ${lineup.formationName} (${lineup.exactCount}/11 đúng sở trường):`,
  );
  for (const slot of lineup.slots) {
    const p = byId.get(slot.playerId)!;
    console.log(
      `  ${positionName(slot.positionCode).padEnd(4)} ${String(p.overall ?? "??").padStart(2)} ` +
        `${(nameOf.get(slot.playerId) ?? `#${slot.playerId}`).padEnd(24)} ` +
        `sở trường ${p.position.padEnd(4)} ${slot.fit === "exact" ? "" : `(${slot.fit})`}`,
    );
  }
}

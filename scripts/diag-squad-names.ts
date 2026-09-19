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
import { Fc26Names } from "../lib/fc26/names";
import { Fc26World } from "../lib/fc26/world";
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

const world = Fc26World.fromPayload(
  JSON.parse(readFileSync("public/fc26/world.json", "utf8")),
);
const names = Fc26Names.fromPayload(
  JSON.parse(readFileSync("public/fc26/names.json", "utf8")),
);

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
  const name = names.resolve(r.firstNameId, r.lastNameId, r.commonNameId);
  const club = world.clubOf(id)?.name ?? "";
  if (club) clubs.set(club, (clubs.get(club) ?? 0) + 1);
  // Cầu thủ do career sinh ra không có trong roster xuất xưởng — đánh dấu rõ
  // thay vì để trống, vì "không có tên" và "tên rỗng" là hai chuyện khác nhau.
  const label = name ?? (world.shippedIds().has(id) ? "(không tra được tên)" : "(career sinh ra)");
  console.log(
    `  #${String(id).padStart(7)} ${String(p.overall ?? "??").padStart(2)}/${String(
      r.potential ?? "??",
    ).padEnd(2)} ${p.position.padEnd(4)} HĐ ${String(r.contractUntil ?? "????")} ` +
      `${label.padEnd(24)} ${club}`,
  );
}

console.log("\nCLB gốc của các cầu thủ (theo bảng gốc của game):");
for (const [club, n] of [...clubs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log(`  ${String(n).padStart(2)} × ${club}`);
}
// Không dùng ngưỡng ID cứng (ví dụ 400000): dải id career sinh ra khác nhau
// giữa các career, còn `shippedIds()` là tập roster xuất xưởng thật của game.
const regen = squad.filter((id) => !world.shippedIds().has(id)).length;
console.log(`\n${regen}/${squad.length} cầu thủ do career sinh ra (không có trong roster xuất xưởng)`);

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
    const r = rawById.get(slot.playerId);
    const slotName = r ? names.resolve(r.firstNameId, r.lastNameId, r.commonNameId) : null;
    console.log(
      `  ${positionName(slot.positionCode).padEnd(4)} ${String(p.overall ?? "??").padStart(2)} ` +
        `${(slotName ?? `#${slot.playerId}`).padEnd(24)} ` +
        `sở trường ${p.position.padEnd(4)} ${slot.fit === "exact" ? "" : `(${slot.fit})`}`,
    );
  }
}

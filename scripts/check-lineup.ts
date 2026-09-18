/**
 * Kiểm bộ dựng đội hình chạy qua ĐÚNG đường đi mà trang dùng.
 *
 *   npx tsx scripts/check-lineup.ts <save…>
 *
 * Phép kiểm quan trọng nhất ở đây là phép kiểm mà bản cũ TRƯỢT: save 30-07
 * không khớp team sheet nướng sẵn nào nên trang không vẽ được gì. Bản mới phải
 * dựng được đội hình cho MỌI save có đội hình trong đó.
 */
import { readFileSync } from "node:fs";

import { buildLineup, pickSquad, type LineupPlayer } from "../lib/fc26/lineup";
import type { FormationShape } from "../lib/fc26/lineup";
import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodeAllPlayers } from "../lib/save/career/players";
import { positionName } from "../lib/save/career/schema";
import { findSquads } from "../lib/save/career/squad";

const shapes = (
  JSON.parse(readFileSync("public/fc26/formations.json", "utf8")) as {
    formations: FormationShape[];
    sheets?: unknown;
  }
).formations;

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

check(
  "asset sơ đồ không còn kèm bảng team sheet",
  !(JSON.parse(readFileSync("public/fc26/formations.json", "utf8")) as { sheets?: unknown }).sheets,
);
check("có hình học sơ đồ", shapes.length > 0, `${shapes.length} sơ đồ`);

const seen: string[] = [];

for (const savePath of process.argv.slice(2)) {
  const name = savePath.split(/[\\/]/).pop()!;
  console.log(`\n════ ${name} ════`);

  const bytes = new Uint8Array(readFileSync(savePath));
  const loc = locatePlayerTable(bytes);
  if (!loc) {
    check(`${name}: định vị được bảng cầu thủ`, false);
    continue;
  }
  const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);
  const raw = decodeAllPlayers(reader, loc.count);
  const byId = new Map<number, LineupPlayer>(
    raw.map((p) => [
      p.playerId,
      { playerId: p.playerId, position: positionName(p.positionCode), overall: p.overall },
    ]),
  );
  const candidates = findSquads(bytes, new Set(byId.keys())).map((s) => s.playerIds);

  const squad = pickSquad(candidates, byId);
  check(`${name}: chọn được khối đội hình`, squad !== null, `${candidates.length} ứng viên`);
  if (!squad) continue;

  // Khối 11 người là danh sách theo dõi chuyển nhượng, không phải đội hình.
  check(`${name}: không chọn nhầm khối nhỏ`, squad.length >= 16, `${squad.length} cầu thủ`);
  const keepers = squad.filter((id) => byId.get(id)!.position === "GK").length;
  check(`${name}: đội có đủ thủ môn`, keepers >= 2, `${keepers} thủ môn`);

  const lineup = buildLineup(squad, byId, shapes, positionName);
  check(`${name}: dựng được đội hình`, lineup !== null);
  if (!lineup) continue;

  check(`${name}: đủ 11 suất`, lineup.slots.length === 11);
  check(
    `${name}: không ai bị xếp hai ô`,
    new Set(lineup.slots.map((s) => s.playerId)).size === 11,
  );
  const gkSlot = lineup.slots.find((s) => positionName(s.positionCode) === "GK");
  check(
    `${name}: ô thủ môn là một thủ môn thật`,
    !!gkSlot && byId.get(gkSlot.playerId)!.position === "GK",
    gkSlot ? byId.get(gkSlot.playerId)!.position : "không có ô thủ môn",
  );
  check(
    `${name}: người đá chính và người còn lại không chồng nhau`,
    lineup.benchIds.every((id) => !lineup.slots.some((s) => s.playerId === id)),
  );
  check(
    `${name}: cả đội được kể hết`,
    lineup.slots.length + lineup.benchIds.length === squad.length,
    `${lineup.slots.length} + ${lineup.benchIds.length} = ${squad.length}`,
  );

  const out = lineup.slots.filter((s) => s.fit === "out").length;
  console.log(
    `       sơ đồ ${lineup.formationName} · ${lineup.exactCount}/11 đúng sở trường · ` +
      `${out} trái vị trí · ${lineup.benchIds.length} người còn lại`,
  );
  seen.push(`${name}: ${lineup.formationName}`);
}

console.log(`\n── sơ đồ theo từng save ──`);
for (const s of seen) console.log(`  ${s}`);

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

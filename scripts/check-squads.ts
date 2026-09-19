/**
 * Kiểm số áo và nhận diện CLB, trên save thật.
 *
 *   npx tsx scripts/check-squads.ts <save…>
 *
 * Phép kiểm quan trọng nhất không phải "có số áo" mà là **asset KHÔNG chứa đội
 * hình xuất phát**. Cột `position` bị cố ý bỏ khỏi file; nếu ai đó thêm lại thì
 * cả lỗi đã gỡ bỏ hôm qua quay lại, và nó quay lại một cách im lặng.
 */
import { readFileSync } from "node:fs";

import { type LineupPlayer, pickSquad } from "../lib/fc26/lineup";
import { Fc26Squads } from "../lib/fc26/squads";
import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodeAllPlayers } from "../lib/save/career/players";
import { positionName } from "../lib/save/career/schema";
import { findSquads } from "../lib/save/career/squad";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const rawJson = readFileSync("public/fc26/squads.json", "utf8");
const payload = JSON.parse(rawJson);
const squads = Fc26Squads.fromPayload(payload);

console.log("── asset ──");
check("có dữ liệu đội", Object.keys(payload.squads ?? {}).length > 100, `${payload.teamCount} đội`);
check("có tên đội", Object.keys(payload.names ?? {}).length > 100);
// Bất biến: đội hình xuất phát KHÔNG được nướng vào đây.
check(
  "KHÔNG chứa mã vị trí (đội hình xuất phát)",
  !("positions" in payload) && !rawJson.includes('"position'),
);

for (const savePath of process.argv.slice(2)) {
  const name = savePath.split(/[\\/]/).pop()!;
  console.log(`\n── ${name} ──`);

  const bytes = new Uint8Array(readFileSync(savePath));
  const loc = locatePlayerTable(bytes);
  if (!loc) {
    check(`${name}: định vị được bảng cầu thủ`, false);
    continue;
  }
  const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);
  const byId = new Map<number, LineupPlayer>(
    decodeAllPlayers(reader, loc.count).map((p) => [
      p.playerId,
      { playerId: p.playerId, position: positionName(p.positionCode), overall: p.overall },
    ]),
  );
  const squad = pickSquad(
    findSquads(bytes, new Set(byId.keys())).map((s) => s.playerIds),
    byId,
  );
  if (!squad) {
    check(`${name}: chọn được khối đội hình`, false);
    continue;
  }

  const club = squads.matchClub(squad);
  if (!club) {
    // CLB tự tạo — không nhận ra được, và đó là hành vi ĐÚNG. Đoán bừa tệ hơn
    // im lặng: ngưỡng cũ 0,4 từng khớp một CLB tự tạo với "AFC Bournemouth"
    // chỉ vì chín cầu thủ trong đội vốn từ đó.
    console.log(`       không nhận ra CLB (${squad.length} cầu thủ) — đúng với CLB tự tạo`);
    check(`${name}: từ chối thay vì đoán bừa`, true);
    continue;
  }
  const covered = squad.filter((id) => club.jerseyOf.has(id)).length;
  console.log(
    `       CLB ${club.teamId} "${club.name}" · ${club.matched}/${club.total} phiếu · ` +
      `${covered}/${squad.length} có số áo`,
  );
  check(`${name}: nhận ra CLB có tên`, !!club.name, club.name ?? "");
  check(`${name}: đa số rõ rệt`, club.matched / club.total >= 0.6);
  check(`${name}: phần lớn có số áo`, covered / squad.length >= 0.6, `${covered}/${squad.length}`);

  const jerseys = squad.map((id) => club.jerseyOf.get(id)).filter((j): j is number => !!j);
  check("số áo không trùng nhau", new Set(jerseys).size === jerseys.length);
  check("số áo nằm trong dải hợp lệ", jerseys.every((j) => j >= 1 && j <= 99));
}

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

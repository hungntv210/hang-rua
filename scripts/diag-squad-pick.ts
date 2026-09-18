/**
 * Khối nào trong save là ĐỘI HÌNH của người chơi?
 *
 *   npx tsx scripts/diag-squad-pick.ts <save…>
 *
 * Trước đây câu hỏi này do bảng team sheet nướng sẵn trả lời: khối nào khớp
 * nhiều cầu thủ nhất với một đội đã biết thì là đội đó. Bỏ bảng nướng sẵn thì
 * mất luôn câu trả lời, nên cần một quy tắc mới suy từ chính save.
 *
 * Script này KHÔNG chọn quy tắc. Nó in ra đặc điểm của từng khối trên nhiều
 * save để quy tắc được chọn từ số liệu chứ không từ phỏng đoán.
 */
import { readFileSync } from "node:fs";

import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodeAllPlayers } from "../lib/save/career/players";
import { findSquads } from "../lib/save/career/squad";
import { positionName } from "../lib/save/career/schema";

const GK = new Set(["GK"]);
const DEF = new Set(["SW", "RB", "RWB", "CB", "RCB", "LCB", "LB", "LWB"]);
const MID = new Set([
  "CDM", "RDM", "LDM", "CM", "RCM", "LCM", "RM", "LM", "CAM", "RAM", "LAM",
]);

for (const savePath of process.argv.slice(2)) {
  console.log(`\n════ ${savePath.split(/[\\/]/).pop()} ════`);
  const bytes = new Uint8Array(readFileSync(savePath));
  const loc = locatePlayerTable(bytes);
  if (!loc) {
    console.log("  không định vị được bảng cầu thủ");
    continue;
  }
  const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);
  const players = decodeAllPlayers(reader, loc.count);
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const squads = findSquads(bytes, new Set(byId.keys()));
  console.log(`  ${squads.length} khối`);

  squads.forEach((s, i) => {
    const ps = s.playerIds.map((id) => byId.get(id)).filter((p) => !!p);
    const pos = ps.map((p) => positionName(p!.positionCode));
    const gk = pos.filter((x) => GK.has(x)).length;
    const def = pos.filter((x) => DEF.has(x)).length;
    const mid = pos.filter((x) => MID.has(x)).length;
    const fw = pos.length - gk - def - mid;
    const ovr = ps.map((p) => p!.overall ?? 0).filter((v) => v > 0);
    const avg = ovr.length ? Math.round(ovr.reduce((a, b) => a + b, 0) / ovr.length) : 0;
    const women = ps.filter((p) => p!.gender === 1).length;
    console.log(
      `  [${i}] offset ${s.offset}  n=${s.playerIds.length}  ` +
        `GK ${gk} · HV ${def} · TV ${mid} · TĐ ${fw}  CS tb ${avg}  nữ ${women}`,
    );
  });
}

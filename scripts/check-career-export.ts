/**
 * Kiểm đường đi "đội hình THẬT từ bản export career", trên dữ liệu thật.
 *
 *   npx tsx scripts/check-career-export.ts <thu-muc-export> <save>
 *
 * Phép kiểm quan trọng nhất ở đây là CỔNG CHẶN THỜI ĐIỂM, và nó cần cả hai
 * phía: một cặp export-save KHỚP phải được chấp nhận, và một cặp LỆCH phải bị
 * từ chối. Chỉ kiểm phía khớp thì một cái cổng luôn trả "được" cũng qua.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  EXPORT_FILES,
  parseCareerExport,
  gateSheets,
  validateAgainstSave,
  type CareerExport,
} from "../lib/fc26/career-export";
import {
  buildLineup,
  lineupFromSheets,
  type FormationShape,
  type LineupPlayer,
} from "../lib/fc26/lineup";
import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodeAllPlayers } from "../lib/save/career/players";
import { positionName } from "../lib/save/career/schema";
import { findSquads } from "../lib/save/career/squad";

const [dir, savePath] = process.argv.slice(2);
if (!dir || !savePath) {
  console.error("dùng: npx tsx scripts/check-career-export.ts <thu-muc-export> <save>");
  process.exit(1);
}

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

// ── Nạp export ──────────────────────────────────────────────────────────────
const files = new Map<string, string>();
for (const name of Object.values(EXPORT_FILES)) {
  const p = join(dir, name);
  if (existsSync(p)) files.set(name.toLowerCase(), readFileSync(p, "utf8"));
}
console.log(`── nạp ${files.size}/${Object.values(EXPORT_FILES).length} file export ──`);

const parsed = parseCareerExport(files);
check("đọc được bản export", parsed.ok, parsed.ok ? "" : parsed.reason);
if (!parsed.ok) process.exit(1);
const data: CareerExport = parsed.data;
console.log(
  `       CLB ${data.clubTeamId} · ${data.sheets.length} team sheet · ` +
    `${data.jerseyOf.size} số áo · ${data.wageOf.size} mức lương`,
);
check("đọc được mã CLB của người chơi", data.clubTeamId > 0, String(data.clubTeamId));
check("có số áo", data.jerseyOf.size >= 11, `${data.jerseyOf.size}`);

// ── Nạp save ────────────────────────────────────────────────────────────────
const bytes = new Uint8Array(readFileSync(savePath));
const loc = locatePlayerTable(bytes);
if (!loc) {
  check("định vị được bảng cầu thủ", false);
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
const candidates = findSquads(bytes, new Set(byId.keys())).map((s) => s.playerIds);
check("tìm được khối đội hình trong save", candidates.length > 0, `${candidates.length} khối`);

// ── Cổng chặn: cặp KHỚP phải được chấp nhận ─────────────────────────────────
console.log("\n── cổng chặn thời điểm ──");
let chosen: { squad: number[]; passed: ReturnType<typeof gateSheets> } | null = null;
for (const squad of candidates) {
  const passed = gateSheets(data, new Set(squad));
  if (passed.length > 0) {
    chosen = { squad, passed };
    break;
  }
}
check("cặp export-save KHỚP được chấp nhận", chosen !== null);
if (!chosen) process.exit(1);
console.log(
  `       ${chosen.passed.length} sheet qua cổng: ` +
    chosen.passed.map((p) => `"${p.sheet.name}" (${p.gate.matched}/${p.gate.total})`).join(", "),
);

// ── Cổng chặn: cặp LỆCH phải bị từ chối ─────────────────────────────────────
// Không có save lệch thời điểm sẵn thì dựng một cái: bỏ đi một nửa đội hình,
// đúng như khi người chơi bán vài cầu thủ rồi mới lưu game.
{
  const half = new Set(chosen.squad.slice(0, Math.floor(chosen.squad.length / 2)));
  const gate = validateAgainstSave(chosen.passed[0].sheet, half);
  check("cặp LỆCH bị từ chối", !gate.ok, gate.message.slice(0, 60));
}
{
  const gate = validateAgainstSave(chosen.passed[0].sheet, new Set<number>());
  check("save không có cầu thủ nào thì từ chối", !gate.ok);
}

// ── Dựng đội hình thật ──────────────────────────────────────────────────────
console.log("\n── đội hình thật từ team sheet ──");
const shapes: FormationShape[] = JSON.parse(
  readFileSync("public/fc26/formations.json", "utf8"),
).formations;

const built = lineupFromSheets(
  chosen.passed.map((p) => p.sheet),
  chosen.squad,
  byId,
  data.slotCodeOf,
  shapes,
  positionName,
);
check("dựng được đội hình thật", built !== null, built ? `sheet "${built.sheetName}"` : "");
if (built) {
  const real = built.lineup;
  const xi = chosen.passed.find((p) => p.sheet.name === built.sheetName)!.sheet.slots.slice(0, 11);
  check("đủ 11 suất", real.slots.length === 11);
  check("không ai bị xếp hai ô", new Set(real.slots.map((s) => s.playerId)).size === 11);
  check(
    "đúng 11 người của team sheet, không thay ai",
    real.slots.every((s) => xi.includes(s.playerId)),
  );
  const gk = real.slots.find((s) => positionName(s.positionCode) === "GK");
  check(
    "ô thủ môn là thủ môn thật",
    !!gk && byId.get(gk.playerId)!.position === "GK",
    gk ? byId.get(gk.playerId)!.position : "—",
  );
  check(
    "người đá chính không lặp ở danh sách còn lại",
    real.benchIds.every((id) => !real.slots.some((s) => s.playerId === id)),
  );
  console.log(
    `       sơ đồ ${real.formationName} · ${real.exactCount}/11 đúng sở trường · ` +
      `${real.benchIds.length} người còn lại`,
  );

  // Đội hình thật phải KHÁC đội hình gợi ý — nếu giống hệt thì hoặc là trùng
  // hợp, hoặc là đường đi mới chưa thực sự được dùng.
  const guess = buildLineup(chosen.squad, byId, shapes, positionName);
  if (guess) {
    const a = real.slots.map((s) => s.playerId).join(",");
    const b = guess.slots.map((s) => s.playerId).join(",");
    console.log(`       gợi ý sẽ là ${guess.formationName}; ${a === b ? "TRÙNG" : "khác"} đội hình thật`);
  }
}

// ── Lương ───────────────────────────────────────────────────────────────────
if (data.wageOf.size > 0) {
  console.log("\n── lương ──");
  const inSquad = chosen.squad.filter((id) => data.wageOf.has(id)).length;
  check("lương gắn được vào cầu thủ trong đội", inSquad > 0, `${inSquad}/${chosen.squad.length}`);
}

// ── Từ chối bản export chạy ngoài career ────────────────────────────────────
console.log("\n── bản export hỏng phải bị từ chối ──");
check("thiếu file thì từ chối", !parseCareerExport(new Map()).ok);
{
  const broken = new Map(files);
  broken.set(EXPORT_FILES.users.toLowerCase(), "clubteamid\n");
  const r = parseCareerExport(broken);
  check("career_users rỗng thì từ chối", !r.ok, r.ok ? "" : r.reason.slice(0, 50));
}
{
  const broken = new Map(files);
  broken.set(EXPORT_FILES.links.toLowerCase(), "playerid,teamid,jerseynumber,position\n1,99,7,0\n");
  const r = parseCareerExport(broken);
  check(
    "teamplayerlinks không có đội của mình thì từ chối",
    !r.ok,
    r.ok ? "" : r.reason.slice(0, 50),
  );
}

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

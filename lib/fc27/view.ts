/**
 * Chuyển `Fc27Career` sang kiểu dữ liệu giao diện dùng chung (`SavePlayer`,
 * `Lineup`) để dùng lại component FC26 như `Pitch`.
 *
 * Khác FC26 ở ý nghĩa, không ở hình dạng: `club` ở đây là CLB HIỆN TẠI đọc từ
 * save, `potential` là dynamic potential tại thời điểm lưu, đội hình là thật.
 */

import { fitOf } from "../fc26/positions";
import type { Lineup } from "../fc26/lineup";
import { positionName } from "../save/career/schema";
import type { SavePlayer } from "../save/types";
import type { Fc27Names } from "./names";
import type { Fc27Career } from "./read";

/** Ngày DB (gốc 1582-10-14) → ngày Unix: 141.428. */
const DB_TO_UNIX_DAYS = 141_428;
const isoOf = (dbDay: number): string | null =>
  dbDay > 0 ? new Date((dbDay - DB_TO_UNIX_DAYS) * 86_400_000).toISOString().slice(0, 10) : null;

export function toSavePlayers(c: Fc27Career, names: Fc27Names, nations: Record<string, string>): SavePlayer[] {
  const teams = new Map(c.teams);
  const nationNames = new Set(Object.values(nations));
  const clubOf = new Map<number, string>();
  for (const l of c.links) {
    const name = teams.get(l.teamId);
    // Tên bắt đầu bằng "*" là khoá dịch chưa thay chữ (đội trẻ, đội dự bị), không phải tên CLB.
    if (name && !name.startsWith("*") && !nationNames.has(name) && !clubOf.has(l.playerId)) clubOf.set(l.playerId, name);
  }

  return c.players.map((p) => {
    const n = names.nameOf(p);
    return {
      playerId: p.id,
      name: n.source === "bridge" ? `≈ ${n.name}` : n.name,
      nameSource: n.source === "exact" ? "database" : n.source === "bridge" ? "namePool" : null,
      club: clubOf.get(p.id) ?? null,
      league: null,
      nation: nations[String(p.nationalityId)] ?? null,
      position: positionName(p.positionCode),
      overall: p.overall,
      potential: p.potential,
      birthDate: isoOf(p.birthDay),
      age: p.birthDay > 0 && c.refDay > 0 ? Math.floor((c.refDay - p.birthDay) / 365.25) : null,
      heightCm: null,
      weightKg: null,
      skillMoves: null,
      weakFoot: null,
      internationalReputation: null,
      nationalityId: p.nationalityId,
      firstNameId: p.firstNameId,
      lastNameId: p.lastNameId,
      commonNameId: p.commonNameId,
      gender: p.gender,
      contractUntil: null,
      joinedDate: isoOf(p.joinedDay),
      valueEstimate: null,
      attributes: [],
    };
  });
}

export function toLineup(c: Fc27Career): Lineup | null {
  if (!c.lineup) return null;
  const byId = new Map(c.players.map((p) => [p.id, p]));
  const slots = c.lineup.slots.map((s) => ({
    x: s.x,
    y: s.y,
    positionCode: s.positionCode,
    playerId: s.playerId,
    fit: fitOf(positionName(byId.get(s.playerId)?.positionCode ?? null), positionName(s.positionCode)),
  }));
  const xi = new Set(slots.map((s) => s.playerId));
  const squadIds = c.squad.map((l) => l.playerId);
  return {
    source: "export",
    formationIsReal: true,
    sheetName: c.lineup.sheetName,
    formationName: c.lineup.formationName ?? "?",
    slots,
    benchIds: squadIds.filter((id) => !xi.has(id)).sort((a, b) => (byId.get(b)?.overall ?? 0) - (byId.get(a)?.overall ?? 0)),
    squadIds,
    exactCount: slots.filter((s) => s.fit === "exact").length,
  };
}

/**
 * Nhóm cầu thủ cho tab Scout: bỏ nhánh nữ (giống FC26) và bỏ người của chính CLB —
 * cả đội một lẫn học viện, vốn đã có tab riêng.
 */
export function scoutPool(players: SavePlayer[], c: Fc27Career): SavePlayer[] {
  const mine = new Set([...c.squad.map((l) => l.playerId), ...c.youthIds]);
  return players.filter((p) => p.gender === 0 && !mine.has(p.playerId));
}

/**
 * Ghép toàn bộ dữ liệu một save FC27 thành `Fc27Career` (object thuần).
 *
 * Mỗi tab đọc trong một khối riêng: thiếu một bảng hay một mã trường chỉ làm
 * hỏng tab phụ thuộc nó, kèm tên thứ bị thiếu — không bao giờ lùi về đoán.
 * Chỉ ném `Fc27FormatError`; mọi lỗi khác thành `errors[tab]`.
 */

import { Fc27FormatError, unpackSave } from "./container";
import { openDatabases, readFloat, type DbTable } from "./fifadb";
import { readLinks, readPlayers, readTeams, tableReader, type Link, type RawPlayer } from "./read-tables";
import { FC27, type Fc27Schema } from "./schema";
import { readLoans, readSectionIndex, type LoanRecord } from "./sections";

export type Tab = "squad" | "youth" | "loans" | "scout";

export interface LineupRead {
  sheetName: string;
  formationName: string | null;
  captainId: number | null;
  slots: { playerId: number; positionCode: number; x: number; y: number }[];
}

export interface Fc27Loan extends LoanRecord {
  atTeamId: number | null;
  atTeamName: string | null;
}

export interface Fc27Career {
  club: { teamId: number; name: string } | null;
  lineup: LineupRead | null;
  squad: Link[];
  youthIds: number[];
  loans: Fc27Loan[];
  players: RawPlayer[];
  teams: [number, string][];
  links: Link[];
  /** Ngày gia nhập CLB muộn nhất toàn bảng — mốc tính tuổi (ngày hiện tại ≥ mốc). */
  refDay: number;
  errors: Partial<Record<Tab, string>>;
  warnings: Partial<Record<Tab, string[]>>;
  timings: { unzipMs: number; readMs: number };
}

export interface ReadOptions {
  /** Tên quốc gia: đội mang tên quốc gia là đội tuyển, không phải CLB. */
  nationNames?: Set<string>;
  /** Chỉ để kiểm; mặc định FC27. */
  schema?: Fc27Schema;
}

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Chỉ số dòng team sheet của CLB người chơi; `null` khi không chắc — KHÔNG đoán.
 *
 * Một dòng duy nhất là của người chơi. Nhiều dòng (CLB + đội tuyển) thì bỏ dòng
 * mang tên quốc gia và phải còn đúng một; không có danh sách quốc gia thì không
 * phân biệt được, nên cũng trả `null`.
 */
export function pickClubRow(rows: { teamId: number; name: string }[], nationNames: Set<string>): number | null {
  if (rows.length === 1) return rows[0].name !== "" ? 0 : null;
  if (nationNames.size === 0) return null;
  const clubs = rows.flatMap((r, i) => (r.name !== "" && !nationNames.has(r.name) ? [i] : []));
  return clubs.length === 1 ? clubs[0] : null;
}

const shapeKey = (xs: number[], ys: number[]): string =>
  xs.map((x, i) => `${x.toFixed(3)},${ys[i].toFixed(3)}`).sort().join("|");

export function readFc27(raw: Uint8Array, options: ReadOptions = {}): Fc27Career {
  const t0 = now();
  const blob = unpackSave(raw);
  return buildCareer(raw, blob, options, Math.round(now() - t0));
}

export function buildCareer(raw: Uint8Array, blob: Uint8Array, options: ReadOptions = {}, unzipMs = 0): Fc27Career {
  const t0 = now();
  const s = options.schema ?? FC27;
  const nations = options.nationNames ?? new Set<string>();
  const tables = openDatabases(blob);
  if (tables.length === 0) throw new Fc27FormatError();

  const errors: Fc27Career["errors"] = {};
  const warnings: Fc27Career["warnings"] = {};
  const warn = (tab: Tab, text: string): void => {
    (warnings[tab] ??= []).push(text);
  };

  const career: Fc27Career = {
    club: null, lineup: null, squad: [], youthIds: [], loans: [],
    players: [], teams: [], links: [], refDay: 0, errors, warnings, timings: { unzipMs, readMs: 0 },
  };

  let players = new Map<number, RawPlayer>();
  let teams = new Map<number, string>();
  try {
    const missing: string[] = [];
    players = readPlayers(blob, tables, s, missing);
    if (missing.length > 0) {
      warn("scout", `Save thiếu trường ${missing.join(", ")} trong bảng ${s.players.table} — các cột liên quan để trống.`);
    }
    teams = readTeams(blob, tables, s);
    career.links = readLinks(blob, tables, s);
  } catch (e) {
    for (const tab of ["squad", "youth", "loans", "scout"] as Tab[]) errors[tab] = message(e);
    career.timings.readMs = Math.round(now() - t0);
    return career;
  }
  career.players = [...players.values()];
  career.teams = [...teams];
  career.refDay = career.players.reduce((m, p) => Math.max(m, p.joinedDay ?? 0), 0);
  if (career.players.some((p) => p.potential < p.overall)) warn("scout", "Có cầu thủ POT thấp hơn OVR — dữ liệu có thể đọc lệch.");

  try {
    career.club = readClub(blob, tables, s, teams, nations);
  } catch (e) {
    for (const tab of ["squad", "youth", "loans"] as Tab[]) errors[tab] = message(e);
  }
  const club = career.club;

  if (club) {
    career.squad = career.links.filter((l) => l.teamId === club.teamId);
    try {
      career.lineup = readLineup(blob, tables, s, club.teamId);
      const squadIds = new Set(career.squad.map((l) => l.playerId));
      const xi = career.lineup.slots.map((x) => x.playerId);
      if (xi.some((id) => !squadIds.has(id)) || new Set(xi).size !== xi.length) {
        warn("squad", "Đội hình ra sân có người không thuộc đội hoặc bị lặp.");
      }
      if (career.lineup.formationName === null) warn("squad", "Không xác định được tên sơ đồ từ toạ độ.");
    } catch (e) {
      errors.squad = message(e);
    }

    try {
      career.youthIds = readYouth(blob, tables, s);
      if (career.youthIds.some((id) => !players.has(id))) warn("youth", "Có cầu thủ học viện không tìm thấy trong bảng cầu thủ.");
    } catch (e) {
      errors.youth = message(e);
    }

    try {
      career.loans = readClubLoans(raw, blob, club.teamId, career.links, teams, nations);
      if (career.loans.some((l) => l.atTeamId === null)) warn("loans", "Có cầu thủ cho mượn không rõ CLB đang mượn.");
    } catch (e) {
      errors.loans = message(e);
    }
  }

  career.timings.readMs = Math.round(now() - t0);
  return career;
}

function readClub(
  blob: Uint8Array, tables: DbTable[], s: Fc27Schema, teams: Map<number, string>, nations: Set<string>,
): { teamId: number; name: string } {
  const r = tableReader(blob, tables, s.teamsheets.table);
  const rows = Array.from({ length: r.table.nValid }, (_, i) => {
    const teamId = r.int(i, s.teamsheets.teamId);
    return { teamId, name: teams.get(teamId) ?? "" };
  });
  const i = pickClubRow(rows, nations);
  if (i === null) throw new Error("Không xác định được CLB người chơi (save có nhiều team sheet mà không phân biệt được CLB với đội tuyển).");
  return rows[i];
}

function readLineup(blob: Uint8Array, tables: DbTable[], s: Fc27Schema, teamId: number): LineupRead {
  const ts = tableReader(blob, tables, s.teamsheets.table);
  const row = Array.from({ length: ts.table.nValid }, (_, i) => i).find((i) => ts.int(i, s.teamsheets.teamId) === teamId);
  if (row === undefined) throw new Error("Không tìm thấy team sheet của CLB.");
  const ids = s.teamsheets.slots.map((spec) => ts.int(row, spec));
  if (ids.some((id) => id < 0)) throw new Error("Team sheet thiếu cầu thủ ở đội hình ra sân.");
  const captain = ts.int(row, s.teamsheets.captain);

  const sh = tableReader(blob, tables, s.sheetShape.table);
  const shapeRow = Array.from({ length: sh.table.nValid }, (_, i) => i).find((i) => sh.int(i, s.sheetShape.teamId) === teamId);
  if (shapeRow === undefined) throw new Error("Không tìm thấy sơ đồ của team sheet.");
  const coord = (codes: string[]): number[] => codes.map((c) => readFloat(blob, sh.table, shapeRow, sh.field(c)));
  const xs = coord(s.offsetX);
  const ys = coord(s.offsetY);

  return {
    sheetName: ts.str(row, s.teamsheets.name),
    formationName: formationName(blob, tables, s, shapeKey(xs, ys)),
    captainId: captain >= 0 ? captain : null,
    slots: ids.map((playerId, i) => ({
      playerId,
      positionCode: sh.int(shapeRow, s.sheetShape.positions[i]),
      x: xs[i],
      y: ys[i],
    })),
  };
}

/** Tên sơ đồ có cùng tập toạ độ trong bảng formations của chính save; phải duy nhất. */
function formationName(blob: Uint8Array, tables: DbTable[], s: Fc27Schema, key: string): string | null {
  const f = tableReader(blob, tables, s.formations.table);
  const names = new Set<string>();
  for (let i = 0; i < f.table.nValid; i += 1) {
    const xs = s.offsetX.map((c) => readFloat(blob, f.table, i, f.field(c)));
    const ys = s.offsetY.map((c) => readFloat(blob, f.table, i, f.field(c)));
    if (shapeKey(xs, ys) === key) names.add(f.str(i, s.formations.name));
  }
  return names.size === 1 ? [...names][0] : null;
}

function readYouth(blob: Uint8Array, tables: DbTable[], s: Fc27Schema): number[] {
  const r = tableReader(blob, tables, s.youth.table);
  return Array.from({ length: r.table.nValid }, (_, i) => r.int(i, s.youth.playerId));
}

function readClubLoans(
  raw: Uint8Array, blob: Uint8Array, teamId: number, links: Link[], teams: Map<number, string>, nations: Set<string>,
): Fc27Loan[] {
  const all = readLoans(blob, readSectionIndex(raw, blob));
  return all
    .filter((l) => l.ownerTeamId === teamId)
    .map((l) => {
      const at = links.find(
        (k) => k.playerId === l.playerId && k.teamId !== teamId && !nations.has(teams.get(k.teamId) ?? ""),
      );
      return { ...l, atTeamId: at?.teamId ?? null, atTeamName: at ? teams.get(at.teamId) ?? null : null };
    });
}

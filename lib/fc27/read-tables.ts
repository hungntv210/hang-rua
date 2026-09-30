/**
 * Đọc các bảng thế giới (players, teams, teamplayerlinks) qua `schema.ts`.
 */

import { findTable, readInt, readString, type DbField, type DbTable } from "./fifadb";
import { FC27, type FieldSpec, type Fc27Schema } from "./schema";

export interface RawPlayer {
  id: number;
  overall: number;
  potential: number;
  positionCode: number;
  birthDay: number;
  joinedDay: number | null;
  nationalityId: number | null;
  firstNameId: number | null;
  lastNameId: number | null;
  commonNameId: number | null;
  /** 0 nam, 1 nữ. */
  gender: number | null;
}

export interface Link {
  playerId: number;
  teamId: number;
  jersey: number;
}

export class MissingSchemaError extends Error {
  constructor(table: string, field?: string) {
    super(field ? `Save thiếu trường ${field} trong bảng ${table}.` : `Save thiếu bảng ${table}.`);
    this.name = "MissingSchemaError";
  }
}

/** Mở một bảng và trả về hàm đọc theo `FieldSpec`; thiếu thứ gì thì ném ngay. */
export function tableReader(blob: Uint8Array, tables: DbTable[], name: string) {
  const t = findTable(tables, name);
  if (!t) throw new MissingSchemaError(name);
  const field = (spec: FieldSpec | string): DbField => {
    const code = typeof spec === "string" ? spec : spec.code;
    const fld = t.fields.get(code);
    if (!fld) throw new MissingSchemaError(name, code);
    return fld;
  };
  return {
    table: t,
    field,
    int: (row: number, spec: FieldSpec): number => readInt(blob, t, row, field(spec)) + spec.add,
    /** Trường phụ: thiếu thì `null` thay vì ném. */
    has: (spec: FieldSpec): boolean => t.fields.has(spec.code),
    str: (row: number, spec: FieldSpec): string => readString(blob, t, row, field(spec)),
  };
}

/**
 * id, OVR, POT, vị trí, ngày sinh là bắt buộc (thiếu thì ném). Các trường còn lại
 * là phụ: title update bỏ một trường phụ thì cột đó để trống và mã thiếu được
 * đẩy vào `missing`, thay vì làm sập mọi tab.
 */
export function readPlayers(
  blob: Uint8Array, tables: DbTable[], s: Fc27Schema = FC27, missing: string[] = [],
): Map<number, RawPlayer> {
  const p = s.players;
  const r = tableReader(blob, tables, p.table);
  for (const spec of [p.id, p.overall, p.potential, p.position, p.birthDay]) r.field(spec);
  const optional = [p.joinedDay, p.nationality, p.firstNameId, p.lastNameId, p.commonNameId, p.gender];
  for (const spec of optional) if (!r.has(spec)) missing.push(spec.code);
  const opt = (row: number, spec: FieldSpec): number | null => (r.has(spec) ? r.int(row, spec) : null);
  const out = new Map<number, RawPlayer>();
  for (let i = 0; i < r.table.nValid; i += 1) {
    const id = r.int(i, p.id);
    out.set(id, {
      id,
      overall: r.int(i, p.overall),
      potential: r.int(i, p.potential),
      positionCode: r.int(i, p.position),
      birthDay: r.int(i, p.birthDay),
      joinedDay: opt(i, p.joinedDay),
      nationalityId: opt(i, p.nationality),
      firstNameId: opt(i, p.firstNameId),
      lastNameId: opt(i, p.lastNameId),
      commonNameId: opt(i, p.commonNameId),
      gender: opt(i, p.gender),
    });
  }
  return out;
}

export function readTeams(blob: Uint8Array, tables: DbTable[], s: Fc27Schema = FC27): Map<number, string> {
  const r = tableReader(blob, tables, s.teams.table);
  const out = new Map<number, string>();
  for (let i = 0; i < r.table.nValid; i += 1) out.set(r.int(i, s.teams.teamId), r.str(i, s.teams.name));
  return out;
}

export function readLinks(blob: Uint8Array, tables: DbTable[], s: Fc27Schema = FC27): Link[] {
  const l = s.links;
  const r = tableReader(blob, tables, l.table);
  const out: Link[] = [];
  for (let i = 0; i < r.table.nValid; i += 1) {
    out.push({ playerId: r.int(i, l.playerId), teamId: r.int(i, l.teamId), jersey: r.int(i, l.jersey) });
  }
  return out;
}

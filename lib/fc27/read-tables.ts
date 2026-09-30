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
  joinedDay: number;
  nationalityId: number;
  firstNameId: number;
  lastNameId: number;
  commonNameId: number;
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
    str: (row: number, spec: FieldSpec): string => readString(blob, t, row, field(spec)),
  };
}

export function readPlayers(blob: Uint8Array, tables: DbTable[], s: Fc27Schema = FC27): Map<number, RawPlayer> {
  const p = s.players;
  const r = tableReader(blob, tables, p.table);
  const out = new Map<number, RawPlayer>();
  for (let i = 0; i < r.table.nValid; i += 1) {
    const id = r.int(i, p.id);
    out.set(id, {
      id,
      overall: r.int(i, p.overall),
      potential: r.int(i, p.potential),
      positionCode: r.int(i, p.position),
      birthDay: r.int(i, p.birthDay),
      joinedDay: r.int(i, p.joinedDay),
      nationalityId: r.int(i, p.nationality),
      firstNameId: r.int(i, p.firstNameId),
      lastNameId: r.int(i, p.lastNameId),
      commonNameId: r.int(i, p.commonNameId),
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

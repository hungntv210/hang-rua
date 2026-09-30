/**
 * Bộ đọc FIFA DB (`DB\0\x08`) tổng quát.
 *
 * Save Career của EA (cả FC26 lẫn FC27) chứa cơ sở dữ liệu tự mô tả: mỗi bảng
 * mang bộ mô tả trường `[kiểu][bit offset][mã 4 ký tự][độ rộng]`. File này chỉ
 * đọc cấu trúc đó, KHÔNG biết mã nào nghĩa là gì — nghĩa nằm ở `schema.ts`.
 *
 * Đọc theo cột, không dựng bản ghi: trang chỉ cần vài chục trong hơn một trăm
 * trường của bảng cầu thủ.
 */

export interface DbField {
  /** 0 chuỗi, 3 số nguyên LSB-first, 4 float32. */
  type: number;
  bit: number;
  name: string;
  width: number;
}

export interface DbTable {
  name: string;
  recordSize: number;
  nRecords: number;
  nValid: number;
  fields: Map<string, DbField>;
  dataOffset: number;
}

const SIG = [0x44, 0x42, 0x00, 0x08];

const u16 = (b: Uint8Array, o: number): number => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number): number =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const tag = (b: Uint8Array, o: number): string =>
  String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

function signatures(blob: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i + 4 <= blob.length; i += 1) {
    if (blob[i] === SIG[0] && blob[i + 1] === SIG[1] && blob[i + 2] === SIG[2] && blob[i + 3] === SIG[3]) {
      out.push(i);
    }
  }
  return out;
}

export function firstDbOffset(blob: Uint8Array): number {
  return signatures(blob)[0] ?? -1;
}

function parseDb(blob: Uint8Array, at: number): DbTable[] {
  const nTables = u32(blob, at + 16);
  // Chuỗi 4 byte trùng chữ ký nằm lẫn trong dữ liệu: bộ đếm bảng vô lý thì bỏ.
  if (nTables === 0 || nTables > 512) return [];
  const listEnd = at + 24 + nTables * 8;
  const dataStart = listEnd + 4; // CRC của danh sách bảng
  if (dataStart > blob.length) return [];

  const tables: DbTable[] = [];
  for (let i = 0; i < nTables; i += 1) {
    const entry = at + 24 + i * 8;
    const h = dataStart + u32(blob, entry + 4);
    if (h + 36 > blob.length) return [];
    const nFields = blob[h + 24];
    const fields = new Map<string, DbField>();
    let f = h + 36;
    for (let k = 0; k < nFields; k += 1, f += 16) {
      const field = { type: u32(blob, f), bit: u32(blob, f + 4), name: tag(blob, f + 8), width: u32(blob, f + 12) };
      fields.set(field.name, field);
    }
    tables.push({
      name: tag(blob, entry),
      recordSize: u32(blob, h + 4),
      nRecords: u16(blob, h + 16),
      nValid: u16(blob, h + 18),
      fields,
      dataOffset: f,
    });
  }
  return tables;
}

export function openDatabases(blob: Uint8Array): DbTable[] {
  return signatures(blob).flatMap((at) => parseDb(blob, at));
}

export function findTable(tables: DbTable[], name: string): DbTable | null {
  return tables.find((t) => t.name === name) ?? null;
}

function rawBits(blob: Uint8Array, t: DbTable, row: number, f: DbField): number {
  const start = (t.dataOffset + row * t.recordSize) * 8 + f.bit;
  let v = 0;
  for (let i = 0; i < f.width; i += 1) {
    const x = start + i;
    v += ((blob[x >> 3] >> (x & 7)) & 1) * 2 ** i;
  }
  return v;
}

export function readInt(blob: Uint8Array, t: DbTable, row: number, f: DbField): number {
  return rawBits(blob, t, row, f);
}

const f32 = new DataView(new ArrayBuffer(4));
export function readFloat(blob: Uint8Array, t: DbTable, row: number, f: DbField): number {
  f32.setUint32(0, rawBits(blob, t, row, f), true);
  return f32.getFloat32(0, true);
}

const utf8 = new TextDecoder("utf-8", { fatal: false });
export function readString(blob: Uint8Array, t: DbTable, row: number, f: DbField): string {
  const s = t.dataOffset + row * t.recordSize + (f.bit >> 3);
  const lim = s + (f.width >> 3);
  let e = s;
  while (e < lim && blob[e] !== 0) e += 1;
  return utf8.decode(blob.subarray(s, e));
}

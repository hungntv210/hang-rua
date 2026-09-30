/**
 * Khối career NGOÀI FIFA DB.
 *
 * FC27 bỏ vài bảng career khỏi FIFA DB (playerloans, career_users…) và lưu chúng
 * thành các khối có tag 4 chữ thường. Vỏ ngoài có mục lục `[tag][u32]`; giá trị
 * lệch một hằng số Δ so với offset thật trong blob. Δ không hard-code: neo vào
 * tag của khối chứa FIFA DB, vốn trỏ tới 4 byte trước chữ ký DB đầu tiên.
 */

import { zstdFrameOffset } from "./container";
import { firstDbOffset } from "./fifadb";
import { FC27 } from "./schema";

export interface LoanRecord {
  playerId: number;
  ownerTeamId: number;
  /** YYYY-MM-DD */
  until: string;
}

const TOC_START = 0x4aa;
const LOAN_RECORD = 20;

const u32 = (b: Uint8Array, o: number): number =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const isLower = (c: number): boolean => c >= 0x61 && c <= 0x7a;

function rawToc(raw: Uint8Array): Map<string, number> {
  const end = zstdFrameOffset(raw);
  const out = new Map<string, number>();
  for (let o = TOC_START; o + 8 <= end; ) {
    if (isLower(raw[o]) && isLower(raw[o + 1]) && isLower(raw[o + 2]) && isLower(raw[o + 3])) {
      const tag = String.fromCharCode(raw[o], raw[o + 1], raw[o + 2], raw[o + 3]);
      if (!out.has(tag)) out.set(tag, u32(raw, o + 4));
      o += 8;
    } else {
      o += 1;
    }
  }
  return out;
}

/** Δ giữa giá trị mục lục và offset trong blob; ném khi không neo được. */
export function sectionDelta(raw: Uint8Array, blob: Uint8Array): number {
  const anchor = rawToc(raw).get(FC27.sections.dbAnchorTag);
  const db = firstDbOffset(blob);
  if (anchor === undefined || db < 4) throw new Error("Không định vị được mục lục khối career.");
  return anchor - (db - 4);
}

export function readSectionIndex(raw: Uint8Array, blob: Uint8Array): Map<string, number> {
  const delta = sectionDelta(raw, blob);
  const out = new Map<string, number>();
  for (const [tag, value] of rawToc(raw)) out.set(tag, value - delta);
  return out;
}

const iso = (yyyymmdd: number): string => {
  const s = String(yyyymmdd).padStart(8, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};

export function readLoans(blob: Uint8Array, index: Map<string, number>): LoanRecord[] {
  const tag = FC27.sections.loans;
  const at = index.get(tag);
  if (at === undefined) throw new Error(`Save thiếu khối ${tag}.`);
  const name = String.fromCharCode(blob[at + 5], blob[at + 6], blob[at + 7], blob[at + 8]);
  if (blob[at] !== 1 || u32(blob, at + 1) !== 4 || name !== tag) {
    throw new Error(`Khối ${tag} sai định dạng.`);
  }
  // 16 byte header sau tag; u32 cuối header là số mục.
  const count = u32(blob, at + 9 + 12);
  const out: LoanRecord[] = [];
  let o = at + 9 + 16;
  for (let i = 0; i < count; i += 1, o += LOAN_RECORD) {
    if (o + LOAN_RECORD > blob.length || blob[o] !== 1 || blob[o + 9] !== 1 || blob[o + 19] !== 0xff) {
      throw new Error(`Khối ${tag} sai định dạng ở mục ${i + 1}.`);
    }
    out.push({ playerId: u32(blob, o + 1), ownerTeamId: u32(blob, o + 5), until: iso(u32(blob, o + 10)) });
  }
  return out;
}

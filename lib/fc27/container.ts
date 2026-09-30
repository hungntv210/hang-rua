/**
 * Vỏ ngoài save FC27: FBCHUNKS + một khung zstd.
 *
 * FC26 không nén, FC27 nén toàn bộ blob career. 16 byte ngay trước khung là
 * `[u32 cỡ giải nén][0][u32 cỡ nén][0]` — cỡ khai báo được dùng làm phép kiểm:
 * giải nén ra kích thước khác nghĩa là đọc nhầm khung, không phải file lạ.
 */

import { decompress } from "fzstd";

export const NOT_FC27 = "Không phải save Career FC27.";

export class Fc27FormatError extends Error {
  constructor(message = NOT_FC27) {
    super(message);
    this.name = "Fc27FormatError";
  }
}

const MAGIC = [0x46, 0x42, 0x43, 0x48, 0x55, 0x4e, 0x4b, 0x53]; // "FBCHUNKS"
const ZSTD = [0x28, 0xb5, 0x2f, 0xfd];

function indexOf(bytes: Uint8Array, pat: number[], from: number): number {
  outer: for (let i = from; i + pat.length <= bytes.length; i += 1) {
    for (let j = 0; j < pat.length; j += 1) if (bytes[i + j] !== pat[j]) continue outer;
    return i;
  }
  return -1;
}

const u32 = (b: Uint8Array, o: number): number =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Vị trí khung zstd trong vỏ ngoài, -1 nếu không có. */
export function zstdFrameOffset(raw: Uint8Array): number {
  if (MAGIC.some((c, i) => raw[i] !== c)) return -1;
  const at = indexOf(raw, ZSTD, MAGIC.length);
  return at >= 16 ? at : -1;
}

export function unpackSave(raw: Uint8Array): Uint8Array {
  const at = zstdFrameOffset(raw);
  if (at < 0) throw new Fc27FormatError();
  const declared = u32(raw, at - 16);
  const packed = u32(raw, at - 8);
  if (declared === 0 || packed === 0) throw new Fc27FormatError();

  let out: Uint8Array;
  try {
    out = decompress(raw.subarray(at, at + packed));
  } catch {
    throw new Error("File save bị cụt hoặc hỏng.");
  }
  if (out.length !== declared) throw new Error("File save bị cụt hoặc hỏng.");
  return out;
}

/**
 * Tên cầu thủ do career sinh ra (newgen / lứa học viện).
 *
 * Đây là nhóm KHÔNG có trong bất kỳ dataset ngoài nào — họ chưa tồn tại lúc game
 * phát hành — nên tên của họ chỉ có thể lấy từ chính file save.
 *
 * Bố cục bản ghi, 184 byte: `[4 ô × 45 byte NUL-pad][u32 playerId]`.
 * Khoá đứng **SAU** dữ liệu. Chiều này phản trực giác; đọc theo chiều quen thuộc
 * (khoá trước) khiến mọi tên lệch đúng một bản ghi, và lỗi đó chỉ lộ ra khi đối
 * chiếu với giá trị thật trong game.
 *
 * Ô 0 = tên, ô 1 = thường rỗng, ô 2 = họ, ô 3 = tên trên áo.
 */

import {
  NEWGEN_NAME_RECORD_BYTES as REC,
  NEWGEN_NAME_SLOTS,
  NEWGEN_NAME_SLOT_BYTES as SLOT,
} from "./schema";

const MAX_PLAYER_ID = 2_000_000;
/** Bảng này nhỏ (vài chục bản ghi). Trần để một file lạ không kéo dài vô hạn. */
const MAX_RECORDS = 20_000;

const decoder = new TextDecoder("utf-8", { fatal: false });

/**
 * Đọc một ô tên. Ô có thể bắt đầu bằng byte nối UTF-8 do chuỗi trước bị cắt
 * ngang; bỏ qua các byte đó thay vì để `TextDecoder` sinh ký tự thay thế.
 */
function readSlot(bytes: Uint8Array, start: number): string {
  let end = start;
  while (end < start + SLOT && bytes[end] !== 0) end += 1;
  let from = start;
  while (from < end && (bytes[from] & 0xc0) === 0x80) from += 1;
  return decoder.decode(bytes.subarray(from, end)).trim();
}

function readKey(bytes: Uint8Array, keyOffset: number): number | null {
  if (keyOffset < 0 || keyOffset + 4 > bytes.length) return null;
  return (
    bytes[keyOffset] |
    (bytes[keyOffset + 1] << 8) |
    (bytes[keyOffset + 2] << 16) |
    (bytes[keyOffset + 3] << 24)
  ) >>> 0;
}

/**
 * Ô tên hợp lệ: rỗng hoàn toàn, hoặc một chuỗi bắt đầu bằng chữ cái rồi toàn NUL
 * tới hết ô. Phần đuôi phải sạch — đây là cửa lọc chính, vì dữ liệu ngẫu nhiên
 * hầu như không bao giờ để lại đuôi NUL dài.
 */
function isValidSlot(bytes: Uint8Array, start: number): boolean {
  if (start + SLOT > bytes.length) return false;
  let end = start;
  while (end < start + SLOT && bytes[end] !== 0) end += 1;
  if (end === start) return true; // ô rỗng
  if (end === start + SLOT) return false; // không có NUL kết thúc
  for (let i = end; i < start + SLOT; i += 1) {
    if (bytes[i] !== 0) return false;
  }
  const first = bytes[start];
  const isAlpha = (first >= 0x41 && first <= 0x5a) || (first >= 0x61 && first <= 0x7a);
  if (!isAlpha && first < 0xc0) return false; // chữ cái ASCII hoặc byte mở đầu UTF-8
  for (let i = start; i < end; i += 1) {
    if (bytes[i] < 0x20) return false;
  }
  return true;
}

function looksLikeRecord(bytes: Uint8Array, keyOffset: number): boolean {
  const base = keyOffset - NEWGEN_NAME_SLOTS * SLOT;
  if (base < 0) return false;
  const id = readKey(bytes, keyOffset);
  if (id === null || id <= 0 || id >= MAX_PLAYER_ID) return false;
  for (let s = 0; s < NEWGEN_NAME_SLOTS; s += 1) {
    if (!isValidSlot(bytes, base + s * SLOT)) return false;
  }
  // Ô tên và ô họ đều rỗng thì đây không phải bản ghi tên.
  return !(readSlot(bytes, base) === "" && readSlot(bytes, base + 2 * SLOT) === "");
}

export interface NewgenName {
  playerId: number;
  first: string;
  last: string;
  /** Tên hiển thị đã ghép; rơi về tên áo khi thiếu tên hoặc họ. */
  full: string;
}

/**
 * Số bản ghi liên tiếp phải cùng hợp lệ thì mới nhận là bảng.
 *
 * Một, thậm chí hai, bản ghi khớp vẫn có thể là ngẫu nhiên: phiên bản đầu chỉ
 * đòi hai và bắt trúng rác, ra đúng một "tên" hỏng. Bảng thật luôn có hàng chục
 * bản ghi liền nhau.
 */
const MIN_CONSECUTIVE = 4;

/** Tìm bảng bằng bố cục chứ không bằng offset: một dãy bản ghi hợp lệ liền nhau. */
function findAnchor(bytes: Uint8Array): number {
  const limit = bytes.length - REC * MIN_CONSECUTIVE;
  for (let i = 0; i < limit; i += 1) {
    const c = bytes[i];
    const isAlpha = (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
    if (!isAlpha) continue;

    const keyOffset = i + NEWGEN_NAME_SLOTS * SLOT;
    let run = 0;
    while (run < MIN_CONSECUTIVE && looksLikeRecord(bytes, keyOffset + run * REC)) run += 1;
    if (run >= MIN_CONSECUTIVE) return keyOffset;
  }
  return -1;
}

export function readNewgenNames(bytes: Uint8Array): Map<number, NewgenName> {
  const out = new Map<number, NewgenName>();
  const anchor = findAnchor(bytes);
  if (anchor < 0) return out;

  let first = anchor;
  while (looksLikeRecord(bytes, first - REC)) first -= REC;

  for (let k = 0; k < MAX_RECORDS; k += 1) {
    const keyOffset = first + k * REC;
    if (!looksLikeRecord(bytes, keyOffset)) break;

    const id = readKey(bytes, keyOffset) as number;
    const base = keyOffset - NEWGEN_NAME_SLOTS * SLOT;
    const slots: string[] = [];
    for (let s = 0; s < NEWGEN_NAME_SLOTS; s += 1) slots.push(readSlot(bytes, base + s * SLOT));

    const full = [slots[0], slots[2]].filter(Boolean).join(" ") || slots[3];
    if (full) out.set(id, { playerId: id, first: slots[0], last: slots[2], full });
  }
  return out;
}

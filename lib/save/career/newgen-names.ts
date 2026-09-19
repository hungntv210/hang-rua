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
 * Ghép bốn ô thành tên hiển thị.
 *
 * ─── Ô 2 KHÔNG PHẢI LÚC NÀO CŨNG LÀ HỌ ──────────────────────────────────────
 *
 * Hai career thật, hai bố cục khác nhau, đo được:
 *
 *     career A   ô0 "Alex"      ô2 "Dahl"              → ghép ra "Alex Dahl" ✓
 *     career B   ô0 "Patricio"  ô2 "Patricio Pacífico" → ghép ra tên LẶP ✗
 *
 * Ở career B, ô 2 đã là tên đầy đủ. Đo trên save thật: 9/19 bản ghi theo bố cục
 * ấy, tức gần một nửa cầu thủ regen hiện ra với tên đầu bị lặp hai lần.
 *
 * Nên không đoán bố cục nữa mà nhận ra từ chính dữ liệu: nếu ô 2 đã bắt đầu
 * bằng ô 0 kèm dấu cách thì nó là tên đầy đủ, dùng thẳng. Kiểm cả dấu cách là
 * cố ý — người tên "Danilo Danilo" có thật, và bỏ dấu cách ra khỏi phép so sẽ
 * biến họ thành "Danilo".
 */
function assembleName(slots: string[]): { first: string; last: string; full: string } {
  const given = slots[0] ?? "";
  const second = slots[2] ?? "";

  if (given && second.startsWith(`${given} `)) {
    return { first: given, last: second.slice(given.length + 1), full: second };
  }
  const full = [given, second].filter(Boolean).join(" ") || (slots[3] ?? "");
  return { first: given, last: second, full };
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
function findAnchor(bytes: Uint8Array, from = 0): number {
  const limit = bytes.length - REC * MIN_CONSECUTIVE;
  for (let i = from; i < limit; i += 1) {
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

/**
 * Đọc MỌI bảng tên newgen trong file, không chỉ bảng đầu tiên.
 *
 * Bản trước dừng ở khối đầu tìm được và trả về 20 mục, trong khi career đã sinh
 * 55 cầu thủ. Ba trong số 35 cầu thủ bị bỏ sót nằm ngay trong đội hình xuất
 * phát, nên sơ đồ đội hình hiện ra với ba ô trống tên — trông hệt như lỗi.
 *
 * Tên của họ VẪN nằm trong save, chỉ ở một khối khác (đo được: quanh 7,1MB,
 * ngoài khối đầu). Nên việc cần làm không phải giải mã thêm cấu trúc mới mà là
 * bỏ giả định "chỉ có một bảng".
 */
export function readNewgenNames(bytes: Uint8Array): Map<number, NewgenName> {
  const out = new Map<number, NewgenName>();
  let cursor = 0;

  while (out.size < MAX_RECORDS) {
    const anchor = findAnchor(bytes, cursor);
    if (anchor < 0) break;

    // Lùi về bản ghi đầu của khối: `findAnchor` dừng ở bản ghi nào cũng được.
    let first = anchor;
    while (looksLikeRecord(bytes, first - REC)) first -= REC;

    let k = 0;
    for (; k < MAX_RECORDS; k += 1) {
      const keyOffset = first + k * REC;
      if (!looksLikeRecord(bytes, keyOffset)) break;

      const id = readKey(bytes, keyOffset) as number;
      const base = keyOffset - NEWGEN_NAME_SLOTS * SLOT;
      const slots: string[] = [];
      for (let s = 0; s < NEWGEN_NAME_SLOTS; s += 1) slots.push(readSlot(bytes, base + s * SLOT));

      const { first: given, last: family, full } = assembleName(slots);
      // Khối đứng trước thắng: bảng đầu là bảng chính, khối sau chỉ bù phần thiếu.
      if (full && !out.has(id)) out.set(id, { playerId: id, first: given, last: family, full });
    }

    // Tiếp tục ngay sau khối vừa đọc. Không nhích tiến thì vòng lặp treo.
    const next = first + Math.max(k, 1) * REC;
    cursor = next > cursor ? next : cursor + 1;
  }

  return out;
}

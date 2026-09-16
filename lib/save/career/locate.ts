/**
 * Định vị bảng cầu thủ trong file save.
 *
 * KHÔNG hằng số cứng. Offset của bảng khác nhau giữa các file — trên save thử
 * nghiệm nó ở 2.621.344, trên squad file ở 4.980.841 — nên phải dò lại mỗi lần.
 *
 * Neo bằng chính trường `playerId`: khoá cầu thủ phải **duy nhất** trong bảng.
 * Đó là tiêu chí đúng/sai rõ ràng, khác hẳn việc tin vào một đỉnh thống kê.
 *
 * Lần dò đầu tiên chọn pha bằng heuristic entropy cột và lệch 108 byte. Pha sai
 * không gây lỗi — nó chỉ lặng lẽ trả về số vô nghĩa, vì mọi trường nằm sau bit
 * 288 bị tràn sang bản ghi kế tiếp. `potential` và `dob` "biến mất" hoàn toàn.
 * Vì thế ở đây pha được chọn bằng tính duy nhất của khoá, không bằng entropy.
 */

import { shannonEntropy } from "../reader";
import { CORE_FIELDS, PLAYER_RECORD_BYTES, type BitField } from "./schema";

/** Bảng cầu thủ đóng gói bit có entropy ~5,8–6,0 bit/byte. Ngưỡng để lọc vùng ứng viên. */
const MIN_REGION_ENTROPY = 5.0;
const BLOCK_BYTES = 64 * 1024;
/** Vùng ứng viên nhỏ hơn mức này không thể là bảng cầu thủ (~18.000 bản ghi). */
const MIN_REGION_BYTES = 512 * 1024;

/** playerId của EA nằm dưới mức này. Nới rộng vì cầu thủ do career sinh có ID cao. */
const MAX_PLAYER_ID = 2_000_000;

export interface PlayerTableLocation {
  base: number;
  count: number;
  recordBytes: number;
  /** Tỉ lệ bản ghi có khoá hợp lệ và duy nhất. Dưới 0,95 là dấu hiệu dò sai. */
  keyQuality: number;
}

function readField(bytes: Uint8Array, recordStart: number, f: BitField): number | null {
  const startBit = recordStart * 8 + f.bit;
  const endByte = (startBit + f.width - 1) >> 3;
  if (recordStart < 0 || endByte >= bytes.length) return null;
  let v = 0;
  for (let i = 0; i < f.width; i += 1) {
    const b = startBit + i;
    v += ((bytes[b >> 3] >> (b & 7)) & 1) * 2 ** i;
  }
  return v + f.add;
}

function readPlayerId(bytes: Uint8Array, recordStart: number): number | null {
  return readField(bytes, recordStart, CORE_FIELDS.playerId);
}

/**
 * Khoá duy nhất KHÔNG đủ để nhận ra bản ghi thật.
 *
 * Phiên bản đầu chỉ kiểm tính duy nhất của `playerId`, và bảng bị nới thừa 370
 * bản ghi rác ở đầu — dữ liệu ngẫu nhiên cũng cho ra khoá duy nhất. Triệu chứng
 * chỉ lộ ra ở đầu ra: năm sinh trải từ 1941 tới 2030, chiều cao 130–240cm.
 *
 * Vì thế phải bắt NHIỀU trường cùng hợp lệ. Rác qua được một cửa, không qua nổi bốn.
 */
function isPlayerRecord(bytes: Uint8Array, recordStart: number): boolean {
  const id = readPlayerId(bytes, recordStart);
  if (id === null || id <= 0 || id >= MAX_PLAYER_ID) return false;

  const height = readField(bytes, recordStart, CORE_FIELDS.heightCm);
  if (height === null || height < 145 || height > 215) return false;

  const potential = readField(bytes, recordStart, CORE_FIELDS.potential);
  if (potential === null || potential < 30 || potential > 99) return false;

  const day = readField(bytes, recordStart, CORE_FIELDS.birthDate);
  if (day === null) return false;
  const year = new Date(day * 86_400_000).getUTCFullYear();
  return year >= 1960 && year <= 2020;
}

/** Các vùng byte có entropy đủ cao để chứa bảng đóng gói bit. */
function candidateRegions(bytes: Uint8Array): Array<[number, number]> {
  const regions: Array<[number, number]> = [];
  let runStart = -1;

  for (let off = 0; off < bytes.length; off += BLOCK_BYTES) {
    const len = Math.min(BLOCK_BYTES, bytes.length - off);
    const dense = shannonEntropy(bytes, off, len, 8192) >= MIN_REGION_ENTROPY;
    if (dense && runStart < 0) runStart = off;
    if (!dense && runStart >= 0) {
      if (off - runStart >= MIN_REGION_BYTES) regions.push([runStart, off]);
      runStart = -1;
    }
  }
  if (runStart >= 0 && bytes.length - runStart >= MIN_REGION_BYTES) {
    regions.push([runStart, bytes.length]);
  }
  return regions;
}

/**
 * Đếm số bản ghi liên tiếp có khoá hợp lệ và chưa từng gặp, bắt đầu từ `base`.
 * Dừng ngay khi gặp bản ghi hỏng — bảng là một dải liền mạch.
 */
/**
 * Số ô hỏng liên tiếp được phép trước khi coi là hết bảng.
 *
 * Bảng thật có ô trống và ô dành sẵn xen kẽ, nên dừng ở ô hỏng ĐẦU TIÊN là sai:
 * làm vậy bảng bị cắt còn 6.298 trong khi thực tế có hơn 20.000 bản ghi. Ngưỡng
 * này đủ rộng để vượt qua các khoảng trống, đủ hẹp để không tràn sang vùng khác.
 */
const GAP_TOLERANCE = 64;

interface Extent {
  /** Số ô tính tới bản ghi hợp lệ cuối cùng. */
  span: number;
  /** Số bản ghi thực sự hợp lệ. Đây mới là thước đo để so các pha với nhau. */
  valid: number;
}

/** Đi tới từ `base`, vượt qua khoảng trống, dừng khi hết bảng. */
function forwardExtent(bytes: Uint8Array, base: number, limit: number): Extent {
  const seen = new Set<number>();
  let lastValid = -1;
  let valid = 0;
  let bad = 0;

  for (let n = 0; n < limit; n += 1) {
    const start = base + n * PLAYER_RECORD_BYTES;
    if (start + PLAYER_RECORD_BYTES > bytes.length) break;

    if (isPlayerRecord(bytes, start)) {
      const id = readPlayerId(bytes, start) as number;
      if (!seen.has(id)) {
        seen.add(id);
        lastValid = n;
        valid += 1;
        bad = 0;
        continue;
      }
    }
    bad += 1;
    if (bad > GAP_TOLERANCE) break;
  }
  return { span: lastValid + 1, valid };
}

/** Lùi từ `start`, cũng chịu được khoảng trống. Trả offset đầu bảng. */
function backwardBase(bytes: Uint8Array, start: number): number {
  let base = start;
  let bad = 0;
  let cursor = start;

  while (cursor - PLAYER_RECORD_BYTES >= 0) {
    cursor -= PLAYER_RECORD_BYTES;
    if (isPlayerRecord(bytes, cursor)) {
      base = cursor;
      bad = 0;
      continue;
    }
    bad += 1;
    if (bad > GAP_TOLERANCE) break;
  }
  return base;
}

/**
 * Tìm bảng cầu thủ. Trả `null` khi không có vùng nào đạt — người gọi phải xử lý
 * trường hợp này chứ không được coi như bảng rỗng.
 */
export function locatePlayerTable(bytes: Uint8Array): PlayerTableLocation | null {
  let best: PlayerTableLocation | null = null;
  let bestValid = 0;

  for (const [from, to] of candidateRegions(bytes)) {
    const maxRecords = Math.floor((to - from) / PLAYER_RECORD_BYTES) + GAP_TOLERANCE;

    // Thử đủ 144 pha. Pha đúng cho nhiều bản ghi hợp lệ nhất — không phải dài nhất.
    for (let phase = 0; phase < PLAYER_RECORD_BYTES; phase += 1) {
      const probe = forwardExtent(bytes, from + phase, maxRecords);
      if (probe.valid < 200) continue;

      // Bảng có thể bắt đầu trước ranh giới vùng entropy nên phải nới ngược.
      const base = backwardBase(bytes, from + phase);
      const total = forwardExtent(
        bytes,
        base,
        maxRecords + Math.ceil((from + phase - base) / PLAYER_RECORD_BYTES),
      );

      if (total.valid > bestValid) {
        bestValid = total.valid;
        best = {
          base,
          count: total.span,
          recordBytes: PLAYER_RECORD_BYTES,
          keyQuality: total.span > 0 ? total.valid / total.span : 0,
        };
      }
    }
  }

  return best;
}

/** Bản ghi tại ô này có phải cầu thủ thật không — ô trống thì bỏ qua khi giải mã. */
export function isValidRecordAt(bytes: Uint8Array, recordStart: number): boolean {
  return isPlayerRecord(bytes, recordStart);
}

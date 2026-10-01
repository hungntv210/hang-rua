/**
 * Tên cầu thủ do career sinh ra (học viện), đọc từ CHỮ có sẵn trong save.
 *
 * Kho tên FC27 không nằm trong save và đã đánh số lại so với FC26, nhưng cầu thủ
 * học viện còn được ghi kèm tên dạng chữ ở một khối riêng:
 *
 *     [01][u32 độ dài][Tên] [01][u32][Họ] [01][u32][Họ]   — họ lặp hai lần
 *     [01 00 00 00 00]                                    — dấu phân cách bản ghi
 *     [u32 mã cầu thủ] [01][u32][Tên] …                   — mã đứng NGAY TRƯỚC bản ghi kế
 *
 * Mã là mã cầu thủ thật (không trừ 1 như các bảng FIFA DB). Bản ghi đầu của một khối
 * có thể không có mã đứng trước; khi đó `read.ts` gán bằng suy luận có điều kiện.
 *
 * Mẫu rất đặc thù (ba chuỗi chữ cái liền nhau, chuỗi thứ ba = chuỗi thứ hai, kèm dấu
 * phân cách) nên quét cả blob mà không khớp nhầm: đo trên hai save, không một kết quả
 * thừa nào.
 */

const MAX_PLAYER_ID = 2_000_000;

export interface NameRecord {
  /** Offset của bản ghi trong blob. */
  at: number;
  name: string;
  /** Mã đọc được ngay trước bản ghi, hoặc `null`. */
  id: number | null;
}

const decoder = new TextDecoder("utf-8", { fatal: false });
const LETTERS = /^[\p{L}][\p{L}'’. -]*$/u;

export function readNameRecords(blob: Uint8Array): NameRecord[] {
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const str = (o: number): { s: string; end: number } | null => {
    if (blob[o] !== 1 || o + 5 > blob.length) return null;
    const len = dv.getUint32(o + 1, true);
    if (len < 1 || len > 40 || o + 5 + len > blob.length) return null;
    const s = decoder.decode(blob.subarray(o + 5, o + 5 + len));
    return LETTERS.test(s) ? { s, end: o + 5 + len } : null;
  };

  const out: NameRecord[] = [];
  for (let i = 0; i + 17 < blob.length; i += 1) {
    if (blob[i] !== 1) continue;
    const first = str(i);
    if (!first) continue;
    const last = str(first.end);
    if (!last) continue;
    const again = str(last.end);
    if (!again || again.s !== last.s) continue;
    // Dấu phân cách bản ghi: 01 00 00 00 00.
    const sep = again.end;
    if (blob[sep] !== 1 || dv.getUint32(sep + 1, true) !== 0) continue;

    const prev = i >= 4 ? dv.getUint32(i - 4, true) : 0;
    out.push({ at: i, name: `${first.s} ${last.s}`, id: prev >= 1 && prev <= MAX_PLAYER_ID ? prev : null });
    i = again.end - 1;
  }
  return out;
}

/**
 * Gán tên cho mã cầu thủ.
 *
 * Bản ghi có mã thì dùng thẳng. Bản ghi không có mã được suy ra CHỈ KHI có đúng một
 * bản ghi như vậy và đúng một mã học viện chưa có tên — khi đó phép ghép là duy nhất.
 * Còn mơ hồ thì bỏ bản ghi đó, không gán bừa.
 */
export function assignNames(records: NameRecord[], academyIds: number[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const r of records) if (r.id !== null && !out.has(r.id)) out.set(r.id, r.name);

  const orphans = records.filter((r) => r.id === null);
  const missing = academyIds.filter((id) => !out.has(id));
  if (orphans.length === 1 && missing.length === 1) out.set(missing[0], orphans[0].name);
  return out;
}

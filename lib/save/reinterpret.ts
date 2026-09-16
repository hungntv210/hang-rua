/**
 * Diễn giải lại 8 byte `rawHex` của một field theo kiểu khác.
 *
 * Đây là lý do parser lưu `rawHex` thay vì chỉ lưu giá trị đã suy đoán: khi bạn
 * nghi một field bị đoán sai kiểu, bạn xem ngay các cách đọc khác trong UI mà
 * KHÔNG phải nạp lại file 15MB và quét lại từ đầu.
 */

export interface Reinterpretation {
  int32: number | null;
  uint32: number | null;
  float32: number | null;
  int16: number | null;
  /** 4 byte đầu đọc như ASCII; byte ngoài dải in được hiện thành dấu chấm. */
  ascii: string;
  bytes: number[];
}

/** "48 00 00 00" → [0x48, 0, 0, 0] */
export function parseHexBytes(hex: string): number[] {
  if (!hex) return [];
  return hex
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseInt(part, 16))
    .filter((value) => Number.isFinite(value));
}

export function reinterpret(hex: string): Reinterpretation {
  const bytes = parseHexBytes(hex);
  const view = new DataView(new ArrayBuffer(8));
  for (let i = 0; i < Math.min(bytes.length, 8); i += 1) {
    view.setUint8(i, bytes[i]);
  }

  const hasFour = bytes.length >= 4;
  const hasTwo = bytes.length >= 2;

  let ascii = "";
  for (let i = 0; i < Math.min(bytes.length, 4); i += 1) {
    const b = bytes[i];
    ascii += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
  }

  return {
    int32: hasFour ? view.getInt32(0, true) : null,
    uint32: hasFour ? view.getUint32(0, true) : null,
    float32: hasFour ? view.getFloat32(0, true) : null,
    int16: hasTwo ? view.getInt16(0, true) : null,
    ascii,
    bytes,
  };
}

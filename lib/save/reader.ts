/**
 * Đọc byte có kiểm biên.
 *
 * Nguyên tắc: đọc quá biên trả `null`, KHÔNG ném ngoại lệ. Parser chạy trên dữ
 * liệu chưa giải mã hết nên việc chạm biên là chuyện bình thường xảy ra hàng
 * nghìn lần mỗi lượt quét — nếu mỗi lần đều ném thì hoặc là try/catch dày đặc,
 * hoặc là sập cả lượt parse. Cả hai đều tệ hơn việc trả null.
 */
export class ByteReader {
  readonly bytes: Uint8Array;
  readonly view: DataView;
  readonly size: number;

  constructor(buffer: ArrayBuffer) {
    this.bytes = new Uint8Array(buffer);
    this.view = new DataView(buffer);
    this.size = this.bytes.length;
  }

  has(offset: number, length: number): boolean {
    return offset >= 0 && length >= 0 && offset + length <= this.size;
  }

  u8(offset: number): number | null {
    return this.has(offset, 1) ? this.bytes[offset] : null;
  }

  u32(offset: number): number | null {
    return this.has(offset, 4) ? this.view.getUint32(offset, true) : null;
  }

  i32(offset: number): number | null {
    return this.has(offset, 4) ? this.view.getInt32(offset, true) : null;
  }

  f32(offset: number): number | null {
    return this.has(offset, 4) ? this.view.getFloat32(offset, true) : null;
  }

  /**
   * Đọc `length` byte thành chuỗi ASCII. Byte ngoài dải in được thành `.` để
   * chuỗi luôn an toàn khi in ra màn hình.
   */
  ascii(offset: number, length: number): string | null {
    if (!this.has(offset, length)) return null;
    let out = "";
    for (let i = 0; i < length; i += 1) {
      const b = this.bytes[offset + i];
      out += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
    }
    return out;
  }

  hex(offset: number, length: number): string {
    const end = Math.min(offset + length, this.size);
    let out = "";
    for (let i = Math.max(0, offset); i < end; i += 1) {
      out += this.bytes[i].toString(16).padStart(2, "0").toUpperCase();
      if (i < end - 1) out += " ";
    }
    return out;
  }

  /** Vị trí đầu tiên của một chuỗi ASCII, hoặc -1. Tìm trong `[from, to)`. */
  indexOfAscii(needle: string, from = 0, to = this.size): number {
    if (needle.length === 0) return -1;
    const pat = new Uint8Array(needle.length);
    for (let i = 0; i < needle.length; i += 1) pat[i] = needle.charCodeAt(i);

    const last = Math.min(to, this.size) - pat.length;
    const first = pat[0];
    for (let i = Math.max(0, from); i <= last; i += 1) {
      if (this.bytes[i] !== first) continue;
      let j = 1;
      while (j < pat.length && this.bytes[i + j] === pat[j]) j += 1;
      if (j === pat.length) return i;
    }
    return -1;
  }
}

/** Entropy Shannon (bit/byte, 0–8) trên tối đa `sampleLimit` byte đầu dải. */
export function shannonEntropy(
  bytes: Uint8Array,
  offset: number,
  length: number,
  sampleLimit = 4096,
): number {
  const n = Math.min(length, sampleLimit, bytes.length - offset);
  if (n <= 0) return 0;

  const freq = new Uint32Array(256);
  for (let i = 0; i < n; i += 1) freq[bytes[offset + i]] += 1;

  let entropy = 0;
  for (let i = 0; i < 256; i += 1) {
    if (freq[i] === 0) continue;
    const p = freq[i] / n;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

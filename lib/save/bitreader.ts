/**
 * Đọc trường đóng gói theo bit trong bảng bản ghi cố định.
 *
 * Bảng cầu thủ của FC 26 không lưu từng trường theo byte: mỗi bản ghi dài đúng
 * 144 byte và các trường nằm ở vị trí bit tuỳ ý, thứ tự **LSB-first** (bit thấp
 * trước). Đọc theo byte sẽ ra số vô nghĩa.
 *
 * Cùng nguyên tắc với `ByteReader`: đọc quá biên trả `null`, không ném ngoại lệ.
 * Bảng được định vị bằng suy luận nên chạm biên là chuyện bình thường.
 */
export class BitRecordReader {
  private readonly bytes: Uint8Array;
  /** Offset byte của bản ghi đầu tiên. */
  readonly base: number;
  /** Độ dài một bản ghi, tính bằng byte. */
  readonly recordBytes: number;
  /** Số bản ghi trong bảng. */
  readonly count: number;

  constructor(bytes: Uint8Array, base: number, recordBytes: number, count: number) {
    this.bytes = bytes;
    this.base = base;
    this.recordBytes = recordBytes;
    this.count = count;
  }

  /**
   * Đọc `width` bit bắt đầu tại bit `bitOffset` trong bản ghi thứ `record`.
   *
   * Giới hạn `width <= 30`: dùng số nguyên 32 bit có dấu thì bit thứ 31 làm giá
   * trị âm. Không trường nào trong định dạng này rộng quá 20 bit nên ngưỡng này
   * rộng rãi, và vượt ngưỡng là lỗi lập trình chứ không phải dữ liệu xấu.
   */
  field(record: number, bitOffset: number, width: number): number | null {
    if (record < 0 || record >= this.count) return null;
    if (width <= 0 || width > 30) return null;

    const startBit = (this.base + record * this.recordBytes) * 8 + bitOffset;
    const endByte = (startBit + width - 1) >> 3;
    if (startBit < 0 || endByte >= this.bytes.length) return null;

    let value = 0;
    for (let i = 0; i < width; i += 1) {
      const bit = startBit + i;
      value += ((this.bytes[bit >> 3] >> (bit & 7)) & 1) * 2 ** i;
    }
    return value;
  }

  /** Byte đầu tiên nằm ngoài bảng. */
  get endOffset(): number {
    return this.base + this.count * this.recordBytes;
  }
}

/**
 * File save giả lập, dựng đúng theo cấu trúc đã khảo sát được từ file thật.
 *
 * Dự án chưa có test framework, nên đây là cách kiểm chứng parser một cách lặp
 * lại được: dựng file có nội dung BIẾT TRƯỚC, chạy parser, đối chiếu.
 *
 * Fixture cố tình nhét một khối 4KB entropy cao vào GIỮA hai cụm field — đó là
 * tình huống làm parser tuần tự chết, và là thứ cơ chế tái đồng bộ phải vượt
 * qua. Nếu field sau khối đó vẫn được tìm thấy thì cơ chế chạy đúng.
 */

const encoder = new TextEncoder();

class Writer {
  private parts: number[] = [];

  bytes(values: readonly number[]): this {
    this.parts.push(...values);
    return this;
  }

  ascii(text: string): this {
    this.parts.push(...Array.from(encoder.encode(text)));
    return this;
  }

  u32(value: number): this {
    this.parts.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
    return this;
  }

  i32(value: number): this {
    return this.u32(value >>> 0);
  }

  f32(value: number): this {
    const buf = new DataView(new ArrayBuffer(4));
    buf.setFloat32(0, value, true);
    for (let i = 0; i < 4; i += 1) this.parts.push(buf.getUint8(i));
    return this;
  }

  /** Token chuỗi đứng một mình: `01 [uint32 độ dài] [chuỗi]`. */
  stringToken(text: string): this {
    return this.bytes([0x01]).u32(text.length).ascii(text);
  }

  /** Field có tên: `01 01 [uint32 độ dài tên] [tên] [int32]`. */
  intField(name: string, value: number): this {
    return this.bytes([0x01]).stringToken(name).i32(value);
  }

  floatField(name: string, value: number): this {
    return this.bytes([0x01]).stringToken(name).f32(value);
  }

  /** Field mà giá trị lại là một token chuỗi. Chưa gặp trong file thật. */
  stringField(name: string, value: string): this {
    return this.bytes([0x01]).stringToken(name).stringToken(value);
  }

  /** Đầu bản ghi: `01 [uint32 số field]`. */
  recordHeader(fieldCount: number): this {
    return this.bytes([0x01]).u32(fieldCount);
  }

  get length(): number {
    return this.parts.length;
  }

  toBuffer(): ArrayBuffer {
    return new Uint8Array(this.parts).buffer;
  }
}

/** Nhiễu tất định — không dùng Math.random để fixture luôn giống nhau. */
function pseudoRandomBytes(count: number, seed = 0x1234_5678): number[] {
  const out: number[] = [];
  let state = seed;
  for (let i = 0; i < count; i += 1) {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    out.push((state >>> 16) & 0xff);
  }
  return out;
}

export interface FixtureExpectation {
  name: string;
  type: string;
  display: string;
}

/**
 * Những gì parser BẮT BUỘC phải tìm thấy trong fixture.
 *
 * Giá trị lấy nguyên từ bản ghi chuyển nhượng thật trong
 * `CmMgrC20260730232114046` để fixture không trôi xa khỏi file thật.
 */
export const FIXTURE_EXPECTATIONS: FixtureExpectation[] = [
  { name: "Sold Player Overall", type: "int32", display: "72" },
  { name: "PlayerID", type: "int32", display: "239852" },
  { name: "Purchase Value", type: "int32", display: "25000000" },
  { name: "Transfer Value", type: "int32", display: "11200000" },
  { name: "InjuryName", type: "int32", display: "46" },
  { name: "Rating", type: "float32", display: "7.400000" },
  // Field này nằm SAU khối entropy cao — có nó nghĩa là đã tái đồng bộ được.
  { name: "Buying Team ID", type: "int32", display: "247" },
];

export function buildSyntheticSave(): ArrayBuffer {
  const w = new Writer();

  // Container: magic + vài uint32 version/metadata + tag Career Mode.
  w.ascii("FBCHUNKS");
  w.u32(1).u32(26).u32(0x2026).u32(0).u32(15_728_640).u32(3);
  w.ascii("cmBNRY").bytes([0, 0]);

  // Token chuỗi đứng một mình — tên vùng dữ liệu, y như trong file thật.
  w.stringToken("deepsim");
  w.stringToken("DataMananger");

  w.recordHeader(9);
  w.intField("Purchased Player ID", 278_773);
  w.intField("Purchase Value", 25_000_000);
  w.intField("Sold Player ID", 213_884);
  w.intField("Sold Player Overall", 72);
  w.intField("Sold Player Pitch Area", 3);
  w.intField("Transfer Value", 11_200_000);
  w.intField("Player Position", 10);
  w.intField("InjuryLength", 29);
  w.intField("InjuryName", 46);

  w.intField("PlayerID", 239_852);
  w.floatField("Rating", 7.4);
  w.stringField("Nationality", "Brazil");

  // Khối chưa giải mã: entropy cao, có cả tên đội dạng ASCII NUL-pad nằm lẫn
  // vào — đúng cách file thật lưu tên đội, ngoài cấu trúc token.
  w.bytes(pseudoRandomBytes(2048));
  w.ascii("Jahn Regensburg").bytes([0, 0, 0]);
  w.bytes(pseudoRandomBytes(1024, 0x0bad_c0de));
  w.ascii("Sligo Rovers").bytes([0, 0, 0]);
  w.bytes(pseudoRandomBytes(1024, 0x0fee_1dad));

  // Cụm field sau khối nhiễu — phép thử tái đồng bộ.
  w.recordHeader(4);
  w.intField("Buying Team ID", 247);
  w.intField("Purchased From Team ID", 1);
  w.intField("First Goal", 1);
  w.intField("UCL Debut", 0);

  return w.toBuffer();
}

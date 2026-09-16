/**
 * Đọc token chuỗi và suy đoán kiểu của giá trị đứng sau tên field.
 *
 * Cấu trúc token chuỗi đã xác nhận trên file save thật:
 *
 *   01 | [uint32 độ dài] | [bấy nhiêu byte ASCII, KHÔNG có NUL kết thúc]
 *
 * Giá trị thì file KHÔNG khai báo kiểu ở dạng đọc được — đó là phần chưa giải
 * mã. Nên kiểu giá trị chỉ là phỏng đoán từ hình dạng byte, và parser luôn giữ
 * `rawHex` để người dùng đọc lại theo cách khác mà không phải quét lại file.
 */

import { ByteReader } from "./reader";
import { TAGS, VALUE_HEURISTICS } from "./heuristics";
import type { RawValueKind } from "./types";

export interface StringToken {
  text: string;
  /** Tổng số byte của token, tính từ byte tag. */
  size: number;
}

export interface InferredValue {
  kind: RawValueKind;
  /** Số byte parser cho là thuộc về giá trị — dùng để nhảy tới field kế tiếp. */
  size: number;
  int: number | null;
  float: number | null;
  text: string | null;
}

const NONE: InferredValue = {
  kind: "none",
  size: 0,
  int: null,
  float: null,
  text: null,
};

function isPrintable(byte: number): boolean {
  return byte >= 0x20 && byte <= 0x7e;
}

/** Toàn bộ `length` byte phải in được. Chuỗi trong file không có NUL kết thúc. */
export function isAsciiRun(
  reader: ByteReader,
  offset: number,
  length: number,
): boolean {
  if (length <= 0 || !reader.has(offset, length)) return false;
  for (let i = 0; i < length; i += 1) {
    if (!isPrintable(reader.bytes[offset + i])) return false;
  }
  return true;
}

/**
 * Đọc token chuỗi tại `offset` (offset trỏ vào byte tag), hoặc null nếu không
 * khớp. `maxLength` để gọi ở vị trí tên field (tên ngắn) khác với gọi ở vị trí
 * giá trị (chuỗi có thể dài hơn).
 */
export function readStringToken(
  reader: ByteReader,
  offset: number,
  maxLength: number,
  minLength = 1,
): StringToken | null {
  if (reader.u8(offset) !== TAGS.string) return null;

  const length = reader.u32(offset + 1);
  if (length === null || length < minLength || length > maxLength) return null;
  if (!isAsciiRun(reader, offset + 5, length)) return null;

  return {
    text: reader.ascii(offset + 5, length) ?? "",
    size: 5 + length,
  };
}

/**
 * Suy đoán giá trị đứng ngay sau tên field.
 *
 * Trên file thật, giá trị luôn là 4 byte. Vẫn thử token chuỗi trước phòng khi
 * có field lưu chuỗi mà lần khảo sát này chưa gặp — nếu không có thì nhánh đó
 * đơn giản là không bao giờ khớp, không gây hại.
 */
export function inferValue(reader: ByteReader, offset: number): InferredValue {
  if (!reader.has(offset, 1)) return NONE;

  const nested = readStringToken(
    reader,
    offset,
    VALUE_HEURISTICS.maxStringLength,
    VALUE_HEURISTICS.minStringLength,
  );
  if (nested) {
    return {
      kind: "string",
      size: nested.size,
      int: null,
      float: null,
      text: nested.text,
    };
  }

  if (!reader.has(offset, 4)) return NONE;

  const asInt = reader.i32(offset) as number;
  const asFloat = reader.f32(offset) as number;

  // int nhỏ thì chắc chắn là int: một float32 "người đọc được" không bao giờ có
  // bit pattern nhỏ. 72 đọc theo float là 1e-43, tức nếu đây là float thì nó vô
  // nghĩa.
  if (Math.abs(asInt) < VALUE_HEURISTICS.preferIntBelow) {
    return { kind: "int32", size: 4, int: asInt, float: asFloat, text: null };
  }

  // int lớn: chỉ là float nếu đọc theo float ra con số người đọc được.
  // 7.4 → int 1.088.841.421 (chuyển sang float);
  // 25.000.000 → float 4,6e-38 (giữ nguyên int).
  const absFloat = Math.abs(asFloat);
  const plausibleFloat =
    Number.isFinite(asFloat) &&
    absFloat >= VALUE_HEURISTICS.minPlausibleFloatAbs &&
    absFloat <= VALUE_HEURISTICS.maxPlausibleFloatAbs;
  if (plausibleFloat) {
    return { kind: "float32", size: 4, int: asInt, float: asFloat, text: null };
  }

  return { kind: "int32", size: 4, int: asInt, float: asFloat, text: null };
}

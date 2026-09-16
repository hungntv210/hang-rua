/**
 * Máy quét token kiểu "quét & tái đồng bộ".
 *
 * Hai mẫu đã xác nhận trên file save thật (xem `TAGS` trong heuristics.ts):
 *
 *   A. Field có tên : 01 01 [u32 len] [tên] [giá trị 4 byte]
 *   B. Chuỗi đứng một mình: 01 [u32 len] [chuỗi]
 *
 * Vì A = một byte 01 rồi đến B, thứ tự thử là bắt buộc: thử A trước, không khớp
 * mới thử B. Ngược lại thì mọi field sẽ bị đọc thành chuỗi trơ và mất giá trị.
 *
 * Parser KHÔNG đọc tuần tự theo ngữ pháp toàn cục — ngữ pháp đó chưa biết. Ở
 * mỗi offset nó thử khớp; không khớp thì tiến đúng MỘT byte và gom byte đó vào
 * một "vùng chưa giải mã" đang mở. Hai hệ quả, và đây là lý do chọn cách này:
 *
 * 1. Không thể mất đồng bộ vĩnh viễn. Một bảng nhị phân 3MB chỉ khiến parser
 *    trượt từng byte rồi bắt lại field ngay sau đó, thay vì hỏng toàn bộ phần
 *    còn lại của file như parser tuần tự.
 * 2. Không có đường nào dẫn tới ngoại lệ: mọi phép đọc đều qua ByteReader có
 *    kiểm biên, mọi nhánh không khớp đều có lối ra là `pos += 1`.
 */

import { ByteReader } from "./reader";
import { inferValue, readStringToken } from "./infer";
import { NAME_HEURISTICS, SCAN_LIMITS, TAGS, VALUE_HEURISTICS } from "./heuristics";
import type {
  RawField,
  RawLooseString,
  RawScanResult,
  RawStringToken,
  RawUnknownRun,
} from "./types";

export interface ScanOptions {
  /** Bắt đầu quét từ đâu — mặc định đầu file. */
  start?: number;
  /** Gọi lại với tỷ lệ 0–1 sau mỗi `progressStepBytes`. */
  onProgress?: (ratio: number) => void;
}

function isLetter(byte: number): boolean {
  return (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a);
}

/**
 * Tên có "trông giống tên field" không?
 *
 * Chuỗi toàn dấu chấm hoặc toàn số vẫn qua được kiểm tra ASCII, nên cần thêm
 * ràng buộc có chữ cái — nếu không, vùng nhị phân sẽ đẻ ra field rác.
 */
function isPlausibleName(text: string): boolean {
  if (text.length < NAME_HEURISTICS.minLength) return false;
  if (NAME_HEURISTICS.requireLeadingLetter && !/^[A-Za-z]/.test(text)) return false;
  return /[A-Za-z]/.test(text);
}

/**
 * Ký tự được phép có trong một chuỗi rời "đáng tin".
 *
 * Nhiễu ngẫu nhiên vẫn lọt lưới "ASCII in được" (`%}BL#`), nên cần thêm một
 * lưới nữa: mọi ký tự phải nằm trong tập an toàn này, và phải đủ số chữ cái.
 * Tên đội ("Sligo Rovers", "Fluminense") qua được cả hai.
 */
function isSafeStringChar(byte: number): boolean {
  if (isLetter(byte)) return true;
  if (byte >= 0x30 && byte <= 0x39) return true; // 0-9
  return " .-'_/()&+:,".includes(String.fromCharCode(byte));
}

/**
 * Vét chuỗi ASCII rời trong một dải chưa giải mã.
 *
 * Tên đội nằm ở đây chứ không phải trong bảng field: trong file thật chúng là
 * chuỗi NUL-pad trong bảng cố định ("Fluminense" + toàn byte 00), không có tag
 * và không có độ dài khai báo, nên máy quét token không thể nhận ra.
 */
function collectLooseStrings(
  reader: ByteReader,
  offset: number,
  length: number,
  sink: RawLooseString[],
): void {
  const end = Math.min(offset + length, reader.size);
  let runStart = -1;
  let letters = 0;

  const flush = (runEnd: number): void => {
    if (runStart < 0) return;
    const runLength = runEnd - runStart;
    // Byte ĐỨNG NGAY SAU chuỗi, kể cả khi nó nằm ngoài vùng đang xét: phần đệm
    // NUL của bảng bản ghi có thể bắt đầu ngay tại ranh giới vùng.
    const nulTerminated = reader.u8(runEnd) === 0x00;
    if (
      runLength >= SCAN_LIMITS.minLooseStringLength &&
      letters >= SCAN_LIMITS.minLooseStringLetters &&
      (!SCAN_LIMITS.requireLooseStringNulTerminator || nulTerminated) &&
      sink.length < SCAN_LIMITS.maxLooseStrings
    ) {
      const capped = Math.min(runLength, SCAN_LIMITS.maxLooseStringLength);
      sink.push({ offset: runStart, text: reader.ascii(runStart, capped) ?? "" });
    }
    runStart = -1;
    letters = 0;
  };

  for (let i = offset; i < end; i += 1) {
    const b = reader.bytes[i];
    if (isSafeStringChar(b)) {
      if (runStart < 0) runStart = i;
      if (isLetter(b)) letters += 1;
      continue;
    }
    flush(i);
  }
  flush(end);
}

export function scanSave(
  reader: ByteReader,
  options: ScanOptions = {},
): RawScanResult {
  const fields: RawField[] = [];
  const stringTokens: RawStringToken[] = [];
  const unknownRuns: RawUnknownRun[] = [];
  const looseStrings: RawLooseString[] = [];
  const limitsHit: string[] = [];

  const { bytes, size } = reader;
  let pos = Math.max(0, options.start ?? 0);
  let unknownStart = -1;
  let nextProgressAt = pos + SCAN_LIMITS.progressStepBytes;
  let truncated = false;
  let unknownRunCount = 0;
  let unknownBytes = 0;

  /**
   * Ngưỡng ghi vùng chưa giải mã, TỰ NÂNG khi danh sách đầy.
   *
   * Cắt thẳng theo trần sẽ giữ 20.000 khe rác đầu file rồi bỏ qua bảng 3MB nằm
   * cuối — hỏng đúng thứ cần tìm. Khi đầy thì tỉa nửa nhỏ và nâng ngưỡng, nên
   * vùng lớn nhất luôn còn lại bất kể nằm ở đâu.
   */
  let recordThreshold: number = SCAN_LIMITS.minRecordedUnknownRun;

  const pruneUnknownRuns = (): void => {
    unknownRuns.sort((a, b) => b.length - a.length);
    unknownRuns.length = Math.floor(SCAN_LIMITS.maxUnknownRuns / 2);
    recordThreshold = unknownRuns[unknownRuns.length - 1].length + 1;
  };

  const closeUnknown = (end: number): void => {
    if (unknownStart < 0) return;
    const length = end - unknownStart;
    if (length <= 0) {
      unknownStart = -1;
      return;
    }

    unknownRunCount += 1;
    unknownBytes += length;

    if (length >= SCAN_LIMITS.minLooseScanRun) {
      collectLooseStrings(reader, unknownStart, length, looseStrings);
    }
    if (length >= recordThreshold) {
      unknownRuns.push({ offset: unknownStart, length });
      if (unknownRuns.length >= SCAN_LIMITS.maxUnknownRuns) pruneUnknownRuns();
    }
    unknownStart = -1;
  };

  const skip = (): void => {
    if (unknownStart < 0) unknownStart = pos;
    pos += 1;
  };

  while (pos < size) {
    if (pos >= nextProgressAt) {
      options.onProgress?.(pos / size);
      nextProgressAt = pos + SCAN_LIMITS.progressStepBytes;
    }

    // Mọi mẫu đều mở đầu bằng byte tag; đây là phép loại nhanh cho hàng chục
    // triệu offset còn lại.
    if (bytes[pos] !== TAGS.string) {
      skip();
      continue;
    }

    // Mẫu A — field có tên. Phải thử trước mẫu B, xem chú thích đầu file.
    if (bytes[pos + 1] === TAGS.namedField) {
      const name = readStringToken(
        reader,
        pos + 1,
        NAME_HEURISTICS.maxLength,
        NAME_HEURISTICS.minLength,
      );

      if (name && isPlausibleName(name.text)) {
        closeUnknown(pos);

        if (fields.length >= SCAN_LIMITS.maxFields) {
          truncated = true;
          limitsHit.push(
            `Đã chạm trần ${SCAN_LIMITS.maxFields.toLocaleString("vi-VN")} field — dừng quét ở offset ${pos}.`,
          );
          break;
        }

        const valueOffset = pos + 1 + name.size;
        const inferred = inferValue(reader, valueOffset);

        fields.push({
          nameOffset: pos,
          valueOffset,
          name: name.text,
          kind: inferred.kind,
          valueSize: inferred.size,
          int: inferred.int,
          float: inferred.float,
          text: inferred.text,
          rawHex: reader.hex(valueOffset, VALUE_HEURISTICS.rawHexBytes),
          // 4 byte trước tag: thường là giá trị của field liền trước, hoặc phần
          // đầu bản ghi. Giữ lại để soi ranh giới bản ghi khi giải mã tiếp.
          markerHex: pos >= 4 ? reader.hex(pos - 4, 4) : "",
        });

        // Đoán sai độ dài giá trị cũng không sao: vòng sau sẽ tự tái đồng bộ.
        // Cộng tối thiểu 1 để không bao giờ đứng yên.
        pos = valueOffset + Math.max(1, inferred.size);
        continue;
      }
    }

    // Mẫu B — chuỗi đứng một mình, thường là tên vùng dữ liệu ("DataMananger").
    const token = readStringToken(
      reader,
      pos,
      SCAN_LIMITS.maxLooseStringLength,
      SCAN_LIMITS.minLooseStringLength,
    );
    if (token && /[A-Za-z]/.test(token.text)) {
      closeUnknown(pos);
      if (stringTokens.length < SCAN_LIMITS.maxLooseStrings) {
        stringTokens.push({ offset: pos, text: token.text });
      }
      pos += token.size;
      continue;
    }

    skip();
  }

  closeUnknown(Math.min(pos, size));

  if (recordThreshold > SCAN_LIMITS.minRecordedUnknownRun) {
    limitsHit.push(
      `Danh sách vùng chưa giải mã đã đầy nên chỉ giữ lại vùng từ ${recordThreshold.toLocaleString("vi-VN")} byte trở lên. Tổng số vùng và tổng byte bên dưới vẫn là con số đầy đủ.`,
    );
  }
  if (looseStrings.length >= SCAN_LIMITS.maxLooseStrings) {
    limitsHit.push(
      `Đã chạm trần ${SCAN_LIMITS.maxLooseStrings.toLocaleString("vi-VN")} chuỗi rời — các chuỗi sau không được ghi lại.`,
    );
  }

  options.onProgress?.(1);

  return {
    fields,
    stringTokens,
    unknownRuns,
    unknownRunCount,
    unknownBytes,
    looseStrings,
    bytesScanned: size,
    truncated,
    limitsHit,
  };
}

/**
 * Chuyển kết quả quét thô sang kiểu UI dùng — đúng vai trò mà
 * `lib/football-data.ts` đảm nhiệm cho module Football.
 *
 * Mọi việc format, gom thống kê, cắt bớt để hiển thị đều xảy ra ở đây. Nhờ vậy
 * component chỉ việc in ra, và khi hiểu thêm về định dạng thì sửa tầng thô +
 * file này, không phải sờ vào UI.
 */

import { ByteReader, shannonEntropy } from "./reader";
import {
  COMPRESSION_MAGICS,
  SCAN_LIMITS,
  HIGH_ENTROPY_THRESHOLD,
} from "./heuristics";
import { CM_BNRY_TAG, FBCHUNKS_MAGIC } from "./fbchunks";
import type {
  RawContainer,
  RawField,
  RawScanResult,
  SaveCounters,
  SaveDocument,
  SaveField,
  SaveFieldStat,
  SaveIssue,
  SaveUnknownRegion,
  SaveValueType,
} from "./types";

function matchCompressionMagic(
  bytes: Uint8Array,
  offset: number,
  length: number,
): string | null {
  for (const magic of COMPRESSION_MAGICS) {
    if (magic.bytes.length > length) continue;
    let ok = true;
    for (let i = 0; i < magic.bytes.length; i += 1) {
      if (bytes[offset + i] !== magic.bytes[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return magic.name;
  }
  return null;
}

/** Chuỗi hiển thị cho một field — cắt sẵn để bảng không bị vỡ layout. */
function formatDisplay(field: RawField): string {
  switch (field.kind) {
    case "string":
      return field.text ?? "";
    case "int32":
      return String(field.int ?? "");
    case "float32": {
      const value = field.float ?? 0;
      // 7 chữ số có nghĩa: đủ để thấy giá trị, đủ để giấu nhiễu của float32
      // (7.4 lưu dạng float32 đọc ra 7.400000095367432).
      return Number.isInteger(value) ? String(value) : value.toPrecision(7);
    }
    default:
      return "";
  }
}

function toSaveField(field: RawField, id: number): SaveField {
  const numeric =
    field.kind === "int32"
      ? field.int
      : field.kind === "float32"
        ? field.float
        : null;

  return {
    id,
    offset: field.nameOffset,
    valueOffset: field.valueOffset,
    name: field.name,
    type: field.kind,
    display: formatDisplay(field),
    numeric,
    text: field.text,
    rawHex: field.rawHex,
    markerHex: field.markerHex,
  };
}

/**
 * Gom theo tên field. Bảng này là công cụ khám phá chính: tên nào xuất hiện
 * 40.000 lần thì gần như chắc chắn là field thật của một bản ghi lặp lại, tên
 * xuất hiện đúng một lần thì nhiều khả năng là dương tính giả.
 */
function buildFieldStats(fields: SaveField[]): SaveFieldStat[] {
  const byName = new Map<string, SaveFieldStat>();

  for (const field of fields) {
    const existing = byName.get(field.name);
    if (existing) {
      existing.count += 1;
      if (!existing.types.includes(field.type)) existing.types.push(field.type);
      continue;
    }
    byName.set(field.name, {
      name: field.name,
      count: 1,
      types: [field.type],
      sample: field.display,
    });
  }

  return [...byName.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

function buildUnknownRegions(
  reader: ByteReader,
  raw: RawScanResult,
): SaveUnknownRegion[] {
  // Sắp theo độ dài giảm dần: vùng 2MB liền mạch mới là chỗ đáng đi tìm thuật
  // toán nén, chứ không phải khe 8 byte giữa hai field.
  const sorted = [...raw.unknownRuns].sort((a, b) => b.length - a.length);
  const kept = sorted.slice(0, SCAN_LIMITS.maxUnknownRegionsKept);

  return kept.map((run) => ({
    offset: run.offset,
    length: run.length,
    entropy: shannonEntropy(reader.bytes, run.offset, run.length),
    hexPreview: reader.hex(
      run.offset,
      Math.min(run.length, SCAN_LIMITS.unknownPreviewBytes),
    ),
    compressionGuess: matchCompressionMagic(reader.bytes, run.offset, run.length),
  }));
}

/** Dưới ngưỡng này thì giải thích rõ vì sao độ phủ thấp là bình thường. */
const LOW_COVERAGE_THRESHOLD = 0.05;

function buildIssues(
  container: RawContainer,
  raw: RawScanResult,
  fieldCount: number,
  coverage: number,
  unknownRegions: SaveUnknownRegion[],
): SaveIssue[] {
  const issues: SaveIssue[] = [];

  if (!container.hasFbchunksMagic) {
    issues.push({
      level: "warn",
      message: `Không thấy magic ${FBCHUNKS_MAGIC} ở đầu file (đọc được "${container.magic}"). Vẫn quét bình thường, nhưng có thể đây không phải file save FC.`,
    });
  }
  if (container.cmBnryOffset === null) {
    issues.push({
      level: "warn",
      message: `Không tìm thấy tag ${CM_BNRY_TAG} trong file. Vùng dữ liệu Career Mode chưa được định vị, kết quả bên dưới là quét toàn file.`,
    });
  }
  if (fieldCount === 0) {
    issues.push({
      level: "error",
      message:
        "Không nhận ra field nào. Hoặc file không dùng cấu trúc token mà parser nhận biết, hoặc toàn bộ đã bị nén — xem tab Vùng chưa giải mã.",
    });
  } else if (coverage < LOW_COVERAGE_THRESHOLD) {
    // Đây là chuyện BÌNH THƯỜNG với save FC 26, không phải lỗi. Nói thẳng ra,
    // nếu không người dùng sẽ tưởng parser hỏng khi thấy độ phủ 0,2%.
    issues.push({
      level: "info",
      message:
        "Độ phủ thấp là đúng với định dạng này, không phải parser hỏng: lớp field có tên chỉ bao phủ phần sự kiện Career Mode (chuyển nhượng, email, cột mốc cầu thủ). Phần lớn dung lượng file là bảng nhị phân cố định — cầu thủ, đội, lịch thi đấu — không có tên field đi kèm nên chưa bóc được. Tên đội và tên cầu thủ trong các bảng đó xuất hiện ở tab Chuỗi rời.",
    });
  }

  const highEntropy = unknownRegions.filter(
    (region) => region.entropy >= HIGH_ENTROPY_THRESHOLD,
  ).length;
  if (highEntropy > 0) {
    issues.push({
      level: "info",
      message: `${highEntropy.toLocaleString("vi-VN")} vùng có entropy ≥ ${HIGH_ENTROPY_THRESHOLD} bit/byte — gần như chắc chắn đã nén hoặc mã hoá, không phải TLV bỏ sót.`,
    });
  }

  for (const limit of raw.limitsHit) {
    issues.push({ level: "warn", message: limit });
  }

  return issues;
}

export function buildSaveDocument(params: {
  reader: ByteReader;
  container: RawContainer;
  raw: RawScanResult;
  fileName: string;
  parseMs: number;
}): SaveDocument {
  const { reader, container, raw, fileName, parseMs } = params;

  const fields = raw.fields.map(toSaveField);
  const fieldStats = buildFieldStats(fields);
  const unknownRegions = buildUnknownRegions(reader, raw);

  const counters: SaveCounters = {
    fieldCount: fields.length,
    distinctNameCount: fieldStats.length,
    stringTokenCount: raw.stringTokens.length,
    // Con số đầy đủ từ máy quét, KHÔNG phải độ dài danh sách hiển thị —
    // `unknownRegions` đã bị tỉa để giữ vùng lớn.
    unknownRegionCount: raw.unknownRunCount,
    unknownBytes: raw.unknownBytes,
    looseStringCount: raw.looseStrings.length,
    coverage: reader.size > 0 ? 1 - raw.unknownBytes / reader.size : 0,
  };

  return {
    meta: {
      fileName,
      fileSize: reader.size,
      magic: container.magic,
      isFbchunks: container.hasFbchunksMagic,
      cmBnryOffset: container.cmBnryOffset,
      headerWords: container.headerWords,
      parseMs,
      truncated: raw.truncated,
    },
    counters,
    fields,
    fieldStats,
    stringTokens: raw.stringTokens,
    unknownRegions,
    looseStrings: raw.looseStrings,
    // Lớp cầu thủ đọc độc lập với lớp field tự mô tả; `parseSaveBuffer` điền vào
    // sau. Để `null` ở đây thay vì bỏ trống để kiểu luôn đầy đủ.
    career: null,
    issues: buildIssues(
      container,
      raw,
      fields.length,
      counters.coverage,
      unknownRegions,
    ),
  };
}

/** Danh sách kiểu để UI dựng bộ lọc mà không phải tự bịa union. */
export const SAVE_VALUE_TYPES: SaveValueType[] = [
  "string",
  "int32",
  "float32",
  "none",
];

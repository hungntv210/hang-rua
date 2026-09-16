/**
 * Định dạng số cho module Save Reader.
 *
 * Tách khỏi `lib/format.ts` (đang lo ngày giờ và trạng thái trận) vì hai module
 * không dùng chung khái niệm nào — gộp lại chỉ tạo ra một file tạp hoá.
 */

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("vi-VN");
}

/** Offset dạng thập phân + hex — hex để dán thẳng vào hex editor. */
export function formatOffset(value: number): string {
  return `${value.toLocaleString("vi-VN")} (0x${value.toString(16).toUpperCase()})`;
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Chỉ số slide kế tiếp theo vòng tròn. `length <= 0` trả 0 thay vì NaN. */
export function stepIndex(current: number, length: number, dir: 1 | -1): number {
  if (length <= 0) return 0;
  return (((current + dir) % length) + length) % length;
}

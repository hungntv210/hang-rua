/**
 * Kiểm bảng màu giao diện: mọi cặp chữ/nền khai báo ở TOKEN_PAIRS phải đạt
 * tương phản WCAG >= 4.5:1, đọc thẳng từ tailwind.config.ts.
 *
 *   npm run check:design
 *
 * Có phép đối chứng ở đầu: một cặp cố tình tệ phải bị đánh trượt và một cặp
 * cố tình tốt phải qua — nếu không, "tất cả đạt" có thể chỉ là hàm đo hỏng.
 */
import config from "../tailwind.config";

export interface TokenPair {
  fg: string;
  bg: string;
  label: string;
}

/** Đường dẫn dạng "ink.soft" hoặc "ice"; phần `DEFAULT` được ngầm hiểu. */
export const TOKEN_PAIRS: TokenPair[] = [
  { fg: "ice", bg: "navy", label: "chữ sáng trên khối navy" },
  { fg: "ice", bg: "royal", label: "chữ sáng trên khối royal" },
  { fg: "ink", bg: "aqua", label: "chữ tối trên khối aqua" },
  { fg: "ink", bg: "sky", label: "chữ tối trên khối sky" },
  { fg: "ink", bg: "salmon", label: "chữ tối trên khối salmon" },
  { fg: "ink", bg: "ice", label: "chữ chính trên nền giấy" },
  { fg: "ink.soft", bg: "ice", label: "chữ phụ trên nền giấy" },
  { fg: "ink.mute", bg: "ice", label: "nhãn mờ trên nền giấy" },
  { fg: "ink.mute", bg: "sky.100", label: "nhãn mờ trên pastel sky" },
  { fg: "ink", bg: "sky.100", label: "chữ chính trên pastel sky" },
  { fg: "ink", bg: "aqua.100", label: "chữ chính trên pastel aqua" },
  { fg: "ink", bg: "royal.100", label: "chữ chính trên pastel royal" },
  { fg: "ink", bg: "salmon.100", label: "chữ chính trên pastel salmon" },
  { fg: "win", bg: "win.wash", label: "tín hiệu tốt trên nền nhạt" },
  { fg: "warn", bg: "warn.wash", label: "tín hiệu tạm trên nền nhạt" },
  { fg: "lose", bg: "lose.wash", label: "tín hiệu kém trên nền nhạt" },
  { fg: "royal", bg: "royal.100", label: "chỉ số khá: chữ royal trên nền royal nhạt" },
  { fg: "win", bg: "ice", label: "chữ tín hiệu tốt trên nền giấy" },
  { fg: "warn", bg: "ice", label: "chữ tín hiệu tạm trên nền giấy" },
  { fg: "lose", bg: "ice", label: "chữ tín hiệu kém trên nền giấy" },
];

const MIN_RATIO = 4.5;

function lookup(path: string): string {
  const colors = config.theme?.extend?.colors as Record<string, unknown> | undefined;
  let node: unknown = colors;
  for (const part of path.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  if (node && typeof node === "object") node = (node as Record<string, unknown>).DEFAULT;
  if (typeof node !== "string" || !/^#[0-9a-fA-F]{6}$/.test(node)) {
    throw new Error(`token "${path}" chưa có trong tailwind.config.ts (cần mã #RRGGBB)`);
  }
  return node;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function main() {
  // Đối chứng: hàm đo phải phân biệt được cặp tệ với cặp tốt.
  if (contrast("#777777", "#808080") >= MIN_RATIO) throw new Error("đối chứng hỏng: cặp xám-xám lại đạt");
  if (contrast("#000000", "#FFFFFF") < MIN_RATIO) throw new Error("đối chứng hỏng: đen-trắng lại trượt");

  let failed = 0;
  for (const pair of TOKEN_PAIRS) {
    const ratio = contrast(lookup(pair.fg), lookup(pair.bg));
    const ok = ratio >= MIN_RATIO;
    if (!ok) failed++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${ratio.toFixed(2).padStart(5)}  ${pair.fg} / ${pair.bg}  — ${pair.label}`);
  }
  if (TOKEN_PAIRS.length === 0) throw new Error("không có cặp nào để kiểm");
  if (failed > 0) {
    console.error(`\n${failed}/${TOKEN_PAIRS.length} cặp dưới ${MIN_RATIO}:1`);
    process.exit(1);
  }
  console.log(`\nTẤT CẢ ĐẠT (${TOKEN_PAIRS.length} cặp).`);
}

try {
  main();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

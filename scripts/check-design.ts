/**
 * Kiểm bảng màu giao diện: mọi cặp chữ/nền khai báo ở TOKEN_PAIRS phải đạt
 * tương phản WCAG >= 4.5:1, đọc thẳng từ tailwind.config.ts.
 *
 *   npm run check:design
 *
 * Có phép đối chứng ở đầu: một cặp cố tình tệ phải bị đánh trượt và một cặp
 * cố tình tốt phải qua — nếu không, "tất cả đạt" có thể chỉ là hàm đo hỏng.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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
  { fg: "ink", bg: "pos.gk", label: "vị trí thủ môn trong avatar vàng" },
  { fg: "ice", bg: "pos.df", label: "vị trí hậu vệ trong avatar xanh dương" },
  { fg: "ink", bg: "pos.mf", label: "vị trí tiền vệ trong avatar xanh lá" },
  { fg: "ice", bg: "pos.fw", label: "vị trí tiền đạo trong avatar đỏ" },
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

/**
 * Lớp/token của giao diện tối cũ. Còn sót ở `app/` hay `components/` nghĩa là có
 * nơi chưa chuyển sang giao diện sáng — chữ sáng trên nền sáng, đọc không ra.
 */
const LEGACY = [
  /\b(?:bg|text|border|divide|ring|fill|stroke|from|via|to|decoration)-(?:void|abyss|electric|orchid|sakura|crimson|ghost|mist|grid|jade|amber)\b/,
  /\bglass(?:-strong)?\b/, /\bneon-edge\b/, /\bhud-corner\b/, /\bbrand-jp(?:-vertical)?\b/, /\brule-ticks\b/,
  /\bbrush-(?:ink|stroke)\b/, /\bfont-(?:mono|brush|jp)\b/, /\bshadow-(?:glow|panel(?:-lift)?)\b/,
  /\banimate-(?:sweep|fade-in-up|slide-in-left)\b/, /\btransition-(?:colors|all)\b/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(full);
  }
  return out;
}

/** Trả về danh sách "file:dòng: chuỗi" còn dùng lớp cũ, và số file đã quét. */
export function scanLegacy(roots: string[]): { hits: string[]; scanned: number } {
  const hits: string[] = [];
  let scanned = 0;
  for (const file of roots.flatMap((r) => walk(r))) {
    // globals.css/tailwind.config tự khai báo các lớp mới; chỉ quét nơi DÙNG.
    scanned++;
    readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
      if (LEGACY.some((re) => re.test(line))) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 90)}`);
    });
  }
  return { hits, scanned };
}

/**
 * Lớp CSS tự định nghĩa trong globals.css mà component dùng bằng tên. Thiếu định
 * nghĩa thì KHÔNG có lỗi nào cả — Tailwind bỏ qua tên lạ — nên phần tử chỉ lặng
 * lẽ mất kiểu (đã xảy ra: dọn token cũ xoá nhầm `.skeleton` và `.pop-halftone`).
 */
export const CUSTOM_CLASSES = [
  "plate", "plate-interactive", "focus-ring", "tab", "tab-active", "btn-primary",
  "section-title", "th-cell", "eyebrow", "skeleton", "pop-halftone",
];

/** Trả về các lớp tự định nghĩa đang được dùng nhưng không có trong globals.css. */
export function missingCustomClasses(): string[] {
  const css = readFileSync("app/globals.css", "utf8");
  const sources = ["app", "components"].flatMap((r) => walk(r)).filter((f) => f.endsWith(".tsx"));
  const used = new Set<string>(CUSTOM_CLASSES.filter((c) => c !== "plate-interactive" || true));
  // Mọi tên bắt đầu bằng `pop-` trong mã nguồn cũng phải có định nghĩa.
  for (const file of sources) {
    for (const m of readFileSync(file, "utf8").matchAll(/\bpop-[a-z][a-z-]*\b/g)) {
      if (!/^pop-(in|sm|press|art)$/.test(m[0]) && m[0] !== "pop") used.add(m[0]);
    }
  }
  return [...used].filter((name) => !new RegExp(`\\.${name}(?![\\w-])\\s*[{:,]`).test(css));
}

/**
 * Luật nguồn rút ra từ lỗi đã gặp:
 *  - sticky với `top-<số>` cứng: menu trên cùng cao --header-h, phần tử dính ở
 *    24px sẽ chui xuống dưới nó. Dùng `top-[calc(var(--header-h)+...)]`.
 *  - Pitch phải xử lý Escape: nội dung hiện khi focus phải tắt được bằng phím.
 */
export function sourceRuleViolations(): string[] {
  const out: string[] = [];
  for (const file of walk("components").concat(walk("app")).filter((f) => f.endsWith(".tsx"))) {
    readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
      if (/\bsticky\b[^"`]*\btop-[1-9]\d*\b/.test(line)) out.push(`${file}:${i + 1}: sticky với top cứng, dùng var(--header-h)`);
    });
  }
  if (!readFileSync("components/save/Pitch.tsx", "utf8").includes('"Escape"')) {
    out.push("components/save/Pitch.tsx: thiếu xử lý phím Escape đóng tooltip");
  }
  return out;
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

  // Đối chứng cho phép quét: một dòng cũ phải bị bắt, một dòng mới phải qua.
  if (!LEGACY.some((re) => re.test('className="bg-abyss text-ghost"'))) throw new Error("đối chứng hỏng: lớp cũ lọt");
  if (LEGACY.some((re) => re.test('className="bg-white text-ink"'))) throw new Error("đối chứng hỏng: lớp mới bị bắt");
  const { hits, scanned } = scanLegacy(["app", "components"]);
  if (scanned < 20) throw new Error(`chỉ quét được ${scanned} file — đường dẫn sai?`);
  console.log(`\nquét ${scanned} file tìm lớp giao diện cũ: ${hits.length} chỗ`);
  hits.forEach((h) => console.log("  LEGACY", h));
  if (hits.length > 0) failed += hits.length;
  const missing = missingCustomClasses();
  missing.forEach((m) => console.log("  MISSING CSS", m));
  failed += missing.length;
  const rules = sourceRuleViolations();
  rules.forEach((r) => console.log("  RULE", r));
  failed += rules.length;
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

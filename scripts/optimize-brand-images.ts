/**
 * Nén ảnh thương hiệu sang WebP và giảm về đúng kích thước cần dùng.
 *
 *   npx tsx scripts/optimize-brand-images.ts
 *
 * VÌ SAO CẦN: ảnh gốc đều là PNG 1254–1536px, trong khi hai trong ba ảnh hiển
 * thị ở kích thước rất nhỏ. `logo.png` nặng 1 MB nhưng vẽ ra 36px — thừa khoảng
 * 35 lần. Đổi định dạng thôi không giải quyết được chuyện đó; phải giảm cả
 * kích thước.
 *
 * `maxWidth` đặt theo kích thước hiển thị LỚN NHẤT nhân ~3 (đủ cho màn hình
 * retina), chứ không phải theo kích thước file gốc. Con số hiển thị lấy trực
 * tiếp từ class Tailwind trong component — ghi rõ ở từng dòng để lần sau đổi
 * giao diện thì biết phải sửa gì ở đây.
 *
 * Giữ nguyên file PNG gốc: chúng là bản gốc chất lượng cao, và script này chạy
 * lại được bất cứ lúc nào nếu cần kích thước khác.
 */

import { readFileSync, statSync, writeFileSync } from "node:fs";
import sharp from "sharp";

interface Target {
  file: string;
  /** Bề rộng tối đa sau khi giảm, tính bằng pixel. */
  maxWidth: number;
  /** Nơi ảnh được dùng và kích thước hiển thị thật — căn cứ cho `maxWidth`. */
  usedAt: string;
  /** WebP có kênh alpha thì nên dùng `lossless` cho logo nét; ảnh chụp thì không. */
  quality: number;
}

const TARGETS: Target[] = [
  {
    file: "tokyo-night.png",
    maxWidth: 1600,
    usedAt: "app/page.tsx — hero, khung rộng tối đa 64rem (1024px)",
    quality: 78,
  },
  {
    file: "kame-mascot.png",
    maxWidth: 384,
    usedAt: "app/page.tsx — w-24 (96px), sm:w-32 (128px)",
    quality: 82,
  },
  {
    file: "logo.png",
    maxWidth: 128,
    usedAt: "components/Sidebar.tsx — LogoMark size 36 và 26",
    quality: 88,
  },
];

const DIR = "public/brand/";
const kb = (n: number) => (n / 1024).toFixed(0) + " KB";

async function main(): Promise<void> {
  let before = 0;
  let after = 0;

  for (const target of TARGETS) {
    const src = DIR + target.file;
    const out = src.replace(/\.png$/, ".webp");

    const original = statSync(src).size;
    const meta = await sharp(src).metadata();

    await sharp(readFileSync(src))
      // `withoutEnlargement` để ảnh nhỏ hơn ngưỡng không bị phóng to lên.
      .resize({ width: target.maxWidth, withoutEnlargement: true })
      .webp({ quality: target.quality, effort: 6 })
      .toFile(out);

    const size = statSync(out).size;
    before += original;
    after += size;

    const newMeta = await sharp(out).metadata();
    console.log(
      `${target.file.padEnd(20)} ${meta.width}x${meta.height} ${kb(original).padStart(8)}` +
      `  ->  ${newMeta.width}x${newMeta.height} ${kb(size).padStart(7)}` +
      `  (${(100 - (size / original) * 100).toFixed(0)}% nhẹ hơn)`,
    );
    console.log(`${" ".repeat(20)} dùng ở: ${target.usedAt}`);
  }

  console.log(
    `\nTỔNG: ${kb(before)} -> ${kb(after)} ` +
    `(giảm ${(100 - (after / before) * 100).toFixed(0)}%)`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

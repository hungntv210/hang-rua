/**
 * Gieo `dataset_fc26/base/` từ các bản dump đã có.
 *
 *   npx tsx scripts/seed-fc26-base.ts
 *
 * Mười một bảng cần thiết đều đã nằm trong `dataset_fc26/Live Editor/`, nên không
 * phải mở game để chạy được pipeline lần đầu. Nhưng thư mục đó lẫn 248 bảng
 * gồm cả `career_*`, và có HAI phiên bản `teamplayerlinks` — bản chụp trong
 * career (có đội của người chơi) và bản chụp ngoài career. Asset dùng chung
 * phải lấy bản NGOÀI career.
 *
 * Chạy một lần. Từ lần sau `scripts/fc26-dump-base.lua` ghi thẳng vào
 * `dataset_fc26/base/` nên không cần script này nữa; giữ lại để tái lập được.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { BASE_DIR, BASE_TABLES } from "./fc26-base-tables";

const SRC = "dataset_fc26/Live Editor";

/**
 * Bảng nào phải lấy bản chụp NGOÀI career.
 *
 * `teamplayerlinks` chụp trong career mang số áo và thành viên của đội người
 * chơi đang cầm — dữ liệu của một người, không được nướng vào asset chung.
 */
const PREFER_OUT_OF_CAREER: Record<string, string> = {
  teamplayerlinks: "fc26_teamplayerlinks.KHONG-CO-CAREER.csv",
};

mkdirSync(BASE_DIR, { recursive: true });

let copied = 0;
let missing = 0;
for (const t of BASE_TABLES) {
  const preferred = PREFER_OUT_OF_CAREER[t.name];
  const candidates = [
    ...(preferred ? [join(SRC, preferred)] : []),
    join(SRC, `fc26_${t.name}.csv`),
  ];
  const src = candidates.find((p) => existsSync(p));
  if (!src) {
    console.error(`THIẾU: ${t.name} — thử ${candidates.join(", ")}`);
    missing += 1;
    continue;
  }
  const dst = join(BASE_DIR, `${t.name}.csv`);
  copyFileSync(src, dst);
  console.log(`${t.name.padEnd(18)} ← ${src.split(/[\\/]/).pop()}`);
  copied += 1;
}

console.log(`\n${copied}/${BASE_TABLES.length} bảng đã gieo vào ${BASE_DIR}`);
if (missing) {
  console.error(`${missing} bảng thiếu — chạy scripts/fc26-dump-base.lua trong game.`);
  process.exit(1);
}

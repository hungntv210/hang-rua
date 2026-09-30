/**
 * Dựng `public/fc27/ref.json` — dữ liệu tham chiếu cho trang FC27.
 *
 *   npm run build:fc27
 *
 * Save FC27 chỉ lưu nameid trỏ vào kho tên của bản cài game, và kho tên FC27 đã
 * đánh số lại. Chưa có dump Lua FC27, nên tạm tra tên qua dữ liệu FC26: với mỗi
 * playerId của roster FC26 giữ ngày sinh + nameid FC26 (trang so ngày sinh để
 * chắc là cùng người). Có dump FC27 thì thay asset này.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readCsv, num } from "./csv";
import { BASE_DIR } from "./fc26-base-tables";

const rows = readCsv(join(BASE_DIR, "players.csv"))
  .map((r) => [num(r.playerid), num(r.birthdate), num(r.firstnameid), num(r.lastnameid), num(r.commonnameid)])
  .filter((r) => r[0] > 0)
  .sort((a, b) => a[0] - b[0]);

// playerId mã hoá delta tăng dần, như `shippedIds` của world.json.
const players: number[] = [];
let prev = 0;
for (const [id, dob, fn, ln, cn] of rows) {
  players.push(id - prev, dob, fn, ln, cn);
  prev = id;
}

const world = JSON.parse(readFileSync("public/fc26/world.json", "utf8")) as { nationNames: Record<string, string> };

mkdirSync("public/fc27", { recursive: true });
const out = { builtAt: new Date().toISOString().slice(0, 10), nations: world.nationNames, players };
writeFileSync("public/fc27/ref.json", JSON.stringify(out));
console.log(`public/fc27/ref.json: ${rows.length} cầu thủ, ${Object.keys(world.nationNames).length} quốc gia`);

/**
 * Mọi ô của mọi sơ đồ đều có tên nằm trong bảng vị trí chứ?
 *
 *   npx tsx scripts/check-slot-names.ts
 *
 * Một tên ô không có trong `SLOT_FAMILY` sẽ khiến `fitOf` trả "out" cho MỌI cầu
 * thủ, nên sơ đồ chứa nó bị chấm điểm thấp một cách giả tạo và gần như không bao
 * giờ được chọn. Hỏng theo kiểu im lặng: không lỗi, không cảnh báo, chỉ là một
 * nhóm sơ đồ biến mất khỏi kết quả — đúng loại lỗi mà chỉ phép kiểm bất biến
 * mới bắt được.
 */
import { readFileSync } from "node:fs";

import { familyOf, fitOf } from "../lib/fc26/positions";
import { positionName } from "../lib/save/career/schema";

const j = JSON.parse(readFileSync("public/fc26/formations.json", "utf8")) as {
  formations: Array<{ name: string; pos: number[] }>;
};

const seen = new Map<string, number>();
for (const f of j.formations) {
  for (const c of f.pos) {
    const n = positionName(c);
    seen.set(n, (seen.get(n) ?? 0) + 1);
  }
}

console.log("── sơ đồ ba/năm hậu vệ ──");
for (const f of j.formations) {
  if (/^[35]-/.test(f.name)) {
    console.log(`  ${f.name.padEnd(9)} ${f.pos.map((c) => positionName(c)).join(" ")}`);
  }
}

console.log("\n── mọi tên ô, và có trong bảng vị trí không ──");
let orphan = 0;
for (const [n, c] of [...seen.entries()].sort()) {
  // Một tên KHÔNG có trong bảng thì `familyOf` trả về đúng chính nó, và khi đó
  // chỉ người có đúng vị trí sở trường ấy mới không bị coi là trái vị trí.
  const fam = familyOf(n);
  const known = fam.length > 1 || n === "GK";
  if (!known) orphan += 1;
  console.log(`  ${n.padEnd(6)} x${String(c).padStart(3)}  ${known ? "có" : "KHÔNG CÓ"}`);
}

console.log(`\n${orphan} tên ô không có trong bảng vị trí`);
// Kiểm tỉnh táo: một trung vệ phải hợp với ô trung vệ của sơ đồ ba hậu vệ.
for (const f of j.formations) {
  if (!/^3-/.test(f.name)) continue;
  const names = f.pos.map((c) => positionName(c));
  const backs = names.slice(1, 4);
  console.log(`  ${f.name}: CB vào ${backs.join("/")} → ${backs.map((b) => fitOf("CB", b)).join("/")}`);
  break;
}
process.exit(orphan > 0 ? 1 : 0);

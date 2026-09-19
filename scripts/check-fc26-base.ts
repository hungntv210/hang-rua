/**
 * Kiểm thư mục `dataset_fc26/base/` trước khi bất kỳ bản dựng nào đọc nó.
 *
 *   npx tsx scripts/check-fc26-base.ts
 *
 * Phép kiểm quan trọng nhất KHÔNG phải "có đủ file" mà là **không lẫn dữ liệu
 * career**. Một lượt chạy Lua từ menu chính đã từng ghi đè bản export tốt bằng
 * roster gốc không có đội của người chơi, và nó im lặng hoàn toàn. Thư mục này
 * chỉ được chứa hằng số phiên bản.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { readCsv } from "./csv";
import { BASE_TABLES, BASE_DIR } from "./fc26-base-tables";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

check("thư mục tồn tại", existsSync(BASE_DIR), BASE_DIR);
if (!existsSync(BASE_DIR)) {
  console.log("\nChạy `npx tsx scripts/seed-fc26-base.ts` trước.");
  process.exit(1);
}

const files = readdirSync(BASE_DIR);

// Bất biến số một: không bảng nào của career được lọt vào đây.
const career = files.filter((f) => /^(career_|cm_)/.test(f));
check("KHÔNG có bảng career_* hay cm_*", career.length === 0, career.join(", "));

// Bất biến số hai: không có file mang hậu tố cảnh báo của lần lẫn trước.
const suspicious = files.filter((f) => /KHONG-CO-CAREER|\.bak|\.old/i.test(f));
check("không còn file đặt tên né tránh", suspicious.length === 0, suspicious.join(", "));

for (const t of BASE_TABLES) {
  const p = join(BASE_DIR, `${t.name}.csv`);
  if (!existsSync(p)) {
    check(`${t.name}: có file`, false, p);
    continue;
  }
  const rows = readCsv(p);
  check(`${t.name}: đủ dòng`, rows.length >= t.minRows, `${rows.length} (tối thiểu ${t.minRows})`);
  check(`${t.name}: có cột khoá "${t.key}"`, rows.length > 0 && t.key in rows[0]);
}

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

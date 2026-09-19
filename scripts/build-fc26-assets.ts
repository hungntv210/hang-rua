/**
 * Dựng toàn bộ asset `public/fc26/` từ `dataset_fc26/base/`.
 *
 *   npm run build:fc26
 *
 * ─── VÌ SAO MỘT SCRIPT CHỨ KHÔNG NĂM ────────────────────────────────────────
 *
 * Trước đây có năm script build rời, viết ở năm thời điểm khác nhau, mỗi cái
 * nhận đối số riêng. Phải nhớ chạy đúng thứ tự với đúng đường dẫn chính là
 * nguyên nhân của sự lệch pha đã phải sửa: `dcplayernames` có trong game từ
 * đầu, nhưng bản dựng kho tên không bao giờ được cập nhật để đọc nó, nên 15%
 * cầu thủ mất tên và một dataset công khai 1,9MB phải gánh thay.
 *
 * Một lệnh, một nguồn, mọi asset sinh cùng lúc.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readCsv, num } from "./csv";
import { BASE_DIR } from "./fc26-base-tables";

const OUT_DIR = "public/fc26";
const builtAt = new Date().toISOString().slice(0, 10);
const base = (t: string) => join(BASE_DIR, `${t}.csv`);

mkdirSync(OUT_DIR, { recursive: true });

const write = (name: string, payload: unknown) => {
  const json = JSON.stringify(payload);
  writeFileSync(join(OUT_DIR, name), json);
  console.log(`-> ${name} (${(json.length / 1024).toFixed(0)} KB chưa nén)`);
};

// ── Kho tên ─────────────────────────────────────────────────────────────────
/*
 * HAI bảng, không phải một.
 *
 *   playernames    nameid 0–41.189
 *   dcplayernames  nameid 44.000+   ← tên thêm qua bản cập nhật đội hình
 *
 * Cả `firstnameid`, `lastnameid` và `commonnameid` đều trỏ vào cùng một không
 * gian id trải trên cả hai bảng, nên phải gộp thành MỘT kho.
 */
function buildNames() {
  const text = new Map<number, string>();
  let blank = 0;
  let clash = 0;
  for (const table of ["playernames", "dcplayernames"]) {
    for (const r of readCsv(base(table))) {
      const id = num(r.nameid);
      const s = (r.name ?? "").trim();
      if (id < 0) continue;
      if (!s) {
        // Một id trỏ tới chuỗi rỗng không khác gì id không tồn tại, và giữ lại
        // chỉ làm phía đọc phải kiểm hai lần.
        blank += 1;
        continue;
      }
      // Hai dải hôm nay không giao nhau. Bản cập nhật sau có thể làm giao, nên
      // BÁO RA thay vì im lặng chọn bừa — bảng sau thắng, và con số nói rõ.
      if (text.has(id) && text.get(id) !== s) clash += 1;
      text.set(id, s);
    }
  }
  const id = [...text.keys()].sort((a, b) => a - b);
  console.log(
    `kho tên: ${id.length} mục (bỏ ${blank} rỗng${clash ? `, ${clash} id trùng — bảng sau thắng` : ""})`,
  );
  write("names.json", {
    builtAt,
    /** Bảng gốc, nên không có "độ chính xác" để báo — khác bản suy ra trước đây. */
    exact: true,
    count: id.length,
    /** Kho DUY NHẤT: cả ba chỉ số tên đều trỏ vào đây. */
    pool: { id, text: id.map((k) => text.get(k)!) },
  });
}

buildNames();

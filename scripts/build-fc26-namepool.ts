/**
 * Dựng kho tên FC 26 từ BẢNG GỐC của game, thay cho bản suy ra.
 *
 *   npx tsx scripts/build-fc26-namepool.ts <fc26_playernames.csv> [ra.json]
 *
 * ─── VÌ SAO THAY `build-fc26-names.ts` ──────────────────────────────────────
 *
 * Script cũ SUY RA kho tên: ghép hai bản export, lấy tên đầy đủ mà
 * `GetPlayerName` trả về, tách thành tên và họ, rồi bỏ phiếu đa số khi xung
 * đột. Nó đạt 97,6% và chỉ phủ những chỉ số tên mà career đó tình cờ dùng tới —
 * 6.244 tên và 13.564 họ.
 *
 * Nhưng `playernames` là bảng tên GỐC của game: 41.190 mục, `nameid → name`,
 * không suy diễn gì cả. Và cả ba chỉ số trong bản ghi cầu thủ — `firstnameid`,
 * `lastnameid`, `commonnameid` — đều trỏ vào CÙNG bảng này, chứ không phải ba
 * kho riêng như bản dựng cũ giả định.
 *
 * Đo được chỗ bản cũ thiếu: id 11217 là "Evaristo", 30545 là "Rafa", 3587 là
 * "Banini" — đều vắng mặt, và đều là lý do vài cầu thủ hiện ra dưới dạng
 * `#playerId` trên trang.
 *
 * ─── VẪN LÀ HẰNG SỐ THEO PHIÊN BẢN GAME ─────────────────────────────────────
 *
 * Nướng vào asset là hợp lệ vì mọi career đều rút tên từ cùng bảng này. Khác
 * hẳn việc nướng tên regen của MỘT career: cái đó gieo dữ liệu của người này
 * cho người khác.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [srcPath, outPath = "public/fc26/names.json"] = process.argv.slice(2);
if (!srcPath) {
  console.error("dùng: npx tsx scripts/build-fc26-namepool.ts <fc26_playernames.csv> [ra.json]");
  process.exit(1);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') cur += c;
      else if (line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const text = readFileSync(srcPath, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
const head = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
const iId = head.indexOf("nameid");
const iName = head.indexOf("name");
if (iId < 0 || iName < 0) {
  console.error("CSV phải có cột `nameid` và `name`");
  process.exit(1);
}

const ids: number[] = [];
const names: string[] = [];
let blank = 0;
const seen = new Set<number>();

for (const line of lines.slice(1)) {
  const cells = splitCsvLine(line);
  const id = Number(cells[iId]);
  const name = (cells[iName] ?? "").trim();
  if (!Number.isFinite(id) || id < 0) continue;
  // Mục rỗng bị bỏ hẳn: một id trỏ tới chuỗi rỗng không khác gì id không tồn
  // tại, và giữ lại chỉ làm phía đọc phải kiểm hai lần.
  if (!name) {
    blank += 1;
    continue;
  }
  if (seen.has(id)) continue;
  seen.add(id);
  ids.push(id);
  names.push(name);
}

const payload = {
  source: srcPath,
  builtAt: new Date().toISOString().slice(0, 10),
  /**
   * Bảng gốc, nên không có "độ chính xác" để báo — khác bản suy ra trước đây.
   */
  exact: true,
  count: ids.length,
  /** Kho DUY NHẤT: cả firstnameid, lastnameid và commonnameid đều trỏ vào đây. */
  pool: { id: ids, text: names },
};

mkdirSync(dirname(outPath), { recursive: true });
const json = JSON.stringify(payload);
writeFileSync(outPath, json);

console.log(`${ids.length} tên, bỏ ${blank} mục rỗng`);
console.log(`-> ${outPath} (${(json.length / 1024).toFixed(0)} KB chưa nén)`);

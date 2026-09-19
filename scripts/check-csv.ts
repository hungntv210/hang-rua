/**
 * Kiểm bộ đọc CSV dùng chung.
 *
 *   npx tsx scripts/check-csv.ts
 *
 * Ba trường hợp dưới đây đều CÓ THẬT trong bản dump của game, và mỗi cái từng
 * làm hỏng một bản dựng: BOM ở đầu file, tên đội có dấu phẩy, và dấu nháy kép
 * lồng trong ô đã bọc nháy.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readCsv, splitCsvLine, num } from "./csv";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

check("ô thường", JSON.stringify(splitCsvLine("a,b,c")) === '["a","b","c"]');
check(
  "ô bọc nháy có dấu phẩy",
  JSON.stringify(splitCsvLine('1,"Nott\'m Forest, The",3')) ===
    '["1","Nott\'m Forest, The","3"]',
);
check(
  "nháy kép lồng",
  JSON.stringify(splitCsvLine('1,"He said ""hi""",3')) === '["1","He said \\"hi\\"","3"]',
);
check("ô rỗng cuối dòng", JSON.stringify(splitCsvLine("a,b,")) === '["a","b",""]');

const dir = join(tmpdir(), "hangrua-check-csv");
mkdirSync(dir, { recursive: true });
const p = join(dir, "t.csv");
// BOM ở đầu: bản dump của Live Editor có, và nếu không cắt thì tên cột đầu
// tiên thành "﻿nameid" và mọi phép tra cột đều trượt.
writeFileSync(p, "﻿NameID,Name\r\n1, Alice \r\n2,\"B,b\"\r\n", "utf8");
const rows = readCsv(p);
check("cắt BOM và hạ tên cột về chữ thường", rows[0]?.nameid === "1", JSON.stringify(rows[0]));
check("cắt khoảng trắng hai đầu giá trị", rows[0]?.name === "Alice");
check("giữ dấu phẩy trong ô bọc nháy", rows[1]?.name === "B,b");
check("bỏ dòng rỗng cuối file", rows.length === 2, `${rows.length} dòng`);

// Ba test dưới canh các ranh giới của guard `if (lines.length === 0) return [];`:
// hàm gốc ở build-fc26-squads.ts không có nó, và sẽ ném TypeError trên file rỗng.
// Ba task sau sẽ import module này, nên ranh giới phải có người canh.
const p1 = join(dir, "empty.csv");
writeFileSync(p1, "", "utf8");
check("readCsv: file rỗng hoàn toàn trả mảng rỗng", readCsv(p1).length === 0);

const p2 = join(dir, "header-only.csv");
writeFileSync(p2, "a,b\r\n", "utf8");
check("readCsv: chỉ có dòng tiêu đề trả mảng rỗng", readCsv(p2).length === 0);

const p3 = join(dir, "short-row.csv");
writeFileSync(p3, "a,b,c\r\n1,2\r\n", "utf8");
const rowsShort = readCsv(p3);
check(
  "readCsv: dòng thiếu cột thì ô vắng là chuỗi rỗng",
  rowsShort[0]?.c === "",
  JSON.stringify(rowsShort[0]),
);

check("num: số thường", num("42") === 42);
check("num: ô rỗng trả -1 chứ không phải 0", num("") === -1);
check("num: undefined trả -1", num(undefined) === -1);
check("num: chữ trả -1", num("abc") === -1);

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

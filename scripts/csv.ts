/**
 * Bộ đọc CSV dùng chung cho các script build.
 *
 * Tách ra vì bốn script build đang chép nguyên hàm này của nhau, và chúng đã
 * bắt đầu lệch: một bản cắt BOM, một bản không. Bản dump của Live Editor CÓ
 * BOM, nên bản không cắt sẽ đặt tên cột đầu tiên thành "﻿nameid" và mọi
 * phép tra cột theo tên đều trượt — im lặng, vì cột chỉ trả `undefined`.
 */
import { readFileSync } from "node:fs";

/** Tách một dòng CSV, tôn trọng ô bọc nháy và nháy kép lồng (`""`). */
export function splitCsvLine(line: string): string[] {
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

/** Đọc cả file. Tên cột hạ về chữ thường; giá trị cắt khoảng trắng hai đầu. */
export function readCsv(path: string): Array<Record<string, string>> {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const head = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    head.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

/** Số hoặc `-1`. Ô của game là chuỗi, và `Number("")` là `0` chứ không phải NaN. */
export function num(v: string | undefined): number {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : -1;
}

/**
 * Cổng kiểm của Save Reader FC27.
 *
 *   npm run check:fc27 -- <save FC27 mẫu> <save FC26 bất kỳ>
 *
 * Dự án không có test framework; mỗi khối dưới đây là một nhóm phép kiểm chạy
 * trên file save THẬT, đi hết đường ống từ byte thô. Save không được commit
 * (dữ liệu cá nhân), nên đường dẫn đi vào qua tham số.
 */

import { readFileSync } from "node:fs";

import { Fc27FormatError, unpackSave } from "../lib/fc27/container.ts";
import { findTable, firstDbOffset, openDatabases, readString } from "../lib/fc27/fifadb.ts";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
function throws(fn: () => unknown, kind?: new (...a: never[]) => Error): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    return kind ? e instanceof kind : e instanceof Error;
  }
}

const [samplePath, fc26Path] = process.argv.slice(2);
if (!samplePath || !fc26Path) {
  console.error("Cách dùng: npm run check:fc27 -- <save FC27> <save FC26>");
  process.exit(2);
}
const SAMPLE = new Uint8Array(readFileSync(samplePath));
const FC26SAVE = new Uint8Array(readFileSync(fc26Path));

console.log("\n=== container ===");
const blob = unpackSave(SAMPLE);
check("giải nén đúng kích thước khai báo", blob.length === 17_632_769, String(blob.length));
check("save FC26 bị từ chối", throws(() => unpackSave(FC26SAVE), Fc27FormatError));
check("file rác bị từ chối", throws(() => unpackSave(new Uint8Array(1000)), Fc27FormatError));
check("file cụt ném lỗi, không treo", throws(() => unpackSave(SAMPLE.subarray(0, 3_000_000))));

console.log("\n=== fifadb ===");
const tables = openDatabases(blob);
const czum = findTable(tables, "CZUM");
check("players (CZUM) bản ghi 156 byte", czum?.recordSize === 156, String(czum?.recordSize));
check("players có ≥ 21.000 dòng hợp lệ", (czum?.nValid ?? 0) >= 21_000, String(czum?.nValid));
check("players có trường ykFq", czum?.fields.has("ykFq") === true);
check("DB đầu tiên ở 212.023", firstDbOffset(blob) === 212_023, String(firstDbOffset(blob)));
const czum26 = findTable(openDatabases(FC26SAVE), "CZUM");
check("cùng bộ đọc mở được save FC26 (144 byte)", czum26?.recordSize === 144, String(czum26?.recordSize));
const lyxl = findTable(tables, "lyxL");
const teamName0 = lyxl ? readString(blob, lyxl, 0, lyxl.fields.get("AUsv")!) : "";
check("readString đọc được tên đội", teamName0.length > 0, teamName0);

console.log(failures === 0 ? "\nTẤT CẢ ĐẠT." : `\n${failures} MỤC KHÔNG ĐẠT.`);
process.exitCode = failures === 0 ? 0 : 1;

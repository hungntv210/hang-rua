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
import { readLinks, readPlayers, readTeams } from "../lib/fc27/read-tables.ts";
import { readLoans, readSectionIndex, sectionDelta } from "../lib/fc27/sections.ts";

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

console.log("\n=== tables ===");
const players = readPlayers(blob, tables);
const teams = readTeams(blob, tables);
const links = readLinks(blob, tables);
check("teamid 11 = Man Utd (mỏ neo ngoài)", teams.get(11) === "Man Utd", teams.get(11));
check("teamid 13 = Newcastle (mỏ neo ngoài)", (teams.get(13) ?? "").includes("Newcastle"), teams.get(13));
const bruno = players.get(212198);
check("Bruno POT 90, OVR 89", bruno?.potential === 90 && bruno?.overall === 89, `${bruno?.potential}/${bruno?.overall}`);
check("Mainoo POT 87", players.get(269136)?.potential === 87);
check("Lammens POT 88", players.get(254803)?.potential === 88);
const utd = new Set(links.filter((l) => l.teamId === 11).map((l) => l.playerId));
check("Man Utd có 39 cầu thủ", utd.size === 39, String(utd.size));
const potBelow = [...players.values()].filter((p) => p.potential < p.overall).length;
check("POT ≥ OVR ở mọi cầu thủ", potBelow === 0, String(potBelow));

console.log("\n=== loans ===");
const index = readSectionIndex(SAMPLE, blob);
check("mục lục có khối msnl", index.has("msnl"));
check("độ lệch mục lục suy ra = 1600", sectionDelta(SAMPLE, blob) === 1600, String(sectionDelta(SAMPLE, blob)));
const loans = readLoans(blob, index);
check("msnl có 733 mục", loans.length === 733, String(loans.length));
const utdLoans = loans.filter((l) => l.ownerTeamId === 11).map((l) => `${l.playerId}@${l.until}`).sort();
check(
  "cho mượn của Man Utd = Onana + Koné, hết hạn 2027-06-30",
  utdLoans.join(",") === "226753@2027-06-30,77403@2027-06-30",
  utdLoans.join(","),
);
const broken = blob.slice();
broken[(index.get("msnl") as number) + 25 + 4 * 20 + 9] = 0x07; // hỏng dấu 01 của mục thứ 5
check("msnl sai dấu thì ném lỗi, không đọc rác", throws(() => readLoans(broken, index)));

console.log(failures === 0 ? "\nTẤT CẢ ĐẠT." : `\n${failures} MỤC KHÔNG ĐẠT.`);
process.exitCode = failures === 0 ? 0 : 1;

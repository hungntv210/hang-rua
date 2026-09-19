/**
 * Rút bảng `teamplayerlinks` gốc của game thành asset tĩnh: số áo và mã đội.
 *
 *   npx tsx scripts/build-fc26-squads.ts <fc26_teamplayerlinks.csv> <fc26_teams.csv> [ra.json]
 *
 * ─── VÌ SAO ĐƯỢC PHÉP NƯỚNG VÀO ASSET ──────────────────────────────────────
 *
 * Nguyên tắc của dự án: mọi thứ hiển thị phải đọc từ file save người dùng tải
 * lên. Bảng này là ngoại lệ hợp lệ, cùng hạng với kho tên và hình học sơ đồ —
 * nó là **hằng số theo phiên bản game**, không phải trạng thái career.
 *
 * Và lần này có bằng chứng cho lời khẳng định đó, chứ không chỉ là lời khẳng
 * định: nguồn dùng để dựng file này là một lượt export chạy NGOÀI career mode.
 * Career chưa nạp thì không trạng thái career nào lọt vào được. Đó cũng chính
 * là lượt chạy từng bị coi là hỏng.
 *
 * Phân biệt với thứ KHÔNG được nướng:
 *
 *     jerseynumber   số áo do game phát cho roster gốc      → hằng số ✓
 *     teamid         cầu thủ thuộc CLB nào lúc đầu mùa      → hằng số ✓
 *     position       đội hình xuất phát mặc định            → KHÔNG ghi ra ✗
 *
 * `position` bị bỏ có chủ ý. Nghe thì hấp dẫn — với career mới tinh thì đội
 * hình mặc định đúng là thứ game dùng. Nhưng đo trên save thật: chỉ phủ được
 * 9/11 suất, vì hai cầu thủ trong đội hình mặc định không còn trong đội. Một
 * sơ đồ thủng hai chỗ tệ hơn đội hình gợi ý luôn đủ 11. Và tệ hơn nữa, nó sai
 * ngay khi người chơi xếp lại đội hình mà không có cách nào tự biết — đúng lỗi
 * mà cả nhánh làm việc này sinh ra để sửa.
 *
 * ─── VÌ SAO KHOÁ THEO CẶP (CẦU THỦ, ĐỘI) ───────────────────────────────────
 *
 * Một cầu thủ nằm ở cả CLB lẫn đội tuyển quốc gia, với số áo khác nhau. Khoá
 * theo playerId thì hàng sau ghi đè hàng trước, và số áo CLB biến thành số áo
 * đội tuyển. Đã mắc đúng lỗi này một lần khi đo: nó làm độ phủ đội hình mặc
 * định hiện ra 5/11 thay vì 9/11.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [linksPath, teamsPath, outPath = "public/fc26/squads.json"] = process.argv.slice(2);
if (!linksPath || !teamsPath) {
  console.error(
    "dùng: npx tsx scripts/build-fc26-squads.ts <teamplayerlinks.csv> <teams.csv> [ra.json]",
  );
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

function readCsv(path: string): Array<Record<string, string>> {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
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

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : -1;
};

// ── Tên đội ─────────────────────────────────────────────────────────────────
const teamName = new Map<number, string>();
for (const r of readCsv(teamsPath)) {
  const id = num(r.teamid);
  const name = r.teamname ?? "";
  // Tên giữ chỗ dạng `*TeamName_Abbr15_115486` là CLB do người chơi tự tạo —
  // nó không thuộc dữ liệu gốc của game, và hiện ra thì vô nghĩa.
  if (id > 0 && name && !name.startsWith("*")) teamName.set(id, name);
}

// ── Số áo theo cặp (cầu thủ, đội) ───────────────────────────────────────────
/** teamId → mảng phẳng [playerId, số áo, playerId, số áo, …]. */
const byTeam = new Map<number, number[]>();
let links = 0;
let noJersey = 0;

for (const r of readCsv(linksPath)) {
  const pid = num(r.playerid);
  const team = num(r.teamid);
  const jersey = num(r.jerseynumber);
  if (pid <= 0 || team <= 0) continue;
  links += 1;
  if (jersey <= 0) {
    noJersey += 1;
    continue;
  }
  const list = byTeam.get(team);
  if (list) list.push(pid, jersey);
  else byTeam.set(team, [pid, jersey]);
}

const teams = [...byTeam.keys()].sort((a, b) => a - b);
const payload = {
  source: `${linksPath} + ${teamsPath}`,
  builtAt: new Date().toISOString().slice(0, 10),
  teamCount: teams.length,
  linkCount: links,
  /** Mã đội → tên. Chỉ những đội có tên thật. */
  names: Object.fromEntries(
    teams.filter((t) => teamName.has(t)).map((t) => [String(t), teamName.get(t)!]),
  ),
  /** Mã đội → [playerId, số áo]×n. Mảng phẳng để khỏi lặp tên khoá 23.000 lần. */
  squads: Object.fromEntries(teams.map((t) => [String(t), byTeam.get(t)!])),
};

mkdirSync(dirname(outPath), { recursive: true });
const json = JSON.stringify(payload);
writeFileSync(outPath, json);

console.log(`${links} liên kết cầu thủ-đội, ${noJersey} không có số áo`);
console.log(`${teams.length} đội, ${Object.keys(payload.names).length} đội có tên thật`);
console.log(`-> ${outPath} (${(json.length / 1024).toFixed(0)} KB chưa nén)`);

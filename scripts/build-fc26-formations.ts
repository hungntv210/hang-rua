/**
 * Rút bảng đội hình và sơ đồ của FC 26 thành asset tĩnh cho web.
 *
 *   npx tsx scripts/build-fc26-formations.ts <thu-muc-export> [ra.json]
 *
 * ─── VÌ SAO ĐƯỢC PHÉP NƯỚNG VÀO ASSET TĨNH ──────────────────────────────────
 *
 * Nguyên tắc của dự án: mọi thứ hiển thị phải đọc từ file save người dùng tải
 * lên, không lấy từ career của người khác. Hai bảng này là ngoại lệ hợp lệ, cùng
 * lý do với tên cầu thủ — chúng là **hằng số theo phiên bản game**:
 *
 *   `formations`           871 sơ đồ, kèm toạ độ từng vị trí trên sân
 *   `default_teamsheets`   818 đội hình mặc định
 *
 * Bảng team sheet có lẫn CLB do career tạo ra (CLB của người chạy export). Nướng
 * nó vào vẫn AN TOÀN nhờ cổng khớp ở phía runtime: sơ đồ chỉ được vẽ khi đội
 * hình đọc từ save chứa đủ số cầu thủ của team sheet đó. Career của người khác
 * không thể trùng tập cầu thủ — riêng ID học viện 460xxx đã là career-specific.
 *
 * ─── SUY RA SƠ ĐỒ ───────────────────────────────────────────────────────────
 *
 * `cm_teamsheets.sourceformationid` bằng −1 và `teamformationteamstylelinks`
 * rỗng trong Career Mode, nên KHÔNG có trường nào nói thẳng đội dùng sơ đồ nào.
 * Phải suy: lấy 11 mã vị trí của đội hình xuất phát rồi đối chiếu với
 * `formations.position0..10`. Đo trên 400 đội: 395 ra duy nhất, 5 mơ hồ, 0
 * không khớp.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const dir = process.argv[2];
const outPath = process.argv[3] ?? "public/fc26/formations.json";
if (!dir) {
  console.error(
    "Dùng: npx tsx scripts/build-fc26-formations.ts <thu-muc-export> [ra.json]",
  );
  process.exit(1);
}

function readCsv(name: string): Array<Record<string, string>> {
  const text = readFileSync(join(dir, name), "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const head = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    head.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ────────────────────────────────────────────────────────────────────────────
// Sơ đồ
// ────────────────────────────────────────────────────────────────────────────

interface Formation {
  id: number;
  name: string;
  /** Mã vị trí FIFA (0-27) cho 11 ô, theo thứ tự ô của team sheet. */
  pos: number[];
  /** Toạ độ chuẩn hoá: x 0 (trái) → 1 (phải), y 0 (khung nhà) → 1 (khung đối thủ). */
  off: Array<[number, number]>;
  /** Dùng để gỡ mơ hồ khi hai sơ đồ trùng tập mã vị trí. */
  weight: number;
}

const formations: Formation[] = readCsv("fc26_formations.csv")
  .map((r) => {
    const pos: number[] = [];
    const off: Array<[number, number]> = [];
    for (let i = 0; i < 11; i += 1) {
      pos.push(Math.round(num(r[`position${i}`])));
      off.push([
        Math.round(num(r[`offset${i}x`]) * 1000) / 1000,
        Math.round(num(r[`offset${i}y`]) * 1000) / 1000,
      ]);
    }
    return {
      id: num(r.formationid),
      name: r.formationname ?? "",
      pos,
      off,
      // Sơ đồ thiên về tấn công hơn thì tên thường được dùng làm tên hiển thị.
      weight: num(r.attackers) * 100 + num(r.midfielders),
    };
  })
  .filter((f) => f.name && f.name !== "-NONE-");

/** Tập mã vị trí đã sắp xếp → sơ đồ tiêu biểu. */
const byPositionSet = new Map<string, Formation>();
for (const f of formations) {
  const key = [...f.pos].sort((a, b) => a - b).join(",");
  const cur = byPositionSet.get(key);
  // Trùng tập thì chốt theo `weight` rồi tới id — miễn là TẤT ĐỊNH, vì hình học
  // của hai sơ đồ cùng tập mã gần như giống hệt nhau.
  if (!cur || f.weight > cur.weight || (f.weight === cur.weight && f.id < cur.id)) {
    byPositionSet.set(key, f);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Đội hình
// ────────────────────────────────────────────────────────────────────────────

/** playerId → (teamId → mã vị trí trong đội hình). */
const slotOf = new Map<number, Map<number, number>>();
/** playerId → (teamId → số áo). */
const jerseyOf = new Map<number, Map<number, number>>();
for (const r of readCsv("fc26_teamplayerlinks.csv")) {
  const pid = num(r.playerid);
  const tid = num(r.teamid);
  if (pid <= 0 || tid <= 0) continue;
  if (!slotOf.has(pid)) slotOf.set(pid, new Map());
  if (!jerseyOf.has(pid)) jerseyOf.set(pid, new Map());
  slotOf.get(pid)!.set(tid, num(r.position));
  jerseyOf.get(pid)!.set(tid, num(r.jerseynumber));
}

interface Sheet {
  team: number;
  formation: number;
  xi: number[];
  bench: number[];
  jersey: number[];
}

const sheets: Sheet[] = [];
let unresolved = 0;

for (const r of readCsv("fc26_default_teamsheets.csv")) {
  const team = num(r.teamid);
  if (team <= 0) continue;

  const xi: number[] = [];
  const slots: number[] = [];
  let complete = true;
  for (let i = 0; i < 11; i += 1) {
    const pid = num(r[`playerid${i}`]);
    const slot = slotOf.get(pid)?.get(team);
    if (pid <= 0 || slot === undefined) {
      complete = false;
      break;
    }
    xi.push(pid);
    slots.push(slot);
  }
  if (!complete) continue;

  const key = [...slots].sort((a, b) => a - b).join(",");
  const formation = byPositionSet.get(key);
  if (!formation) {
    unresolved += 1;
    continue;
  }

  const bench: number[] = [];
  for (let i = 11; i < 52; i += 1) {
    const pid = num(r[`playerid${i}`]);
    if (pid > 0) bench.push(pid);
  }

  sheets.push({
    team,
    formation: formation.id,
    xi,
    bench,
    // Số áo đi kèm đội hình, cùng thứ tự XI rồi tới dự bị — bảng cầu thủ trong
    // save không lưu số áo nên đây là nguồn duy nhất.
    jersey: [...xi, ...bench].map((pid) => jerseyOf.get(pid)?.get(team) ?? 0),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Ghi ra
// ────────────────────────────────────────────────────────────────────────────

/** Chỉ giữ sơ đồ thực sự có đội dùng — 871 sơ đồ mà chỉ vài chục được dùng. */
const usedFormations = new Set(sheets.map((s) => s.formation));
const kept = formations.filter((f) => usedFormations.has(f.id));

const payload = {
  source: dir,
  builtAt: new Date().toISOString().slice(0, 10),
  formations: kept.map((f) => ({ id: f.id, name: f.name, pos: f.pos, off: f.off })),
  sheets: sheets.map((s) => [s.team, s.formation, s.xi, s.bench, s.jersey]),
};

mkdirSync(dirname(outPath), { recursive: true });
const json = JSON.stringify(payload);
writeFileSync(outPath, json);

console.log(`${sheets.length} đội hình, ${kept.length}/${formations.length} sơ đồ được dùng`);
if (unresolved > 0) console.log(`  ${unresolved} đội không suy được sơ đồ — bỏ qua`);
console.log(`-> ${outPath} (${(json.length / 1024).toFixed(0)} KB chưa nén)`);

/**
 * Kiểm engine đọc cầu thủ trên file save thật, chạy bằng Node.
 *
 *   npx tsx scripts/probe-career.ts <file-save> [players.csv]
 *
 * Dự án chưa có test framework nên đây là cách kiểm chứng duy nhất có thật.
 * Điểm quan trọng nhất cần kiểm: `locate.ts` TỰ tìm ra bảng, không được mớm
 * offset — một pha lệch sẽ không báo lỗi, nó chỉ trả về số vô nghĩa.
 */

import { readFileSync } from "node:fs";
import { readCareerPlayers } from "../lib/save/career";
import { positionName } from "../lib/save/career/schema";

/** Dataset có ô chứa dấu phẩy trong ngoặc kép (`"CAM, CM"`) nên không tách thô được. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const path = process.argv[2];
if (!path) {
  console.error("Cần đường dẫn file save.");
  process.exit(1);
}

const file = readFileSync(path);
const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

const started = Date.now();
const result = readCareerPlayers(buffer as ArrayBuffer);
const ms = Date.now() - started;

console.log(`file       : ${path} (${(file.length / 1024 / 1024).toFixed(1)} MB)`);
console.log(`thời gian  : ${ms} ms`);
if (!result.table) {
  console.log("KHÔNG định vị được bảng cầu thủ.");
  for (const i of result.issues) console.log(`  ! ${i}`);
  process.exit(1);
}
console.log(`bảng       : offset ${result.table.base}, ${result.table.count} bản ghi`);
console.log(`khoá duy nhất: ${(result.table.keyQuality * 100).toFixed(2)}%`);
console.log(`giải mã    : ${result.players.length} cầu thủ`);
console.log(`tên newgen : ${result.newgenNames.size}`);
for (const i of result.issues) console.log(`  ! ${i}`);

const withOvr = result.players.filter((p) => p.overall !== null);
const withPot = result.players.filter((p) => p.potential !== null);
console.log(`tính được overall: ${withOvr.length}/${result.players.length}`);

const dob = result.players.filter((p) => p.birthDay !== null);
const years = dob.map((p) => new Date((p.birthDay as number) * 86400000).getUTCFullYear());
console.log(`năm sinh   : ${Math.min(...years)}..${Math.max(...years)}`);
const heights = result.players.map((p) => p.heightCm).filter((h): h is number => h !== null);
console.log(`chiều cao  : ${Math.min(...heights)}..${Math.max(...heights)} cm`);
const ovrs = withOvr.map((p) => p.overall as number);
console.log(`overall    : ${Math.min(...ovrs)}..${Math.max(...ovrs)}, trung bình ${(ovrs.reduce((a, b) => a + b, 0) / ovrs.length).toFixed(1)}`);
const pots = withPot.map((p) => p.potential as number);
console.log(`potential  : ${Math.min(...pots)}..${Math.max(...pots)}, trung bình ${(pots.reduce((a, b) => a + b, 0) / pots.length).toFixed(1)}`);

console.log("\n10 cầu thủ newgen tiềm năng cao nhất:");
const named = result.players
  .filter((p) => result.newgenNames.has(p.playerId))
  .sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0))
  .slice(0, 10);
for (const p of named) {
  const n = result.newgenNames.get(p.playerId)!;
  const born = p.birthDay === null ? "?" : new Date(p.birthDay * 86400000).toISOString().slice(0, 10);
  console.log(
    `  ${n.full.padEnd(22)} ${String(p.playerId).padStart(8)} ${positionName(p.positionCode).padEnd(4)} ` +
    `OVR ${String(p.overall ?? "-").padStart(3)}  POT ${String(p.potential ?? "-").padStart(3)}  ${born}  ${p.heightCm}cm`,
  );
}

// Đối chiếu với dataset khi được đưa vào — kiểm được cả phần ghép tên.
const csvPath = process.argv[3];
if (csvPath) {
  const lines = readFileSync(csvPath, "utf8").split(/\r?\n/);
  const head = splitCsvLine(lines[0]);
  const idIdx = head.indexOf("player_id");
  const nameIdx = head.indexOf("short_name");
  const ovrIdx = head.indexOf("overall");
  const known = new Map<number, { name: string; ovr: number }>();
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i]) continue;
    const f = splitCsvLine(lines[i]);
    const id = Number(f[idIdx]);
    if (Number.isFinite(id)) known.set(id, { name: f[nameIdx], ovr: Number(f[ovrIdx]) });
  }
  let matched = 0;
  let within1 = 0;
  let scored = 0;
  for (const p of result.players) {
    const k = known.get(p.playerId);
    if (!k) continue;
    matched += 1;
    if (p.overall !== null && Number.isFinite(k.ovr)) {
      scored += 1;
      if (Math.abs(p.overall - k.ovr) <= 1) within1 += 1;
    }
  }
  console.log(`\nghép dataset: ${matched}/${result.players.length} (${((matched / result.players.length) * 100).toFixed(1)}%)`);
  console.log(`overall lệch ≤1 so với dataset: ${((within1 / scored) * 100).toFixed(1)}% (phần còn lại gồm cả drift do title update và phát triển trong career)`);

  console.log("\n5 cầu thủ thật OVR cao nhất:");
  const top = result.players
    .filter((p) => known.has(p.playerId) && p.overall !== null)
    .sort((a, b) => (b.overall as number) - (a.overall as number))
    .slice(0, 5);
  for (const p of top) {
    const k = known.get(p.playerId)!;
    const born = p.birthDay === null ? "?" : new Date(p.birthDay * 86400000).toISOString().slice(0, 10);
    console.log(
      `  ${k.name.padEnd(20)} ${positionName(p.positionCode).padEnd(4)} OVR ${p.overall} (dataset ${k.ovr})  ` +
      `POT ${p.potential}  ${born}  ${p.heightCm}cm ${p.weightKg}kg`,
    );
  }
}

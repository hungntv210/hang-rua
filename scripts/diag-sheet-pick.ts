/**
 * Sheet nào dựng được sơ đồ, và bản export có còn khớp file save không?
 *
 *   npx tsx scripts/diag-sheet-pick.ts <thu-muc-export> [save]
 *
 * Đưa thêm đường dẫn save thì in luôn kết quả cổng chặn thời điểm cho từng
 * sheet — dùng để trả lời "vì sao export của tôi không được dùng".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EXPORT_FILES, parseCareerExport, validateAgainstSave } from "../lib/fc26/career-export";
import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodeAllPlayers } from "../lib/save/career/players";
import { findSquads } from "../lib/save/career/squad";

const dir = process.argv[2] ?? "dataset_fc26/Live Editor";
const savePath = process.argv[3];
const files = new Map<string, string>();
for (const n of Object.values(EXPORT_FILES)) {
  files.set(n.toLowerCase(), readFileSync(join(dir, n), "utf8"));
}
const r = parseCareerExport(files);
if (!r.ok) {
  console.log("không đọc được export:", r.reason);
  process.exit(1);
}

const shapes: Array<{ name: string; pos: number[] }> = JSON.parse(
  readFileSync("public/fc26/formations.json", "utf8"),
).formations;
const byKey = new Map(shapes.map((f) => [[...f.pos].sort((a, b) => a - b).join(","), f.name]));

/** Đội hình đọc từ save, nếu có đưa vào. */
let saveSquad: Set<number> | null = null;
if (savePath) {
  const bytes = new Uint8Array(readFileSync(savePath));
  const loc = locatePlayerTable(bytes);
  if (loc) {
    const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);
    const ids = new Set(decodeAllPlayers(reader, loc.count).map((p) => p.playerId));
    const blocks = findSquads(bytes, ids)
      .map((s) => s.playerIds)
      .sort((a, b) => b.length - a.length);
    if (blocks[0]) saveSquad = new Set(blocks[0]);
    console.log(`save: khối đội hình lớn nhất có ${blocks[0]?.length ?? 0} cầu thủ`);
  }
}

for (const s of r.data.sheets) {
  const xi = s.slots.slice(0, 11);
  const codes = xi.map((p) => r.data.slotCodeOf.get(p) ?? -1);
  const key = [...codes].sort((a, b) => a - b).join(",");
  console.log(`\nsheet "${s.name}"`);
  console.log(`  XI       : ${xi.join(" ")}`);
  console.log(`  mã vị trí: ${codes.join(" ")}`);
  console.log(`  thiếu mã : ${codes.filter((c) => c < 0).length}`);
  console.log(`  ngoài 0-27: ${codes.filter((c) => c >= 28).length}`);
  console.log(`  sơ đồ khớp: ${byKey.get(key) ?? "KHÔNG CÓ"}`);
  if (saveSquad) {
    const gate = validateAgainstSave(s, saveSquad);
    console.log(`  cổng chặn : ${gate.ok ? "QUA" : "TRƯỢT"} — ${gate.message}`);
    const filled = s.slots.filter((p) => p > 0);
    const gone = filled.filter((p) => !saveSquad!.has(p));
    if (gone.length > 0) {
      console.log(`  không còn trong save: ${gone.length} cầu thủ — ${gone.slice(0, 8).join(", ")}`);
    }
  }
}

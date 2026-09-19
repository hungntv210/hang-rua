/** Sheet nào dựng được sơ đồ, và vì sao sheet kia không? */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EXPORT_FILES, parseCareerExport } from "../lib/fc26/career-export";

const dir = process.argv[2] ?? "dataset_fc26/Live Editor";
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
}

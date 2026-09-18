/**
 * Sơ đồ có THẬT SỰ đổi theo đội hình không?
 *
 *   npx tsx scripts/check-formation-fit.ts
 *
 * Đây là phép kiểm cho đúng điều người dùng yêu cầu: "các file save khác nhau
 * thì vẫn sẽ có các formation khác nhau". Ba save thật của cùng một CLB đều ra
 * cùng một sơ đồ — đúng, vì cùng một đội — nhưng nó KHÔNG chứng minh được bộ
 * chọn có phản ứng với đội hình hay chỉ đang trả về một sơ đồ cố định.
 *
 * Nên ở đây dựng những đội hình giả có hình dạng rất khác nhau và khẳng định sơ
 * đồ chọn ra phải khác nhau. Một bộ chọn hỏng — luôn trả về một sơ đồ — sẽ trượt
 * phép kiểm này trong khi vẫn qua được mọi phép kiểm trên save thật.
 */
import { readFileSync } from "node:fs";

import { buildLineup, type FormationShape, type LineupPlayer } from "../lib/fc26/lineup";
import { positionName } from "../lib/save/career/schema";

const shapes: FormationShape[] = JSON.parse(
  readFileSync("public/fc26/formations.json", "utf8"),
).formations;

console.log(`${shapes.length} sơ đồ: ${shapes.map((f) => f.name).join(", ")}\n`);

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

function build(spec: Record<string, number>) {
  const players: LineupPlayer[] = [];
  let id = 1;
  for (const [position, n] of Object.entries(spec)) {
    for (let i = 0; i < n; i += 1) players.push({ playerId: id++, position, overall: 75 });
  }
  const byId = new Map(players.map((p) => [p.playerId, p]));
  return buildLineup(players.map((p) => p.playerId), byId, shapes, positionName);
}

const CASES: Array<[string, Record<string, number>]> = [
  ["ba tiền đạo, ba trung vệ", { GK: 2, CB: 5, LB: 1, RB: 1, CDM: 2, CM: 3, ST: 2, LW: 2, RW: 2 }],
  ["không tiền đạo cánh", { GK: 2, CB: 4, LB: 2, RB: 2, CDM: 2, CM: 4, CAM: 2, ST: 4 }],
  ["nhiều tiền vệ cánh", { GK: 2, CB: 4, LB: 2, RB: 2, CM: 3, LM: 3, RM: 3, ST: 3 }],
  ["toàn trung vệ", { GK: 2, CB: 10, CM: 6, ST: 4 }],
  ["hậu vệ cánh dâng cao", { GK: 2, CB: 5, LWB: 3, RWB: 3, CM: 4, CAM: 2, ST: 3 }],
];

const picked: string[] = [];
for (const [label, spec] of CASES) {
  const l = build(spec);
  check(`dựng được: ${label}`, l !== null);
  if (!l) continue;
  picked.push(l.formationName);
  console.log(
    `       ${label.padEnd(26)} → ${l.formationName}  (${l.exactCount}/11 đúng sở trường)`,
  );
}

const distinct = new Set(picked);
check(
  "sơ đồ đổi theo hình dạng đội hình",
  distinct.size >= 3,
  `${distinct.size} sơ đồ khác nhau trên ${picked.length} đội: ${[...distinct].join(", ")}`,
);

// Đội quá ít người thì phải trả null chứ không dựng bừa.
check("dưới 11 người thì không dựng", build({ GK: 1, CB: 4, CM: 3 }) === null);

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

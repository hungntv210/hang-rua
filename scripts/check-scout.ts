/**
 * Kiểm bộ lọc Scout.
 *
 *   npx tsx scripts/check-scout.ts <save…>
 *
 * ─── VÌ SAO CẦN CỔNG NÀY ────────────────────────────────────────────────────
 *
 * Lọc sai mà kết quả vẫn trông hợp lý là loại lỗi không ai phát hiện bằng mắt:
 * một bảng 200 cầu thủ thiếu mất 30 người trông y hệt một bảng đúng. Nên các
 * phép kiểm dưới đây là về TÍNH CHẤT của phép lọc, không phải về con số cụ thể.
 *
 * Lời hứa trung tâm của tab Scout là "không có ai trong đội bạn ở đây". Nó
 * được kiểm với mọi bộ lọc, không chỉ bộ lọc rỗng.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { EMPTY_CRITERIA, filterPlayers, type ScoutCriteria } from "../lib/fc26/scout";
import { Fc26World } from "../lib/fc26/world";
import { pickSquad, type LineupPlayer } from "../lib/fc26/lineup";
import { parseSaveBuffer } from "../lib/save";
import type { SavePlayer } from "../lib/save/types";

if (process.argv.length <= 2) {
  console.log("FAIL  không có file save nào được truyền vào — cổng này không kiểm được gì");
  process.exit(1);
}

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

/*
 * Phép kiểm trên dữ liệu dựng tay: các ô `null`.
 *
 * Chạy trước save thật vì nó không phụ thuộc file nào, và vì `null` là chỗ bộ
 * lọc dễ sai nhất — "không biết thì cho qua" là hành vi SAI ở đây: nó đưa vào
 * kết quả đúng những dòng mà người dùng vừa bảo là không muốn thấy.
 */
const fake = (over: Partial<SavePlayer>): SavePlayer =>
  ({
    playerId: 1,
    name: "x",
    nameSource: "database",
    club: null,
    league: null,
    nation: null,
    position: "ST",
    overall: null,
    potential: null,
    birthDate: null,
    age: null,
    heightCm: null,
    weightKg: null,
    contractUntil: null,
    ...over,
  }) as unknown as SavePlayer;

const nulls = [fake({ playerId: 1 }), fake({ playerId: 2, age: 20, overall: 70, potential: 80 })];
check(
  "ô null bị loại bởi lọc tuổi tối thiểu",
  filterPlayers(nulls, { ...EMPTY_CRITERIA, minAge: 18 }).length === 1,
);
check(
  "ô null bị loại bởi lọc chỉ số tối thiểu",
  filterPlayers(nulls, { ...EMPTY_CRITERIA, minOverall: 60 }).length === 1,
);
check(
  "ô null bị loại bởi lọc tiềm năng tối thiểu",
  filterPlayers(nulls, { ...EMPTY_CRITERIA, minPotential: 60 }).length === 1,
);
check(
  "ô null bị loại bởi lọc còn tăng tối thiểu",
  filterPlayers(nulls, { ...EMPTY_CRITERIA, minGrowth: 5 }).length === 1,
);
check("danh sách rỗng ra rỗng, không ném", filterPlayers([], EMPTY_CRITERIA).length === 0);
check(
  "excludeIds null nghĩa là không loại ai",
  filterPlayers(nulls, { ...EMPTY_CRITERIA, excludeIds: null }).length === 2,
);

// ── Phép kiểm trên save thật ───────────────────────────────────────────────
const world = Fc26World.fromPayload(
  JSON.parse(readFileSync("public/fc26/world.json", "utf8")),
);

for (const path of process.argv.slice(2)) {
  const label = basename(path);
  const bytes = readFileSync(path);
  const doc = parseSaveBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    { fileName: label, shippedIds: world.shippedIds() },
  );
  const players = doc.career?.players ?? [];
  check(`${label}: đọc được cầu thủ`, players.length > 0, `${players.length}`);
  if (players.length === 0) continue;

  const byId = new Map<number, LineupPlayer>(
    players.map((p) => [
      p.playerId,
      { playerId: p.playerId, position: p.position, overall: p.overall },
    ]),
  );
  const squad = pickSquad(doc.career?.squads ?? [], byId) ?? [];
  const exclude = new Set(squad);
  check(`${label}: nhận ra đội người chơi`, squad.length >= 11, `${squad.length} cầu thủ`);

  const base: ScoutCriteria = { ...EMPTY_CRITERIA, excludeIds: exclude };

  // Lời hứa trung tâm của tab, kiểm với NHIỀU bộ lọc chứ không chỉ bộ lọc rỗng.
  const variants: Array<[string, ScoutCriteria]> = [
    ["không lọc gì", base],
    ["TN ≥ 80", { ...base, minPotential: 80 }],
    ["tuổi 16–21", { ...base, minAge: 16, maxAge: 21 }],
    ["chỉ thủ môn", { ...base, groups: ["GK"] }],
    ["còn tăng ≥ 10", { ...base, minGrowth: 10 }],
    ["tìm chữ a", { ...base, query: "a" }],
  ];
  let leaked = 0;
  for (const [, c] of variants) {
    for (const p of filterPlayers(players, c)) if (exclude.has(p.playerId)) leaked += 1;
  }
  check(`${label}: không ai trong đội bạn lọt vào Scout`, leaked === 0, `${leaked} người lọt`);

  check(
    `${label}: không lọc gì = tổng trừ quân số đội`,
    filterPlayers(players, base).length === players.length - squad.length,
  );

  // Lọc chặt hơn phải ra tập con của lọc lỏng hơn.
  const loose = new Set(
    filterPlayers(players, { ...base, minPotential: 80 }).map((p) => p.playerId),
  );
  const tight = filterPlayers(players, { ...base, minPotential: 80, minAge: 16, maxAge: 21 });
  check(
    `${label}: lọc chặt là tập con của lọc lỏng`,
    tight.every((p) => loose.has(p.playerId)),
    `${tight.length} ⊂ ${loose.size}`,
  );

  // Mọi người trong kết quả phải thoả mọi điều kiện đang bật.
  const strict = filterPlayers(players, {
    ...base,
    minAge: 18,
    maxAge: 24,
    minPotential: 75,
    groups: ["FW"],
  });
  check(
    `${label}: kết quả thoả mọi điều kiện đang bật`,
    strict.every(
      (p) =>
        p.age !== null &&
        p.age >= 18 &&
        p.age <= 24 &&
        p.potential !== null &&
        p.potential >= 75,
    ),
    `${strict.length} cầu thủ`,
  );
}

console.log(failed === 0 ? "\nĐẠT" : `\n${failed} phép kiểm TRƯỢT`);
process.exit(failed === 0 ? 0 : 1);

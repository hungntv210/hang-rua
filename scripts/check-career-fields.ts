/**
 * Kiểm đầu-cuối ba trường mới, chạy qua ĐÚNG đường đi mà trang dùng.
 *
 *   npx tsx scripts/check-career-fields.ts <save> <fc26_players.csv>
 *
 * Khác `probe-contract.ts`: bộ dò kia đọc bit trực tiếp để TÌM offset. Script
 * này gọi `decodePlayer` — cùng hàm mà worker gọi — nên nó kiểm cả `schema.ts`,
 * `players.ts` lẫn `adapter.ts`. Một offset đúng trong bảng tra mà nối dây sai
 * vẫn cho ra bảng sai, và bộ dò không bắt được chuyện đó.
 */
import { readFileSync } from "node:fs";

import { estimateValue, formatMoney } from "../lib/fc26/value";
import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodePlayer } from "../lib/save/career/players";
import { CORE_FIELDS } from "../lib/save/career/schema";

const DAY_MS = 86_400_000;
/** Lệch giữa gốc ngày của DB và gốc của trường 15 bit trong save. Xem `schema.ts`. */
const EPOCH = 131_072;
const BIRTH_ADD = 10_356;

const [savePath, csvPath] = process.argv.slice(2);
if (!savePath || !csvPath) {
  console.error("dùng: npx tsx scripts/check-career-fields.ts <save> <fc26_players.csv>");
  process.exit(1);
}

const bytes = new Uint8Array(readFileSync(savePath));
const loc = locatePlayerTable(bytes);
if (!loc) {
  console.error("không định vị được bảng cầu thủ");
  process.exit(1);
}
const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);

const text = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
const ci = (n: string) => cols.indexOf(n);
const iId = ci("playerid_key") >= 0 ? ci("playerid_key") : ci("playerid");

const truth = new Map<number, string[]>();
for (const l of lines.slice(1)) {
  const cells = l.split(",");
  truth.set(Number(cells[iId]), cells);
}

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const contract = { seen: 0, hit: 0 };
const joined = { seen: 0, hit: 0 };
let nullContract = 0;
let joinedOutOfRange = 0;
const sample: string[] = [];

for (let i = 0; i < loc.count; i += 1) {
  const pid = reader.field(i, CORE_FIELDS.playerId.bit, CORE_FIELDS.playerId.width);
  if (pid === null) continue;
  const cells = truth.get(pid);
  if (!cells) continue;
  const p = decodePlayer(reader, i);
  if (!p) continue;

  const wantContract = Number(cells[ci("contractvaliduntil")]);
  if (Number.isFinite(wantContract)) {
    contract.seen += 1;
    if (p.contractUntil === wantContract) contract.hit += 1;
  }
  if (p.contractUntil === null) nullContract += 1;

  const wantJoin = Number(cells[ci("playerjointeamdate")]);
  if (Number.isFinite(wantJoin)) {
    joined.seen += 1;
    // `joinedDay` đã quy về ngày Unix, cột export vẫn ở gốc DB.
    if (p.joinedDay !== null && p.joinedDay + EPOCH + BIRTH_ADD === wantJoin) joined.hit += 1;
  }
  if (p.joinedDay !== null) {
    const y = new Date(p.joinedDay * DAY_MS).getUTCFullYear();
    if (y < 1990 || y > 2050) joinedOutOfRange += 1;
  }

  if (sample.length < 6 && p.overall !== null) {
    sample.push(
      `  #${pid} ${String(p.overall).padStart(2)}/${p.potential} ` +
        `hết HĐ ${p.contractUntil} · gia nhập ${
          p.joinedDay === null ? "—" : new Date(p.joinedDay * DAY_MS).toISOString().slice(0, 10)
        }`,
    );
  }
}

console.log(`đối chiếu ${contract.seen} cầu thủ\n`);
check(
  "hạn hợp đồng khớp tuyệt đối",
  contract.hit === contract.seen,
  `${contract.hit}/${contract.seen} = ${((contract.hit / contract.seen) * 100).toFixed(4)}%`,
);
check("hạn hợp đồng không có ô trống", nullContract === 0, `${nullContract} ô trống`);
check(
  "ngày gia nhập khớp tuyệt đối",
  joined.hit === joined.seen,
  `${joined.hit}/${joined.seen} = ${((joined.hit / joined.seen) * 100).toFixed(4)}%`,
);
check("ngày gia nhập nằm trong dải hợp lý", joinedOutOfRange === 0, `${joinedOutOfRange} ngoài dải`);

console.log("\nmẫu:");
for (const s of sample) console.log(s);

// Mô hình giá trị: không có ground truth, nên chỉ kiểm tính đơn điệu và bậc độ lớn.
console.log("\n── mô hình giá trị (không có ground truth, chỉ kiểm tính hợp lý) ──");
const grid: Array<[number, number, number]> = [
  [90, 92, 26],
  [85, 88, 22],
  [80, 85, 19],
  [75, 75, 29],
  [70, 88, 18],
  [70, 70, 34],
  [62, 62, 24],
];
for (const [ovr, pot, age] of grid) {
  console.log(`  CS ${ovr} TN ${pot} tuổi ${age} → ${formatMoney(estimateValue(ovr, pot, age))}`);
}
const young = estimateValue(85, 88, 22)!;
const old = estimateValue(85, 88, 34)!;
check(
  "cùng chỉ số thì cầu thủ 22 tuổi đắt hơn 34 tuổi",
  young > old,
  `${formatMoney(young)} > ${formatMoney(old)}`,
);
const highPot = estimateValue(70, 88, 18)!;
const lowPot = estimateValue(70, 70, 18)!;
check(
  "cùng chỉ số cùng tuổi thì tiềm năng cao đắt hơn",
  highPot > lowPot,
  `${formatMoney(highPot)} > ${formatMoney(lowPot)}`,
);
check("thiếu đầu vào thì trả null", estimateValue(null, 80, 20) === null);

process.exit(failed ? 1 : 0);

/**
 * Tự kiểm phần xuất file — cùng lối với `probe-save.ts`, chạy trên dữ liệu dựng
 * sẵn chứ không cần file save thật.
 *
 *   npx tsx scripts/check-export.ts
 *
 * Bốn thứ được canh ở đây đều là loại hỏng âm thầm: không có cái nào báo lỗi lúc
 * chạy, người dùng chỉ phát hiện khi đã mở file lên và thấy sai.
 *
 *   1. BOM UTF-8 — thiếu thì Excel trên Windows đọc tên tiếng Việt thành rác.
 *   2. Số ô mỗi dòng khớp header — lệch một cột thì mọi chỉ số dịch chỗ.
 *   3. Ô trống ≠ số 0 — "không đọc được" và "chỉ số bằng 0" phải phân biệt được.
 *   4. Tên cầu thủ có mặt — chính là lỗi mà module này sinh ra để chặn.
 */

import { diagnosticsToJson, playersToCsv, playersToJson } from "../lib/save/career/export";
import { ATTRIBUTE_ORDER } from "../lib/save/career/schema";
import type { SaveDocument, SavePlayer } from "../lib/save/types";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

/** Tách một dòng CSV theo RFC 4180. Đủ dùng để kiểm, không phải parser tổng quát. */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') cur += c;
      else if (line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const base: SavePlayer = {
  playerId: 1, name: null, nameSource: null, club: null, league: null, nation: null,
  position: "CM", overall: 70, potential: 80, birthDate: "2000-01-01", age: 26,
  heightCm: 180, weightKg: 75, skillMoves: 3, weakFoot: 3, internationalReputation: 1,
  nationalityId: 45, firstNameId: 1476, lastNameId: 33183, commonNameId: 0, gender: 0,
  contractUntil: 2028, joinedDate: "2024-07-01", valueEstimate: 4_200_000,
  attributes: ATTRIBUTE_ORDER.map((_, i) => 50 + (i % 40)),
};

const players: SavePlayer[] = [
  { ...base, playerId: 460021, name: "Ren Imada", nameSource: "newgen", overall: 66, potential: 94 },
  { ...base, playerId: 2, name: 'Nguyễn Văn A, Jr. "Tèo"', nameSource: "database", club: "Hà Nội FC" },
  { ...base, playerId: 3, overall: null, potential: null, attributes: [] },
];

const doc = {
  meta: { fileName: "career.sav" }, counters: {}, issues: [], fields: [], fieldStats: [],
  stringTokens: [], unknownRegions: [], looseStrings: [],
  career: {
    // Cố ý để `name: null` — đúng trạng thái worker trả về, trước khi ghép DB.
    players: players.map((p) => ({ ...p, name: null, nameSource: null })),
    tableCount: 3, tableOffset: 9046300, newgenCount: 1, droppedCount: 0, truncated: false,
  },
} as unknown as SaveDocument;

console.log("CSV");
const csv = playersToCsv(players);
const lines = csv.split("\r\n").filter(Boolean);
check("có BOM UTF-8", csv.charCodeAt(0) === 0xfeff);

const header = cells(lines[0].replace(/^\uFEFF/, ""));
check("đủ cột", header.length === 20 + ATTRIBUTE_ORDER.length, `${header.length} cột`);

const lech = lines.slice(1).filter((l) => cells(l).length !== header.length).length;
check("mọi dòng khớp header", lech === 0, `${lech} dòng lệch`);

check(
  "tên có dấu phẩy và dấu nháy được bọc đúng",
  cells(lines[2])[1] === 'Nguyễn Văn A, Jr. "Tèo"',
);

const thieu = cells(lines[3]);
// Tra cột theo TÊN, không theo số thứ tự viết cứng. Bản trước dùng số 9 và 17;
// khi thêm ba cột vào giữa, phép kiểm vẫn chạy nhưng soi nhầm cột — nó báo hỏng
// vì lý do không liên quan tới thứ nó kiểm.
const at = (ten: string) => {
  const i = header.indexOf(ten);
  if (i < 0) throw new Error(`CSV thiếu cột "${ten}"`);
  return thieu[i];
};
// Cột chỉ số đầu tiên neo theo cột cuối cùng của phần thông tin chung, nên thêm
// cột ở giữa không làm phép kiểm soi nhầm chỗ.
const chiSoDau = header[header.indexOf("Danh tiếng") + 1];
check(
  "chỉ số không đọc được để ô trống, không phải 0",
  at("CS (tính)") === "" && at(chiSoDau) === "",
);

console.log("\nJSON");
const json = playersToJson(doc, players) as {
  players: Array<{ name: string | null; attributes: Record<string, number | null> }>;
  ghiChuNguonGoc: Record<string, string>;
};
check("giữ được tên cầu thủ", json.players[0].name === "Ren Imada");
check(
  "chỉ số có tên khoá",
  Object.keys(json.players[0].attributes).length === ATTRIBUTE_ORDER.length,
);
check("kèm cảnh báo CLB gốc", /KHÔNG phải CLB hiện tại/.test(json.ghiChuNguonGoc.club));

const diag = diagnosticsToJson(doc) as { career: Record<string, unknown> | null };
check("bản chẩn đoán KHÔNG kèm danh sách cầu thủ", !("players" in (diag.career ?? {})));
check("bản chẩn đoán vẫn giữ thống kê bảng", diag.career?.tableCount === 3);

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed === 0 ? 0 : 1);

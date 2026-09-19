/**
 * Kiểm `world.json`.
 *
 *   npx tsx scripts/check-fc26-world.ts
 *
 * Bất biến quan trọng nhất giữ nguyên từ `check-squads.ts`: asset KHÔNG được
 * chứa đội hình xuất phát. Cột `position` bị cố ý bỏ khỏi file; ai thêm lại
 * thì lỗi đã gỡ bỏ một lần quay lại, và quay lại im lặng.
 */
import { readFileSync } from "node:fs";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const raw = readFileSync("public/fc26/world.json", "utf8");
const w = JSON.parse(raw);

check("KHÔNG chứa mã vị trí (đội hình xuất phát)", !raw.includes('"position'));
check("có đội", Object.keys(w.squads ?? {}).length > 700, `${w.teamCount} đội`);
check("có tên đội", Object.keys(w.names ?? {}).length > 700);
check("có tên giải", Object.keys(w.leagueNames ?? {}).length >= 40);
check("có tên quốc gia", Object.keys(w.nationNames ?? {}).length >= 200);
check("tên quốc gia tra được", w.nationNames["1"] === "Albania", w.nationNames?.["1"]);

// `leagueOfTeam` chỉ chứa giải TRONG NƯỚC, nên số đội ở đây phải NHỎ HƠN tổng
// số đội — hiệu số chính là các đội tuyển quốc gia.
const domestic = Object.keys(w.leagueOfTeam ?? {}).length;
check("phân biệt được CLB với đội tuyển", domestic > 600 && domestic < w.teamCount,
  `${domestic} CLB / ${w.teamCount} đội`);

const undelta = (d: number[]) => {
  const out: number[] = [];
  let acc = 0;
  for (const x of d) { acc += x; out.push(acc); }
  return out;
};
const shipped = undelta(w.shippedIds ?? []);
const ut = undelta(w.utIds ?? []);
check("tập id gốc đủ lớn", shipped.length >= 20_000, `${shipped.length} id`);
check("id gốc tăng dần sau khi giải delta", shipped.every((v, i) => i === 0 || v > shipped[i - 1]));
check("danh sách UT còn nguyên", ut.length >= 3_900, `${ut.length} id`);
// Bằng chứng đã đo: bảng gốc của game KHÔNG chứa nội dung Ultimate Team, nên
// hai tập phải rời nhau. Giao nhau nghĩa là một trong hai nguồn sai.
const shippedSet = new Set(shipped);
const overlap = ut.filter((x) => shippedSet.has(x));
check("UT và roster gốc rời nhau", overlap.length === 0, `${overlap.length} id giao nhau`);

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

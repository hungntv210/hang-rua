/**
 * Rút gọn dataset FC 26 công khai thành asset tĩnh cho web.
 *
 *   npx tsx scripts/build-fc26-db.ts <a.csv> [b.csv ...] public/fc26/players.json
 *
 * Nhận nhiều file và gộp lại, ưu tiên file đứng trước. Không nguồn công khai nào
 * phủ hết ~21.600 bản ghi trong save (sofifa 18.405, trang EA 16.228, đều không
 * có cầu thủ nữ), nên gộp nhiều nguồn là chuyện bình thường chứ không phải ngoại lệ.
 *
 * DB này CHỈ cấp tên, CLB gốc, giải và quốc tịch. Mọi chỉ số hiển thị trên trang
 * đều đọc hoặc tính từ file save của người dùng — nếu lấy chỉ số từ đây thì
 * trang sẽ hiện số của một phiên bản game mà người dùng không chơi.
 *
 * Chỉ giữ 6 cột trong số 110 cột của nguồn: 11MB CSV rút còn khoảng 1MB JSON.
 * Định dạng là mảng song song thay vì mảng object — cùng dữ liệu nhưng không lặp
 * lại tên khoá 18.000 lần.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

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

const args = process.argv.slice(2);
const outPath = args.length > 1 && args[args.length - 1].endsWith(".json")
  ? (args.pop() as string)
  : "public/fc26/players.json";
const csvPaths = args;
if (csvPaths.length === 0) {
  console.error("Cần ít nhất một file CSV.\n  npx tsx scripts/build-fc26-db.ts <a.csv> [b.csv ...] [ra.json]");
  process.exit(1);
}

/**
 * Nhận nhiều định dạng nguồn thay vì bắt đúng một bộ tên cột.
 *
 * Đã gặp ba nguồn với cách đặt tên khác hẳn nhau: sofifa (`player_id`), trang
 * chính thức EA (`ID`, `Name`), và export từ Live Editor. Bắt cứng tên cột khiến
 * script ném lỗi khó hiểu ngay ở nguồn hợp lệ, nên ở đây chỉ cột định danh và
 * cột tên là bắt buộc — mọi cột khác thiếu thì bỏ trống.
 */
function columnMap(head: string[]) {
  const find = (...names: string[]): number => {
    for (const n of names) {
      const i = head.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };
  return {
    id: find("player_id", "ID", "playerid"),
    short: find("short_name", "Name", "name"),
    long: find("long_name", "Name", "name"),
    club: find("club_name", "Team", "team", "teamname"),
    league: find("league_name", "League", "league"),
    nation: find("nationality_name", "Nation", "nation"),
    nationId: find("nationality_id", "nationality"),
  };
}

const at = (f: string[], i: number): string => (i >= 0 ? (f[i] ?? "").trim() : "");

const ids: number[] = [];
const names: string[] = [];
const fullNames: string[] = [];
const clubs: string[] = [];
const leagues: string[] = [];
const nations: string[] = [];
const seen = new Set<number>();
/**
 * Mã quốc gia → tên. Quan trọng hơn vẻ ngoài của nó: mã này dùng chung cho MỌI
 * cầu thủ, kể cả những người dataset không có tên, nên đây là cách duy nhất để
 * nhận dạng nhóm đó. Chỉ khoảng 180 mục nên gần như miễn phí.
 */
const nationNames = new Map<number, string>();

for (const csvPath of csvPaths) {
  const lines = readFileSync(csvPath, "utf8").split(/\r?\n/);
  const head = splitCsvLine(lines[0]).map((h) => h.trim());
  const I = columnMap(head);
  if (I.id < 0 || I.short < 0) {
    throw new Error(
      `${csvPath}: cần cột định danh (player_id / ID) và cột tên (short_name / Name).\n` +
      `Cột đọc được: ${head.slice(0, 20).join(", ")}`,
    );
  }

  const before = seen.size;
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i]) continue;
    const f = splitCsvLine(lines[i]);

    const nationName = at(f, I.nation);
    const nid = Number(at(f, I.nationId));
    if (Number.isFinite(nid) && nid > 0 && nationName) nationNames.set(nid, nationName);

    const id = Number(at(f, I.id));
    const short = at(f, I.short);
    // Bỏ dòng không có tên: một mục rỗng trong DB tra cứu chỉ làm UI hiện ô trắng
    // thay vì đánh dấu rõ là chưa có tên.
    // File đứng trước thắng, nên xếp nguồn đáng tin nhất lên đầu.
    if (!Number.isFinite(id) || id <= 0 || !short || seen.has(id)) continue;
    seen.add(id);

    const long = at(f, I.long);
    ids.push(id);
    names.push(short);
    // Tên đầy đủ chỉ giữ khi khác tên ngắn — phần lớn trùng nhau, lưu cả hai là phí.
    fullNames.push(long === short ? "" : long);
    clubs.push(at(f, I.club));
    leagues.push(at(f, I.league));
    nations.push(nationName);
  }
  console.log(`${csvPath}: thêm ${seen.size - before} cầu thủ (tổng ${seen.size})`);
}

const payload = {
  // Ghi đúng file đã dùng thay vì một chuỗi cố định — nguồn sẽ đổi khi có
  // export tốt hơn, và lúc đó `source` phải phản ánh sự thật.
  source: csvPaths.join(" + "),
  builtAt: new Date().toISOString().slice(0, 10),
  count: ids.length,
  ids,
  names,
  fullNames,
  clubs,
  leagues,
  nations,
  nationNames: Object.fromEntries(nationNames),
};

mkdirSync(dirname(outPath), { recursive: true });
const json = JSON.stringify(payload);
writeFileSync(outPath, json);
console.log(`${ids.length} cầu thủ -> ${outPath} (${(json.length / 1024 / 1024).toFixed(2)} MB chưa nén)`);

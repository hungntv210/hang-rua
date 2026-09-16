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

import { readNewgenNames } from "../lib/save/career/newgen-names";

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

/**
 * Loại cầu thủ do career sinh ra khỏi DB dùng chung.
 *
 * VÌ SAO BẮT BUỘC khi nguồn là export từ Live Editor: export đó chụp career của
 * MỘT người. Newgen trong career ấy mang ID mà career của người khác gán cho một
 * cầu thủ hoàn toàn khác. Nướng chúng vào `players.json` — file mọi người dùng
 * chung — là gieo tên sai cho tất cả những ai không phải chủ file export.
 *
 * Tên newgen vẫn hiện bình thường với chủ save, vì nó đọc thẳng từ chính save đó.
 */
const newgenFlag = args.indexOf("--newgen-from");
let newgenIds = new Set<number>();
if (newgenFlag >= 0) {
  const savePath = args[newgenFlag + 1];
  if (!savePath) {
    console.error("--newgen-from cần đường dẫn tới file save.");
    process.exit(1);
  }
  const buf = readFileSync(savePath);
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  newgenIds = new Set(readNewgenNames(bytes).keys());
  args.splice(newgenFlag, 2);
  console.log(`Loại ${newgenIds.size} cầu thủ newgen đọc từ ${savePath}`);
}

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
function columnMap(head: string[]): Record<string, number> {
  const find = (...names: string[]): number => {
    for (const n of names) {
      const i = head.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };
  return {
    id: find("player_id", "ID", "playerid_key", "playerid"),
    short: find("short_name", "Name", "player_name", "name"),
    long: find("long_name", "Name", "player_name", "name"),
    club: find("club_name", "Team", "team", "teamname"),
    league: find("league_name", "League", "league"),
    nation: find("nationality_name", "Nation", "nation"),
    nationId: find("nationality_id", "nationality"),
  };
}

const at = (f: string[], i: number): string => (i >= 0 ? (f[i] ?? "").trim() : "");

function collectIds(lines: string[], idCol: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i]) continue;
    const v = Number(at(splitCsvLine(lines[i]), idCol));
    if (Number.isFinite(v) && v > 0) out.push(v);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Ngưỡng ID mà từ đó trở lên là cầu thủ do career sinh ra — DÒ TỪ DỮ LIỆU.
 *
 * VÌ SAO KHÔNG DÙNG BẢNG TÊN NEWGEN TRONG SAVE: đã thử, và nó thiếu. Bảng đó
 * liệt kê 20 newgen, nhưng career thực tế đã sinh 55 cầu thủ — số còn lại là
 * cầu thủ học viện có ID cùng dải mà bảng tên không nhắc tới. Hậu quả: 35 cầu
 * thủ của career lọt vào `players.json`, tức file mọi người dùng chung. Đúng
 * cái bẫy mà thiết kế này được lập ra để chặn, và nó vẫn lọt.
 *
 * VÌ SAO KHÔNG VIẾT CỨNG 460000: đó là dải của FC 26. Bản game sau đổi dải là
 * bộ lọc câm lặng ngừng hoạt động, và không ai biết cho tới khi dữ liệu đã lên
 * production.
 *
 * Cách dò: cầu thủ có sẵn của game và cầu thủ career sinh ra nằm ở hai cụm ID
 * cách nhau rất xa. Đo trên export thật: khoảng trống lớn nhất là
 * 279.948 → 460.000, và **không một ID nào** phía trên nó có mặt trong ba
 * dataset công khai, trong khi phía dưới thì 17.399/21.382 có.
 *
 * Hai ràng buộc để không cắt nhầm một dải ID thưa bình thường:
 *   - khoảng trống phải thật lớn (`MIN_GAP`)
 *   - phần bị cắt phải nhỏ (`MAX_TAIL_RATIO`) — career sinh vài chục cầu thủ,
 *     không phải vài nghìn
 */
const MIN_GAP = 50_000;
const MAX_TAIL_RATIO = 0.05;

function careerGeneratedFloor(sortedIds: number[]): number {
  if (sortedIds.length < 100) return Number.POSITIVE_INFINITY;

  let gapAt = -1;
  let gapSize = 0;
  for (let i = 1; i < sortedIds.length; i += 1) {
    const d = sortedIds[i] - sortedIds[i - 1];
    if (d > gapSize) {
      gapSize = d;
      gapAt = i;
    }
  }
  if (gapAt < 0 || gapSize < MIN_GAP) return Number.POSITIVE_INFINITY;

  const tail = sortedIds.length - gapAt;
  if (tail / sortedIds.length > MAX_TAIL_RATIO) return Number.POSITIVE_INFINITY;

  return sortedIds[gapAt];
}

/**
 * Gộp THEO TỪNG TRƯỜNG, không phải "file đứng trước thắng toàn bộ".
 *
 * Lý do: export Live Editor là nguồn tên tốt nhất nhưng CỐ Ý không góp CLB (CLB
 * của nó là career-specific). Nếu một file thắng trọn bản ghi thì 21.417 cầu thủ
 * lấy tên từ đó sẽ mất luôn CLB gốc mà dataset công khai vẫn có — mất thông tin
 * không vì lý do gì.
 *
 * Nên mỗi trường giữ giá trị KHÔNG RỖNG đầu tiên gặp được. Thứ tự file vẫn quyết
 * định ai thắng, nhưng chỉ trên những trường thực sự có dữ liệu.
 */
interface Entry {
  name: string;
  fullName: string;
  club: string;
  league: string;
  nation: string;
}
const entries = new Map<number, Entry>();
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

  /**
   * Export từ Live Editor có cột `current_teamid` — CLB HIỆN TẠI trong career
   * của người chạy script. Nó đúng với career đó và sai với mọi career khác,
   * nên nguồn này chỉ được góp TÊN và QUỐC TỊCH, không góp CLB.
   */
  const isLiveEditor = head.some((h) => h.toLowerCase() === "current_teamid");
  if (isLiveEditor) {
    console.log(`${csvPath}: nguồn Live Editor — chỉ lấy tên và quốc tịch, bỏ CLB/giải`);
    I.club = -1;
    I.league = -1;
  }

  // Dải ID do career sinh ra, dò từ chính file. Xem `careerGeneratedFloor`.
  const generatedFloor = isLiveEditor
    ? careerGeneratedFloor(collectIds(lines, I.id))
    : Number.POSITIVE_INFINITY;
  if (Number.isFinite(generatedFloor)) {
    console.log(`${csvPath}: coi ID >= ${generatedFloor} là do career sinh ra, sẽ loại`);
  }

  const before = seen.size;
  let droppedNewgen = 0;
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
    if (!Number.isFinite(id) || id <= 0 || !short) continue;
    if (newgenIds.has(id) || id >= generatedFloor) { droppedNewgen += 1; continue; }
    seen.add(id);

    const long = at(f, I.long);
    const entry = entries.get(id);
    const incoming: Entry = {
      name: short,
      // Tên đầy đủ chỉ giữ khi khác tên ngắn — phần lớn trùng nhau, lưu cả hai là phí.
      fullName: long === short ? "" : long,
      club: at(f, I.club),
      league: at(f, I.league),
      nation: nationName,
    };
    if (!entry) {
      entries.set(id, incoming);
    } else {
      for (const k of Object.keys(incoming) as Array<keyof Entry>) {
        if (!entry[k] && incoming[k]) entry[k] = incoming[k];
      }
    }
  }
  console.log(
    `${csvPath}: thêm ${seen.size - before} cầu thủ (tổng ${seen.size})` +
      (droppedNewgen > 0 ? `, bỏ ${droppedNewgen} newgen` : ""),
  );
}

// Giữ đúng thứ tự xuất hiện lần đầu; mảng song song thay vì mảng object.
const ids = [...entries.keys()];
const names = ids.map((id) => entries.get(id)!.name);
const fullNames = ids.map((id) => entries.get(id)!.fullName);
const clubs = ids.map((id) => entries.get(id)!.club);
const leagues = ids.map((id) => entries.get(id)!.league);
const nations = ids.map((id) => entries.get(id)!.nation);

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

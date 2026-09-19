/**
 * Kiểm thư mục `dataset_fc26/base/` trước khi bất kỳ bản dựng nào đọc nó.
 *
 *   npx tsx scripts/check-fc26-base.ts
 *
 * Phép kiểm quan trọng nhất KHÔNG phải "có đủ file" mà là **không lẫn dữ liệu
 * career**. Một lượt chạy Lua từ menu chính đã từng ghi đè bản export tốt bằng
 * roster gốc không có đội của người chơi, và nó im lặng hoàn toàn. Thư mục này
 * chỉ được chứa hằng số phiên bản.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { num, readCsv } from "./csv";
import { BASE_TABLES, BASE_DIR, defaultTeamsheetPlayerColumns } from "./fc26-base-tables";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

check("thư mục tồn tại", existsSync(BASE_DIR), BASE_DIR);
if (!existsSync(BASE_DIR)) {
  console.log("\nChạy `npx tsx scripts/seed-fc26-base.ts` trước.");
  process.exit(1);
}

const files = readdirSync(BASE_DIR);

// Bất biến số một: không bảng nào của career được lọt vào đây.
const career = files.filter((f) => /^(career_|cm_)/.test(f));
check("KHÔNG có bảng career_* hay cm_*", career.length === 0, career.join(", "));

// Bất biến số hai: không có file mang hậu tố cảnh báo của lần lẫn trước.
const suspicious = files.filter((f) => /KHONG-CO-CAREER|\.bak|\.old/i.test(f));
check("không còn file đặt tên né tránh", suspicious.length === 0, suspicious.join(", "));

for (const t of BASE_TABLES) {
  const p = join(BASE_DIR, `${t.name}.csv`);
  if (!existsSync(p)) {
    check(`${t.name}: có file`, false, p);
    continue;
  }
  const rows = readCsv(p);
  check(`${t.name}: đủ dòng`, rows.length >= t.minRows, `${rows.length} (tối thiểu ${t.minRows})`);
  check(`${t.name}: có cột khoá "${t.key}"`, rows.length > 0 && t.key in rows[0]);
}

/*
 * Bất biến theo NỘI DUNG, không chỉ theo tên file.
 *
 * Hai bất biến phía trên (không career_ hay cm_, không hậu tố né tránh) chỉ soi
 * TÊN FILE — chúng không trả lời được câu hỏi mà cổng này tồn tại để trả lời:
 * "có dữ liệu của một người chơi cụ thể lọt vào asset dùng chung không?". Ba
 * phép kiểm dưới đây đọc thẳng NỘI DUNG để trả lời đúng câu đó.
 */
const teamplayerlinksRows = readCsv(join(BASE_DIR, "teamplayerlinks.csv"));
const defaultTeamsheetsRows = readCsv(join(BASE_DIR, "default_teamsheets.csv"));
const teamsRows = readCsv(join(BASE_DIR, "teams.csv"));
const playersRows = readCsv(join(BASE_DIR, "players.csv"));

/**
 * Bất biến 1 (quan trọng nhất): không playerId nào do career sinh ra — dải
 * học viện/regen, >= 460.000 (xem lib/save/career/schema.ts: cùng con số 55
 * cầu thủ, cùng việc chỉ 22/55 có tên dạng chữ trong save — dấu hiệu của một
 * lứa regen cụ thể, không phải id thật của roster gốc).
 *
 * Soi cả `players.csv`, không chỉ `teamplayerlinks`/`default_teamsheets`:
 * `players.csv` là NGUỒN của `shippedIds` (`Fc26World.isShipped()`), tức
 * đúng lý do việc lọc học viện quan trọng — bỏ sót bảng này thì hai bảng kia
 * có sạch cũng vô nghĩa, vì tab Cầu thủ trẻ đọc `players.csv` để biết ai
 * "đã xuất xưởng".
 *
 * `default_teamsheets.csv` không có một cột "playerid" duy nhất — nó có ~60
 * cột giữ id cầu thủ (`playerid0`..`playerid51` cộng các vai trò đá phạt/đá
 * góc/đội trưởng); chỉ `teamid` và 6 cột `customsub*in/out` (giữ CHỈ SỐ Ô,
 * 0–51 hoặc -1 khi trống) là không phải playerId. Danh sách cột đó lấy từ
 * `defaultTeamsheetPlayerColumns()` trong `fc26-base-tables.ts` — CÙNG hàm mà
 * `seed-fc26-base.ts` dùng để lọc, để bộ lọc và bất biến canh không bao giờ
 * lệch phạm vi cột với nhau (từng lệch: seed quét mọi ô kể cả `teamid`, ở
 * đây loại trừ nó — an toàn hôm nay chỉ nhờ `teamid` cao nhất là 132.681,
 * không phải nhờ thiết kế).
 *
 * `default_teamsheets.csv` KHÔNG có bản `.KHONG-CO-CAREER` để thay (chỉ
 * `teamplayerlinks` và `career_calendar` có) nên trước đây nó vẫn mang trạng
 * thái của career lúc chụp — có lần đo được 15 CLB THẬT (không phải 2 CLB tự
 * tạo ở bất biến 2) xếp một cầu thủ học viện vào đội hình mặc định, tức là
 * career đó đã cho mượn/chuyển nhượng regen của mình sang CLB khác. Từ
 * `scripts/seed-fc26-base.ts` vòng sửa sau, `players`/`default_teamsheets`
 * được LỌC bỏ đúng những dòng đó trước khi ghi vào `dataset_fc26/base/` —
 * bất biến này ở đây để giữ cho việc lọc đó không bao giờ lặng lẽ hỏng lại:
 * cho nó "đạt" bằng cách nới ngưỡng hay đổi cột soi sẽ xoá đúng thứ cổng này
 * phải bắt.
 */
const ACADEMY_ID_FLOOR = 460_000;
const dtsPlayerCols = defaultTeamsheetsRows.length ? defaultTeamsheetPlayerColumns(defaultTeamsheetsRows[0]) : [];
const playersAcademyLeak = playersRows.filter((r) => num(r.playerid) >= ACADEMY_ID_FLOOR);
const tplAcademyLeak = teamplayerlinksRows.filter((r) => num(r.playerid) >= ACADEMY_ID_FLOOR);
const dtsAcademyLeak = defaultTeamsheetsRows.filter((r) =>
  dtsPlayerCols.some((c) => num(r[c]) >= ACADEMY_ID_FLOOR),
);
check(
  "không playerId học viện (career sinh ra, >= 460000) trong players/teamplayerlinks/default_teamsheets",
  playersAcademyLeak.length === 0 && tplAcademyLeak.length === 0 && dtsAcademyLeak.length === 0,
  `players: ${playersAcademyLeak.length} dòng; teamplayerlinks: ${tplAcademyLeak.length} dòng; default_teamsheets: ${dtsAcademyLeak.length} đội` +
    (dtsAcademyLeak.length ? ` (vd teamId ${dtsAcademyLeak.slice(0, 3).map((r) => r.teamid).join(", ")})` : ""),
);

/**
 * Bất biến 2: CLB tự tạo trong career (tên bắt đầu bằng "*", vd
 * "*TeamName_Abbr15_112264") không được có cầu thủ thật nào gán vào trong
 * `teamplayerlinks` — nếu có, đó là đội hình của chính người chơi bị nướng
 * vào asset dùng chung.
 */
const fakeTeamIds = new Set(teamsRows.filter((r) => r.teamname.startsWith("*")).map((r) => r.teamid));
const fakeTeamLinks = teamplayerlinksRows.filter((r) => fakeTeamIds.has(r.teamid));
check(
  "không CLB tự tạo nào có cầu thủ trong teamplayerlinks",
  fakeTeamLinks.length === 0,
  `${fakeTeamLinks.length} dòng thuộc ${fakeTeamIds.size} CLB tự tạo`,
);

/**
 * Bất biến 3: số CLB tự tạo phải bằng 0.
 *
 * Trước khi `scripts/seed-fc26-base.ts` lọc theo dòng, bản dump khởi tạo mang
 * sẵn CLB tự tạo của chính career lúc chụp (đo được: 2) nên ngưỡng ở đây từng
 * phải là `<= 5` chứ không phải `=== 0`. Từ khi seed lọc bỏ đúng các dòng
 * `teamname` bắt đầu bằng "*" (xem `filterRows("teams", …)`), không còn lý do
 * gì để nới ngưỡng nữa — CLB tự tạo lọt qua seed là một lỗi thật, không phải
 * một trạng thái "vô hại đã biết trước" như trước đây.
 */
check("không còn CLB tự tạo nào", fakeTeamIds.size === 0, `${fakeTeamIds.size} CLB: ${[...fakeTeamIds].join(", ")}`);

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

/**
 * Gieo `dataset_fc26/base/` từ các bản dump đã có.
 *
 *   npx tsx scripts/seed-fc26-base.ts
 *
 * Mười một bảng cần thiết đều đã nằm trong `dataset_fc26/Live Editor/`, nên không
 * phải mở game để chạy được pipeline lần đầu. Nhưng thư mục đó lẫn 248 bảng
 * gồm cả `career_*`, và có HAI phiên bản `teamplayerlinks` — bản chụp trong
 * career (có đội của người chơi) và bản chụp ngoài career. Asset dùng chung
 * phải lấy bản NGOÀI career.
 *
 * Chạy một lần. Từ lần sau `scripts/fc26-dump-base.lua` ghi thẳng vào
 * `dataset_fc26/base/` nên không cần script này nữa; giữ lại để tái lập được.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { num, readCsv } from "./csv";
import { BASE_DIR, BASE_TABLES } from "./fc26-base-tables";

const SRC = "dataset_fc26/Live Editor";

/**
 * Bảng nào phải lấy bản chụp NGOÀI career.
 *
 * `teamplayerlinks` chụp trong career mang số áo và thành viên của đội người
 * chơi đang cầm — dữ liệu của một người, không được nướng vào asset chung.
 */
const PREFER_OUT_OF_CAREER: Record<string, string> = {
  teamplayerlinks: "fc26_teamplayerlinks.KHONG-CO-CAREER.csv",
};

/*
 * BỘ LỌC BOOTSTRAP — vì sao seed phải lọc theo DÒNG chứ không chỉ chép file.
 *
 * `teamplayerlinks` là bảng DUY NHẤT có bản `.KHONG-CO-CAREER` để thay. Mười
 * bảng còn lại lấy từ bản dump Live Editor chụp TRONG một career cụ thể —
 * career đó có 55 cầu thủ học viện (id ≥ 460.000, xem
 * `lib/save/career/schema.ts`) và 2 CLB tự tạo, và đã cho mượn/chuyển nhượng
 * một số học viện đó sang các CLB thật khác. Không lọc thì `players.csv` mang
 * 55 id lạ khiến `Fc26World.isShipped()` coi chúng là "đã xuất xưởng", và tab
 * Cầu thủ trẻ ở task sau sẽ loại nhầm đúng những người nó phải tìm.
 *
 * Đây là VÁ TẠM cho đúng MỘT lần chụp bị lẫn — không phải logic vĩnh viễn.
 * Khi `scripts/fc26-dump-base.lua` chụp lại NGOÀI career thì không còn dòng
 * nào khớp các điều kiện dưới đây để lọc; các hàm filter trả về nguyên vẹn,
 * vô hại chứ không sai.
 *
 * Ngưỡng dùng ngưỡng TUYỆT ĐỐI (so với một mốc cố định), không so sánh
 * TƯƠNG ĐỐI (so tập này với tập khác) — vì hai tập lấy cùng một nguồn nhiễm
 * thì so nhau lúc nào cũng "khớp", kể cả khi cả hai đều sai.
 */

/**
 * id hợp lệ cao nhất đo được trong bản dump này là 279.948 — cách mốc này rất
 * xa, nên ngưỡng an toàn cho ĐÚNG BẢN DUMP HIỆN TẠI. Đây không phải hằng số
 * của game; bảo đảm thật sự đến từ việc chụp ngoài career, không phải từ số
 * này. Nếu game sau này phát hành thêm cầu thủ thật với id trong dải này,
 * ngưỡng phải nới lại theo bản dump mới, không phải bằng chứng game đổi luật.
 */
const CAREER_ACADEMY_ID_FLOOR = 460_000;

/**
 * `default_teamsheets`: bỏ nốt cả DÒNG nếu bất kỳ Ô nào của nó rơi vào dải mở
 * rộng này. Một suất đá chính "mặc định" mà trỏ tới học viện của một người
 * chơi thì không còn là mặc định của game nữa — bỏ cả dòng, không xoá riêng
 * từng ô, để không để lại một dòng nửa-mặc-định nửa-cá-nhân.
 */
const DEFAULT_TEAMSHEET_LEAK_FLOOR = 460_000;
const DEFAULT_TEAMSHEET_LEAK_CEILING = 470_000;

/** CLB tự tạo bỏ ở bước lọc `teams`, dùng lại cho `leagueteamlinks`/`formations`/`default_teamsheets`. */
let fakeTeamIds = new Set<string>();

/** Bỏ DÒNG, giữ nguyên mọi CỘT — trả về {rows, removed} để in số liệu cho người chạy thấy. */
function filterRows(
  name: string,
  rows: Array<Record<string, string>>,
): { rows: Array<Record<string, string>>; note: string } {
  switch (name) {
    case "players": {
      const kept = rows.filter((r) => num(r.playerid) < CAREER_ACADEMY_ID_FLOOR);
      return { rows: kept, note: `bỏ ${rows.length - kept.length} học viện` };
    }
    case "teams": {
      const fake = rows.filter((r) => r.teamname.startsWith("*"));
      fakeTeamIds = new Set(fake.map((r) => r.teamid));
      const kept = rows.filter((r) => !fakeTeamIds.has(r.teamid));
      return { rows: kept, note: `bỏ ${rows.length - kept.length} CLB tự tạo` };
    }
    case "leagueteamlinks":
    case "formations": {
      const kept = rows.filter((r) => !fakeTeamIds.has(r.teamid));
      return { rows: kept, note: `bỏ ${rows.length - kept.length} dòng thuộc CLB tự tạo` };
    }
    case "default_teamsheets": {
      const afterFakeTeam = rows.filter((r) => !fakeTeamIds.has(r.teamid));
      const kept = afterFakeTeam.filter(
        (r) =>
          !Object.values(r).some((v) => {
            const n = num(v);
            return n >= DEFAULT_TEAMSHEET_LEAK_FLOOR && n < DEFAULT_TEAMSHEET_LEAK_CEILING;
          }),
      );
      const removedFakeTeam = rows.length - afterFakeTeam.length;
      const removedAcademy = afterFakeTeam.length - kept.length;
      return {
        rows: kept,
        note: `bỏ ${removedFakeTeam} CLB tự tạo + ${removedAcademy} đội có ô học viện`,
      };
    }
    default:
      return { rows, note: "không lọc — bảng sạch theo lần quét gần nhất" };
  }
}

/** Thoát giá trị CSV giống hệt quy tắc `splitCsvLine` đọc vào, để ghi lại không lệch dữ liệu. */
function toCsvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function writeCsv(path: string, rows: Array<Record<string, string>>, columns: string[]): void {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => toCsvCell(row[c] ?? "")).join(","));
  writeFileSync(path, `${lines.join("\r\n")}\r\n`, "utf8");
}

mkdirSync(BASE_DIR, { recursive: true });

let copied = 0;
let missing = 0;
for (const t of BASE_TABLES) {
  const preferred = PREFER_OUT_OF_CAREER[t.name];
  const candidates = [
    ...(preferred ? [join(SRC, preferred)] : []),
    join(SRC, `fc26_${t.name}.csv`),
  ];
  const src = candidates.find((p) => existsSync(p));
  if (!src) {
    console.error(`THIẾU: ${t.name} — thử ${candidates.join(", ")}`);
    missing += 1;
    continue;
  }

  const rawRows = readCsv(src);
  const columns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const { rows: filteredRows, note } = filterRows(t.name, rawRows);

  const dst = join(BASE_DIR, `${t.name}.csv`);
  writeCsv(dst, filteredRows, columns);

  const fromLabel = src.split(/[\\/]/).pop();
  if (filteredRows.length === rawRows.length) {
    console.log(`${t.name.padEnd(18)} ← ${fromLabel} (${rawRows.length} dòng, ${note})`);
  } else {
    console.log(
      `${t.name.padEnd(18)} ← ${fromLabel}: ${rawRows.length} -> ${filteredRows.length} (${note})`,
    );
  }
  copied += 1;
}

console.log(`\n${copied}/${BASE_TABLES.length} bảng đã gieo vào ${BASE_DIR}`);
if (missing) {
  console.error(`${missing} bảng thiếu — chạy scripts/fc26-dump-base.lua trong game.`);
  process.exit(1);
}

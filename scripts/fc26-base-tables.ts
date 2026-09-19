/**
 * Mười một bảng hằng số phiên bản — MỘT nguồn sự thật duy nhất.
 *
 * Script Lua chụp đúng danh sách này, cổng kiểm xác nhận đúng danh sách này,
 * và bản dựng đọc đúng danh sách này. Trước đây ba chỗ đó giữ ba danh sách
 * riêng, và chúng lệch nhau — `dcplayernames` có trong game, không có trong
 * bản dựng, nên 15% cầu thủ mất tên suốt một thời gian dài.
 *
 * `minRows` là số đo trên bản dump thật, để nới ~5%. Nó bắt được lượt chụp
 * hỏng giữa chừng — thứ mà phép kiểm "file có tồn tại không" bỏ lọt.
 */
export const BASE_DIR = "dataset_fc26/base";

export const BASE_TABLES = [
  { name: "playernames", minRows: 39_000, key: "nameid", why: "tên, nameid 0–41.189" },
  { name: "dcplayernames", minRows: 5_000, key: "nameid", why: "tên, nameid 44.000+" },
  { name: "players", minRows: 20_000, key: "playerid", why: "tập id roster gốc" },
  { name: "teamplayerlinks", minRows: 22_000, key: "playerid", why: "số áo, CLB" },
  { name: "teams", minRows: 700, key: "teamid", why: "tên CLB" },
  { name: "leagues", minRows: 40, key: "leagueid", why: "tên giải, cờ quốc tế" },
  { name: "leagueteamlinks", minRows: 700, key: "teamid", why: "CLB thuộc giải nào" },
  { name: "nations", minRows: 200, key: "nationid", why: "tên quốc gia" },
  { name: "formations", minRows: 800, key: "formationid", why: "hình học sân" },
  { name: "default_teamsheets", minRows: 700, key: "teamid", why: "sơ đồ nào thực sự có đội dùng" },
  { name: "teamkits", minRows: 3_500, key: "teamkitid", why: "màu áo, để dành" },
] as const;

/**
 * Cột nào trong `default_teamsheets.csv` giữ playerId.
 *
 * Bảng này không có một cột "playerid" duy nhất — nó có ~60 cột vai trò
 * (`playerid0`..`playerid51` cộng đội trưởng/đá phạt/đá góc). Chỉ `teamid`
 * và 6 cột `customsub*in/out` (giữ CHỈ SỐ Ô 0–51 hoặc -1, không phải
 * playerId) là ngoại lệ. `seed-fc26-base.ts` (lọc) và `check-fc26-base.ts`
 * (canh) từng tự dựng danh sách này hai lần theo hai cách — export một chỗ
 * duy nhất để chúng không bao giờ lệch nhau.
 */
export function defaultTeamsheetPlayerColumns(sampleRow: Record<string, string>): string[] {
  return Object.keys(sampleRow).filter((k) => k !== "teamid" && !k.startsWith("customsub"));
}

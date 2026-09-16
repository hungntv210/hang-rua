--[[
  Xuất toàn bộ bảng cầu thủ của FC 26 ra CSV, chạy bằng FC 26 Live Editor.

  VÌ SAO CẦN: file save Career Mode không lưu tên cầu thủ — EA giữ tên trong file
  cài game. Các dataset công khai (sofifa, trang EA) chỉ có ~18.000 cầu thủ nam,
  trong khi save chứa ~21.600 bản ghi. Phần chênh là cầu thủ nữ, đội trẻ và đội
  dự bị — không nguồn công khai nào liệt kê. Chỉ export thẳng từ game mới phủ hết.

  CÁCH CHẠY
    1. Bật FC 26 (nên vào thẳng career mode của bạn để dữ liệu khớp đúng save).
    2. Bật Live Editor, rồi bấm F9 trong game để mở giao diện của nó.
    3. Features → Lua Engine → File → Open → chọn file này → Execute.
    4. Chờ 15–40 giây. Xong sẽ hiện hộp thoại và file nằm trên Desktop:
       fc26_players_export.csv
    5. Chép file đó vào dataset_fc26/ rồi chạy:
       npx tsx scripts/build-fc26-db.ts dataset_fc26/fc26_players_export.csv public/fc26/players.json

  LƯU Ý HIỆU NĂNG: GetPlayerName rất chậm, tài liệu của Live Editor cũng ghi rõ
  vậy. Script gom toàn bộ dòng vào bộ nhớ rồi ghi MỘT lần — mở/đóng file theo
  từng dòng như một số script mẫu sẽ chậm gấp nhiều lần với 20.000 cầu thủ.
]]

require 'imports/other/helpers'

local OUT_NAME = "fc26_players_export.csv"

--[[
  Lấy DƯ còn hơn phải chạy lại.

  Chạy script này tốn của bạn một lần khởi động game, nên nó xuất mọi trường có
  thể cần chứ không chỉ những trường đang dùng. Ba chỉ số `volleys`,
  `defensiveawareness`, `gkpositioning` đặc biệt quan trọng: đó là ba trường duy
  nhất trong bản ghi cầu thủ mà chưa dò ra được vị trí bit, và chúng là lý do
  nhóm thủ môn tính chỉ số tổng kém chính xác nhất.

  Cột 1 là tên trong CSV, các cột sau là những tên field có thể có trong bảng
  `players` — tên field đổi giữa các đời game (`marking` vs `defensiveawareness`),
  nên thử lần lượt cho tới khi trúng.
]]
local FIELDS = {
  { "nationality_id", "nationality" },
  { "overall", "overallrating" },
  { "potential", "potential" },
  { "birthdate", "birthdate" },
  { "position", "preferredposition1" },
  { "height_cm", "height" },
  { "weight_kg", "weight" },
  { "skill_moves", "skillmoves" },
  { "weak_foot", "weakfootabilitytypecode" },
  { "international_reputation", "internationalrep" },
  -- ba chỉ số còn thiếu
  { "volleys", "volleys" },
  { "def_awareness", "defensiveawareness", "marking" },
  { "gk_positioning", "gkpositioning" },
  -- các chỉ số đã dò được, giữ lại để kiểm chứng chéo schema
  { "finishing", "finishing" },
  { "reactions", "reactions" },
  { "gk_diving", "gkdiving" },
  { "standing_tackle", "standingtackle" },
  { "sprint_speed", "sprintspeed" },
}

local COLUMNS = { "player_id", "short_name", "long_name", "club_name" }
for _, f in ipairs(FIELDS) do COLUMNS[#COLUMNS + 1] = f[1] end

--- Bọc giá trị cho an toàn với CSV: tên cầu thủ có thể chứa dấu phẩy.
local function csv(value)
  local s = tostring(value or "")
  if s:find('[",\n]') then
    return '"' .. s:gsub('"', '""') .. '"'
  end
  return s
end

--- Thử lần lượt các tên field, trả về giá trị đầu tiên đọc được, "" nếu không có.
--- Không được ném lỗi: chết giữa chừng sau 30 giây quét là mất trắng cả lượt chạy.
local function field(tbl, record, names)
  for i = 2, #names do
    local ok, value = pcall(function()
      return tbl:GetRecordFieldValue(record, names[i])
    end)
    if ok and value ~= nil then return value end
  end
  return ""
end

local players = LE.db:GetTable("players")
assert(players, "Không mở được bảng players — Live Editor đã gắn vào game chưa?")

local lines = { table.concat(COLUMNS, ",") }
local count = 0

local record = players:GetFirstRecord()
while record > 0 do
  local playerid = field(players, record, { "playerid", "playerid" })

  if type(playerid) == "number" and playerid > 0 then
    -- GetPlayerName trả về tên hiển thị trong game, đã gộp sẵn tên và họ.
    local name = GetPlayerName(playerid)
    local teamid = GetTeamIdFromPlayerId(playerid)
    local teamname = ""
    if teamid and teamid > 0 then teamname = GetTeamName(teamid) end

    local row = { csv(playerid), csv(name), csv(name), csv(teamname) }
    for _, f in ipairs(FIELDS) do
      row[#row + 1] = csv(field(players, record, f))
    end
    lines[#lines + 1] = table.concat(row, ",")

    count = count + 1
  end

  record = players:GetNextValidRecord()
end

local path = string.format("%s\\%s", desktop_path, OUT_NAME)
local file = io.open(path, "w+")
assert(file, "Không ghi được file ra Desktop: " .. path)
io.output(file)
io.write(table.concat(lines, "\n"))
io.write("\n")
io.close(file)

-- Báo ngay trường nào rỗng toàn bộ. Nếu không báo, người chạy tưởng đã xong,
-- và chỉ phát hiện thiếu khi đã tắt game — lúc đó phải khởi động lại từ đầu.
local missing = {}
if count > 0 then
  local firstRow = players:GetFirstRecord()
  for _, f in ipairs(FIELDS) do
    local v = field(players, firstRow, f)
    if v == "" or v == nil then missing[#missing + 1] = f[1] end
  end
end

LOGGER:LogInfo(string.format("Đã xuất %d cầu thủ -> %s", count, path))
local msg = string.format("Đã xuất %d cầu thủ ra:\n%s", count, path)
if #missing > 0 then
  msg = msg .. "\n\nKHÔNG đọc được các trường sau (tên field khác ở bản game này):\n"
      .. table.concat(missing, ", ")
      .. "\n\nGửi danh sách này lại để sửa script."
end
MessageBox("Xong", msg)

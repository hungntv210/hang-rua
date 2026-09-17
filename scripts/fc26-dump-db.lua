--[[
  Cào toàn bộ cơ sở dữ liệu FC 26 đang chạy ra CSV, bằng FC 26 Live Editor.

  ────────────────────────────────────────────────────────────────────────────
  QUY TRÌNH
  ────────────────────────────────────────────────────────────────────────────

      1. Vào THẲNG career mode của bạn (không phải menu chính).
      2. Bật Live Editor, bấm F9 để mở giao diện.
      3. Features -> Lua Engine -> File -> Open -> chọn file này -> Execute.
      4. Chờ. Xong sẽ hiện hộp thoại liệt kê các file đã ghi.
      5. >>> LƯU GAME NGAY <<< rồi dùng đúng file save vừa lưu đó.
      6. Chép toàn bộ fc26_*.csv vào dataset_fc26/

  Bước 5 không phải hình thức. Việc giải mã dựa trên export và save mô tả CÙNG
  MỘT trạng thái. Nếu bạn chơi tiếp rồi mới lưu, cổng chặn thời điểm trong
  `probe-fields.ts` sẽ từ chối và cả lượt chạy thành vô giá trị.

  ────────────────────────────────────────────────────────────────────────────
  VÌ SAO LẦN NÀY KHÔNG GIẾT GAME
  ────────────────────────────────────────────────────────────────────────────

  Lượt trước game thoát hẳn giữa chừng. Nguyên nhân đã truy ra chính xác:

      GetDBTableRows("transfers")  ->  trả nil, HOÀN TOÀN LÀNH
      rơi vào nhánh dự phòng con trỏ:
      LE.db:GetTable + GetFirstRecord + GetRecordFieldValue  ->  GIẾT TIẾN TRÌNH

  `transfers` có trong schema (4 cột) nhưng không có dữ liệu nạp trong Career
  Mode. Duyệt nó bằng con trỏ làm dereference con trỏ rác. Và vì đó là hàm C++,
  `pcall` KHÔNG bắt được — không có lỗi Lua nào được ném ra.

  Nên script này KHÔNG dùng API con trỏ ở bất cứ đâu. Chỉ `GetDBTableRows`.
  Bảng nào trả nil thì bỏ qua. Mất đi vector crash duy nhất từng quan sát được,
  và nhờ vậy quét được TOÀN BỘ bảng thay vì chỉ một danh sách trắng dè dặt.

  ────────────────────────────────────────────────────────────────────────────
  NẾU VẪN CRASH
  ────────────────────────────────────────────────────────────────────────────

  Mở `fc26_progress.txt` trên cùng thư mục output — nó ghi tên bảng script đang
  xử lý lúc chết. Thêm tên đó vào bảng SKIP ngay bên dưới rồi chạy lại. Không
  cần sửa gì khác.
]]

require 'imports/other/helpers'

---------------------------------------------------------------------------
-- CẤU HÌNH — sửa ở đây nếu cần
---------------------------------------------------------------------------

--- Bảng cần bỏ qua. Thêm vào đây tên bảng ghi trong `fc26_progress.txt` nếu
--- script chết ở bảng nào đó.
local SKIP = {
  -- ["ten_bang_gay_crash"] = true,
}

--- Quét cả bảng `players` (chậm nhất — `GetPlayerName` phải gọi cho từng cầu
--- thủ, và tài liệu Live Editor cũng ghi rõ hàm này chậm). Đặt `false` nếu bạn
--- đã có `fc26_players.csv` từ lượt trước và chỉ cần các bảng còn lại.
local DUMP_PLAYERS = true

--- Trần dòng cho một bảng. Bảng `career_youth_*` từng ra 8MB mỗi bảng.
local MAX_ROWS = 500000

--- Số dòng giữa hai lần flush xuống đĩa.
local FLUSH_EVERY = 2000

--[[
  Thứ tự ưu tiên. Bảng trong danh sách này chạy TRƯỚC mọi bảng khác.

  Lượt trước game chết ở bảng cuối cùng. Xếp thứ quý nhất lên đầu nghĩa là kể
  cả crash muộn thì phần quan trọng đã nằm trên đĩa. Năm bảng đầu là thứ cần
  cho sơ đồ đội hình.
]]
local PRIORITY = {
  "cm_teamsheets",                 -- teamid, sourceformationid, playerid0..51, captainid
  "formations",                    -- position0..10 + offset0x/0y..offset10x/10y
  "teamformationteamstylelinks",   -- teamid -> formationid
  "default_teamsheets",            -- dự phòng khi cm_teamsheets rỗng
  "teamplayerlinks",               -- jerseynumber, position
  "teams",
  "leagues",
  "leagueteamlinks",
  "nations",
  "customformations",
  "career_users",
  "career_calendar",
  "career_playercontract",
}

---------------------------------------------------------------------------
-- Tiện ích
---------------------------------------------------------------------------

--- Gọi hàm an toàn. Chỉ bắt được lỗi TẦNG LUA — crash trong code C++ của Live
--- Editor thì không lớp bảo vệ nào của Lua chặn được, nên thứ thật sự giữ an
--- toàn là việc không gọi API nguy hiểm, chứ không phải hàm này.
local function try(fn, ...)
  local ok, result = pcall(fn, ...)
  if ok then return result end
  return nil
end

--- Chuẩn hoá giá trị trước khi ghi.
--- Lua 5.3 in số thực là "70.0"; ép về "70" để cột số không phải xử lý lại ở TS.
local function normalize(value)
  if value == nil then return "" end
  if type(value) == "number" then
    if math.type(value) == "float" and value == math.floor(value) then
      return string.format("%d", value)
    end
    return tostring(value)
  end
  if type(value) == "boolean" then return value and "1" or "0" end
  return tostring(value)
end

--- Bọc ô cho an toàn với CSV. Tên cầu thủ và tên đội đều có thể chứa dấu phẩy.
local function csv(value)
  local s = normalize(value)
  if s:find('[",\r\n]') then
    return '"' .. s:gsub('"', '""') .. '"'
  end
  return s
end

local report = {}
local function note(line)
  report[#report + 1] = line
  LOGGER:LogInfo(line)
end

--[[
  Tìm thư mục ghi được, THỬ GHI THẬT chứ không giả định.

  Bản đầu dùng thẳng biến toàn cục `desktop_path`, thừa kế từ script cũ mà chưa
  bao giờ kiểm chứng. Trong Live Editor thật nó là `nil`, và hậu quả rất khó lần:
  `string.format("%s", nil)` KHÔNG ném lỗi mà cho ra chuỗi "nil", nên mọi file
  được ghi vào thư mục `nil\` không tồn tại, thất bại lặng lẽ trong pcall, và cả
  lượt quét chạy xong mà không ghi được byte nào.
]]
local OUT_DIR = nil
do
  local candidates = {}
  local function add(dir)
    if type(dir) == "string" and #dir > 0 then candidates[#candidates + 1] = dir end
  end

  add(rawget(_G, "desktop_path"))
  local home = try(os.getenv, "USERPROFILE")
  if home then
    add(home .. "\\Desktop")
    add(home .. "\\Documents")
    add(home)
  end
  add(try(os.getenv, "TEMP"))
  add(".")

  for i = 1, #candidates do
    local dir = candidates[i]
    local probe = dir .. "\\fc26_write_test.tmp"
    local f = try(io.open, probe, "w+")
    if f then
      try(function() f:write("ok") end)
      try(function() f:close() end)
      try(os.remove, probe)
      OUT_DIR = dir
      note("Thu muc ghi duoc: " .. dir)
      break
    end
    LOGGER:LogInfo("Khong ghi duoc vao: " .. dir)
  end
end

if not OUT_DIR then
  MessageBox(
    "Dump FC 26 DB - KHONG GHI DUOC FILE",
    "Khong tim duoc thu muc nao ghi duoc, nen dung luon truoc khi quet.\n\n" ..
    "Mo file .lua nay, tim dong `add(\".\")` va them mot dong ngay TRUOC no:\n" ..
    "    add(\"D:\\\\fc26out\")\n\n" ..
    "(thu muc do phai TON TAI san), roi chay lai."
  )
  return
end

local function outPath(name)
  return OUT_DIR .. "\\" .. name
end

local function openOut(name)
  local f = try(io.open, outPath(name), "w+")
  if not f then note("KHONG MO DUOC FILE: " .. outPath(name)) end
  return f
end

--[[
  Ghi tên bảng SẮP xử lý ra đĩa trước khi đụng tới nó.

  Crash ở tầng C++ không để lại vết gì trong log Lua và không chạy được đoạn
  dọn dẹp nào. File này là cách DUY NHẤT biết bảng nào đã giết tiến trình.
]]
local function checkpoint(tname)
  local f = openOut("fc26_progress.txt")
  if f then
    f:write("dang xu ly: " .. tname .. "\n")
    f:flush()
    f:close()
  end
end

---------------------------------------------------------------------------
-- GIAI ĐOẠN 1 — Manifest schema. Nhanh, ghi đĩa trước mọi thứ khác.
---------------------------------------------------------------------------

local tableNames = try(GetDBTablesNames)
if not tableNames or #tableNames == 0 then
  note("GetDBTablesNames() khong dung duoc - dung danh sach du phong")
  tableNames = {}
  for i = 1, #PRIORITY do tableNames[i] = PRIORITY[i] end
  tableNames[#tableNames + 1] = "players"
end

local function fieldNames(tableName)
  local fields = try(GetDBTableFields, tableName)
  if not fields or #fields == 0 then return nil end
  local names = {}
  for i = 1, #fields do
    local f = fields[i]
    local n = f and (f["name"] or f.name)
    if n then names[#names + 1] = n end
  end
  if #names == 0 then return nil end
  return names
end

local schema = {}
do
  local manifest = openOut("fc26_manifest.csv")
  if manifest then manifest:write("table_name,field_index,field_name\n") end

  local tableCount, fieldCount = 0, 0
  for i = 1, #tableNames do
    local tname = tableNames[i]
    local names = fieldNames(tname)
    if names then
      schema[tname] = names
      tableCount = tableCount + 1
      for j = 1, #names do
        fieldCount = fieldCount + 1
        if manifest then
          manifest:write(csv(tname) .. "," .. j .. "," .. csv(names[j]) .. "\n")
        end
      end
    elseif manifest then
      -- Bảng tồn tại mà không mở được cột cũng là thông tin, và nó chỉ lộ ra ở đây.
      manifest:write(csv(tname) .. ",,\n")
    end
  end

  if manifest then
    manifest:flush()
    manifest:close()
  end
  note(string.format("GD1 manifest: %d/%d bang doc duoc cot, %d cot",
    tableCount, #tableNames, fieldCount))
end

---------------------------------------------------------------------------
-- GIAI ĐOẠN 2 — Dump mọi bảng, ưu tiên trước
---------------------------------------------------------------------------

--- Thứ tự quét: PRIORITY trước, phần còn lại sau.
local order, queued = {}, {}
for i = 1, #PRIORITY do
  for j = 1, #tableNames do
    if tableNames[j] == PRIORITY[i] and not queued[PRIORITY[i]] then
      order[#order + 1] = PRIORITY[i]
      queued[PRIORITY[i]] = true
    end
  end
end
for i = 1, #tableNames do
  local t = tableNames[i]
  -- `players` để cuối: chậm nhất, và thường đã có từ lượt trước.
  if not queued[t] and t ~= "players" then
    order[#order + 1] = t
    queued[t] = true
  end
end
if DUMP_PLAYERS and not queued["players"] then order[#order + 1] = "players" end

--- Cột của một hàng DBRow, khi manifest không có schema.
local function columnsOf(tname, row)
  local cols = schema[tname]
  if cols then return cols end
  cols = {}
  for k in pairs(row) do cols[#cols + 1] = k end
  table.sort(cols)
  return cols
end

--- DBRow trả về `{ value = ... }` cho mỗi cột.
local function cellValue(cell)
  if type(cell) == "table" then return cell["value"] end
  return cell
end

local dumped, skipped, empty = 0, 0, 0
local teamNameCache = {}

for i = 1, #order do
  local tname = order[i]

  if SKIP[tname] then
    note("BO QUA (trong SKIP): " .. tname)
    skipped = skipped + 1
  else
    checkpoint(tname)

    -- Lời gọi DUY NHẤT chạm vào dữ liệu bảng. Trả nil thì bỏ qua, KHÔNG có
    -- đường lui bằng con trỏ — đó chính là thứ đã giết game lượt trước.
    local rows = try(GetDBTableRows, tname)

    if not rows or #rows == 0 then
      note(string.format("  %s: khong doc duoc hoac rong", tname))
      empty = empty + 1
    else
      local cols = columnsOf(tname, rows[1])
      local out = openOut("fc26_" .. tname .. ".csv")
      if out then
        local isPlayers = (tname == "players")
        local header = {}
        if isPlayers then
          -- Ba cột đầu KHÔNG nằm trong bảng: chúng là hàm tra cứu riêng.
          -- `current_teamid` chính là CLB hiện tại trong career.
          header = { "playerid_key", "player_name", "current_teamid", "current_teamname" }
        end
        for c = 1, #cols do header[#header + 1] = cols[c] end
        out:write(table.concat(header, ",") .. "\n")
        out:flush()  -- flush ngay: crash trước mốc flush đầu để lại file 0 byte

        local n = math.min(#rows, MAX_ROWS)
        for r = 1, n do
          local row = rows[r]
          local line = {}

          if isPlayers then
            -- `tonumber` chu KHONG phai `type(pid) == "number"`.
            --
            -- GetDBTableRows tra gia tri o duoi dang KHONG phai number (khac
            -- GetRecordFieldValue cua API con tro). Phep kiem kieu vi the truot
            -- IM LANG, va ca khoi tra ten bi bo qua: mot luot chay ra 21.437
            -- dong voi 0 ten va current_teamid = -1 o moi dong, ma khong co mot
            -- dong log loi nao.
            local pid = tonumber(cellValue(row["playerid"]))
            local name, teamid, teamname = "", -1, ""
            if pid and pid > 0 then
              name = try(GetPlayerName, pid) or ""
              teamid = tonumber(try(GetTeamIdFromPlayerId, pid)) or -1
              if teamid > 0 then
                if teamNameCache[teamid] == nil then
                  teamNameCache[teamid] = try(GetTeamName, teamid) or ""
                end
                teamname = teamNameCache[teamid]
              end
            end
            line[1] = csv(pid)
            line[2] = csv(name)
            line[3] = csv(teamid)
            line[4] = csv(teamname)
          end

          for c = 1, #cols do
            line[#line + 1] = csv(cellValue(row[cols[c]]))
          end
          out:write(table.concat(line, ",") .. "\n")
          if r % FLUSH_EVERY == 0 then
            out:flush()
            if isPlayers then LOGGER:LogInfo(string.format("    ... %d cau thu", r)) end
          end
        end

        out:flush()
        out:close()
        dumped = dumped + 1
        note(string.format("  %s: %d dong, %d cot%s", tname, n, #header,
          #rows > MAX_ROWS and " (DA CAT BOT)" or ""))
      end
    end
  end
end

note(string.format("GD2: dump %d bang, %d rong/khong doc duoc, %d bo qua",
  dumped, empty, skipped))

---------------------------------------------------------------------------
-- Báo cáo
---------------------------------------------------------------------------

-- Ghi báo cáo ra FILE trước, rồi mới hiện hộp thoại. Lượt đầu tiên chết ở chính
-- đoạn nối chuỗi cuối cùng, sau khi đã quét xong mọi thứ; báo cáo nằm trên đĩa
-- trước thì dù hộp thoại có nổ, người chạy vẫn cầm được kết quả.
do
  local log = openOut("fc26_log.txt")
  if log then
    log:write(table.concat(report, "\n"))
    log:write("\n")
    log:flush()
    log:close()
  end
end

-- Xoá mốc tiến độ: còn file này nghĩa là script chưa chạy tới đây.
do
  local f = openOut("fc26_progress.txt")
  if f then
    f:write("xong, khong crash\n")
    f:flush()
    f:close()
  end
end

MessageBox(
  "Dump FC 26 DB",
  "Xong. Cac file nam o:\n" .. OUT_DIR .. "\n\n"
    .. table.concat(report, "\n")
    .. "\n\n>>> BAY GIO LUU GAME NGAY <<<\n"
    .. "Roi chep cac file fc26_*.csv vao dataset_fc26/"
)

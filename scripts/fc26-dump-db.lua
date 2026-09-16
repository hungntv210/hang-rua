--[[
  Dump cơ sở dữ liệu FC 26 đang chạy ra CSV, bằng FC 26 Live Editor.

  THAY THẾ `fc26-export-players.lua`. Bản cũ ĐOÁN tên field (`defensiveawareness`
  hay `marking`?). Script này tự liệt kê schema rồi xuất mọi thứ tìm được — vì
  nó được thiết kế để chạy ĐÚNG MỘT LẦN, và đoán sai một tên là mất trắng cả
  lượt khởi động game.

  ────────────────────────────────────────────────────────────────────────────
  QUY TRÌNH BẮT BUỘC — đọc kỹ, sai bước này là cả lượt chạy vô giá trị
  ────────────────────────────────────────────────────────────────────────────

      1. Vào THẲNG career mode của bạn (không phải menu chính).
      2. Bật Live Editor, bấm F9 để mở giao diện.
      3. Features -> Lua Engine -> File -> Open -> chọn file này -> Execute.
      4. Chờ. Xong sẽ hiện hộp thoại liệt kê các file trên Desktop.
      5. >>> LƯU GAME NGAY <<< rồi dùng đúng file save vừa lưu đó.

  Bước 5 không phải hình thức. Toàn bộ việc giải mã dựa trên việc export và save
  mô tả CÙNG MỘT trạng thái. Ba lần dò trước thất bại một phần vì nguồn đối
  chiếu là ảnh chụp cũ: trường ĐÃ BIẾT CHẮC đo bằng chính nguồn đó cũng chỉ
  trúng 51-64%, nên tín hiệu của trường chưa biết chìm dưới nhiễu. Nếu bạn chơi
  tiếp rồi mới lưu, chúng ta quay lại đúng chỗ đó.

  ────────────────────────────────────────────────────────────────────────────
  THIẾT KẾ CHỐNG MẤT LƯỢT CHẠY
  ────────────────────────────────────────────────────────────────────────────

  Giai đoạn 1 (manifest) chạy vài giây và GHI RA ĐĨA TRƯỚC giai đoạn quét chậm.
  Kể cả game treo hay crash ở giai đoạn 2, ta vẫn có toàn bộ schema — đủ để viết
  script chính xác cho lần sau mà không phải mò. Mọi lời gọi API đều bọc `pcall`:
  một field lỗi không được phép giết cả lượt. File CSV được flush theo lô, nên
  crash giữa chừng vẫn để lại file đọc được.

  Chạy xong, chép các file từ Desktop vào `dataset_fc26/`.
]]

require 'imports/other/helpers'

local FLUSH_EVERY   = 1000    -- số dòng giữa hai lần flush xuống đĩa
local MAX_AUX_ROWS  = 400000  -- trần dòng cho bảng phụ, chặn bảng khổng lồ
local PROGRESS_EVERY = 2000   -- số dòng giữa hai dòng log tiến độ

-- Bảng phụ cần dump nguyên. `teamplayerlinks` là thứ quan trọng nhất ở đây:
-- nó là quan hệ cầu thủ -> đội, tức CLB HIỆN TẠI trong career.
local AUX_EXACT = {
  teams = true,
  teamplayerlinks = true,
  leagues = true,
  leagueteamlinks = true,
  nations = true,
}
-- Mọi bảng có tên chứa một trong các chuỗi này cũng được dump.
local AUX_CONTAINS = { "career", "transfer", "contract" }

---------------------------------------------------------------------------
-- Tiện ích
---------------------------------------------------------------------------

--- Gọi hàm an toàn. Trả `nil` thay vì ném lỗi — không gì được giết cả lượt chạy.
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
  Tìm thư mục ghi được, THỬ THẬT chứ không giả định.

  Bản trước dùng thẳng biến toàn cục `desktop_path`, thừa kế từ script cũ mà
  chưa bao giờ kiểm chứng. Trong bản Live Editor của người dùng nó là `nil`, và
  chuỗi hậu quả rất khó lần ra:

    - `string.format("%s", nil)` KHÔNG ném lỗi, nó cho ra chuỗi "nil"
    - nên mọi file được ghi vào thư mục tên `nil\` (không tồn tại)
    - `io.open` thất bại lặng lẽ, bọc trong pcall nên không ai biết
    - cả lượt quét chạy xong mà không ghi được byte nào
    - mãi tới dòng nối chuỗi cuối cùng mới nổ, vì `..` thì không ép kiểu nil

  Nên ở đây phải THỬ GHI THẬT một file nháp vào từng ứng viên. Chỉ có ghi được
  thật mới chứng minh được là ghi được.
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
  add(".")  -- thư mục hiện hành của tiến trình game

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
  -- Dừng NGAY, trước lượt quét chậm. Quét xong rồi mới phát hiện không ghi được
  -- là mất trắng một lần khởi động game — đúng chuyện đã xảy ra lần trước.
  MessageBox(
    "Dump FC 26 DB - KHONG GHI DUOC FILE",
    "Khong tim duoc thu muc nao ghi duoc, nen dung luon truoc khi quet.\n\n" ..
    "Hay mo file .lua nay, tim dong `add(\".\")` va them mot dong ngay TRUOC no:\n" ..
    "    add(\"D:\\\\fc26out\")\n\n" ..
    "(thu muc do phai TON TAI san), roi chay lai."
  )
  return
end

local function outPath(name)
  return OUT_DIR .. "\\" .. name
end

--- Mở file để ghi, trả về handle hoặc nil.
local function openOut(name)
  local f = try(io.open, outPath(name), "w+")
  if not f then
    note("KHONG MO DUOC FILE: " .. outPath(name))
  end
  return f
end

---------------------------------------------------------------------------
-- GIAI ĐOẠN 1 — Manifest schema. Chạy trước, ghi đĩa trước.
---------------------------------------------------------------------------

local tableNames = try(GetDBTablesNames)

if not tableNames or #tableNames == 0 then
  -- Nhánh dự phòng: bản Live Editor này không có hàm liệt kê bảng. Dùng danh
  -- sách tên quen thuộc để ít nhất vẫn ra được dữ liệu chính.
  note("GetDBTablesNames() khong dung duoc - dung danh sach bang du phong")
  tableNames = {
    "players", "teams", "teamplayerlinks", "leagues", "leagueteamlinks",
    "nations", "career_users", "career_calendar", "career_playercontract",
  }
end

--- Lấy danh sách tên cột của một bảng. `nil` nếu không đọc được.
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

local schema = {}   -- tableName -> { tên cột }
do
  local manifest = openOut("fc26_manifest.csv")
  if manifest then
    manifest:write("table_name,field_index,field_name\n")
  end

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
      -- Ghi cả bảng không đọc được cột: biết bảng TỒN TẠI mà không mở được
      -- cũng là thông tin, và nó chỉ lộ ra ở đây.
      manifest:write(csv(tname) .. ",,\n")
    end
  end

  if manifest then
    manifest:flush()
    manifest:close()
  end
  note(string.format("GD1 manifest: %d bang doc duoc cot, %d cot, tong %d bang",
    tableCount, fieldCount, #tableNames))
end

---------------------------------------------------------------------------
-- GIAI ĐOẠN 2 — Bảng cầu thủ. Chậm nhất, nên duyệt bằng con trỏ.
---------------------------------------------------------------------------

-- Tên cột lấy từ manifest. Nếu giai đoạn 1 không đọc được schema của `players`
-- thì mới dùng danh sách ứng viên — bao gồm cả ba trường là lý do tồn tại của
-- script này (`volleys`, `defensiveawareness`/`marking`, `gkpositioning`).
local playerFields = schema["players"] or {
  "playerid", "overallrating", "potential", "birthdate", "preferredposition1",
  "height", "weight", "skillmoves", "weakfootabilitytypecode", "internationalrep",
  "nationality", "volleys", "defensiveawareness", "marking", "gkpositioning",
  "finishing", "reactions", "gkdiving", "standingtackle", "sprintspeed",
  "value", "wage", "contractvaliduntil", "contractlength",
}

do
  local players = try(function() return LE.db:GetTable("players") end)
  if not players then
    note("LOI NANG: khong mo duoc bang players - Live Editor da gan vao game chua?")
  else
    local out = openOut("fc26_players.csv")
    if out then
      -- Ba cột đầu KHÔNG nằm trong bảng `players`: chúng là hàm tra cứu riêng.
      -- `current_teamid` chính là CLB hiện tại trong career.
      local header = { "playerid_key", "player_name", "current_teamid", "current_teamname" }
      for i = 1, #playerFields do header[#header + 1] = playerFields[i] end
      out:write(table.concat(header, ",") .. "\n")

      local teamNameCache = {}
      local count, skipped = 0, 0
      local record = players:GetFirstRecord()

      while record and record > 0 do
        local pid = try(function()
          return players:GetRecordFieldValue(record, "playerid")
        end)

        if type(pid) == "number" and pid > 0 then
          local name = try(GetPlayerName, pid) or ""
          local teamid = try(GetTeamIdFromPlayerId, pid)
          if type(teamid) ~= "number" then teamid = -1 end

          local teamname = ""
          if teamid > 0 then
            if teamNameCache[teamid] == nil then
              teamNameCache[teamid] = try(GetTeamName, teamid) or ""
            end
            teamname = teamNameCache[teamid]
          end

          local row = { csv(pid), csv(name), csv(teamid), csv(teamname) }
          for i = 1, #playerFields do
            row[#row + 1] = csv(try(function()
              return players:GetRecordFieldValue(record, playerFields[i])
            end))
          end
          out:write(table.concat(row, ",") .. "\n")

          count = count + 1
          if count % FLUSH_EVERY == 0 then out:flush() end
          if count % PROGRESS_EVERY == 0 then
            LOGGER:LogInfo(string.format("  ... %d cau thu", count))
          end
        else
          skipped = skipped + 1
        end

        record = players:GetNextValidRecord()
      end

      out:flush()
      out:close()
      note(string.format("GD2 players: %d cau thu, %d cot, bo qua %d ban ghi",
        count, #header, skipped))
    end
  end
end

---------------------------------------------------------------------------
-- GIAI ĐOẠN 3 — Bảng phụ. Nhỏ hơn nhiều, nạp trọn một lần được.
---------------------------------------------------------------------------

local function wantAux(name)
  if AUX_EXACT[name] then return true end
  local lower = name:lower()
  for i = 1, #AUX_CONTAINS do
    if lower:find(AUX_CONTAINS[i], 1, true) then return true end
  end
  return false
end

--[[
  Đường lui khi `GetDBTableRows` không dùng được.

  Lượt chạy trước báo "GD3 transfers: khong doc duoc" cho MỌI bảng phụ, trong
  khi `GetDBTablesNames()` rõ ràng chạy được (nó trả về `transfers`, cái tên
  không có trong danh sách dự phòng của script). Nên nhiều khả năng bản Live
  Editor này không có `GetDBTableRows`, chỉ có API con trỏ.

  `teamplayerlinks` là ground truth DUY NHẤT cho việc dò CLB, nên không được
  phép mất nó chỉ vì một hàm API vắng mặt.
]]
--[[
  CHI dung cho bang thuc su can.

  `pcall` KHONG cuu duoc duong nay. `GetFirstRecord`/`GetRecordFieldValue` la ham
  C++ cua Live Editor; duyet mot bang khong co du lieu nap trong Career Mode thi
  no dereference con tro rac va GIET THANG tien trinh game — khong loi Lua nao
  duoc nem ra de pcall bat.

  Da xay ra that: bang `transfers` co trong schema (4 cot) nhung GetDBTableRows
  tra nil, nhanh nay nhay vao, va game thoat han giua chung.

  Nen danh sach nay phai ngan va chi gom thu khong the thieu.
]]
local CURSOR_FALLBACK_OK = {
  teamplayerlinks = true,   -- ground truth DUY NHAT de do CLB
  teams = true,
}

local function dumpByCursor(tname, cols)
  if not cols then return nil end
  if not CURSOR_FALLBACK_OK[tname] then return nil end
  local t = try(function() return LE.db:GetTable(tname) end)
  if not t then return nil end

  local out = openOut("fc26_" .. tname .. ".csv")
  if not out then return nil end
  out:write(table.concat(cols, ",") .. "\n")

  local n = 0
  local record = try(function() return t:GetFirstRecord() end)
  while type(record) == "number" and record > 0 and n < MAX_AUX_ROWS do
    local line = {}
    for c = 1, #cols do
      line[#line + 1] = csv(try(function()
        return t:GetRecordFieldValue(record, cols[c])
      end))
    end
    out:write(table.concat(line, ",") .. "\n")
    n = n + 1
    if n % FLUSH_EVERY == 0 then out:flush() end
    record = try(function() return t:GetNextValidRecord() end)
  end

  out:flush()
  out:close()
  return n
end

-- Xep bang thiet yeu len dau. Neu crash o bang nao do phia sau thi nhung thu
-- khong the thieu da nam tren dia roi.
local auxOrder = {}
do
  local ESSENTIAL = { "teamplayerlinks", "teams", "leagues", "leagueteamlinks", "nations" }
  local added = {}
  for i = 1, #ESSENTIAL do
    for j = 1, #tableNames do
      if tableNames[j] == ESSENTIAL[i] then
        auxOrder[#auxOrder + 1] = ESSENTIAL[i]
        added[ESSENTIAL[i]] = true
      end
    end
  end
  for i = 1, #tableNames do
    if not added[tableNames[i]] then auxOrder[#auxOrder + 1] = tableNames[i] end
  end
end

do
  local dumped = 0
  for i = 1, #auxOrder do
    local tname = auxOrder[i]
    if tname ~= "players" and wantAux(tname) then
      -- Ghi ten bang SAP xu ly ra dia truoc khi dung toi no. Crash o tang C++
      -- khong de lai vet gi trong log Lua, nen day la cach duy nhat biet duoc
      -- bang nao giet tien trinh.
      local mark = openOut("fc26_progress.txt")
      if mark then
        mark:write("dang xu ly: " .. tname .. "\n")
        mark:flush()
        mark:close()
      end

      local rows = try(GetDBTableRows, tname)
      if (not rows or #rows == 0) then
        -- Thử lại bằng con trỏ trước khi kết luận là không đọc được.
        local n = dumpByCursor(tname, schema[tname])
        if n and n > 0 then
          dumped = dumped + 1
          note(string.format("GD3 %s: %d dong, %d cot (qua con tro)", tname, n, #schema[tname]))
        else
          note(string.format("GD3 %s: khong doc duoc (ca hai cach)", tname))
        end
      elseif rows and #rows > 0 then
        -- Cột lấy từ manifest; nếu thiếu thì suy ra từ chính hàng đầu tiên.
        local cols = schema[tname]
        if not cols then
          cols = {}
          for k in pairs(rows[1]) do cols[#cols + 1] = k end
          table.sort(cols)
        end

        local out = openOut("fc26_" .. tname .. ".csv")
        if out then
          out:write(table.concat(cols, ",") .. "\n")
          local n = math.min(#rows, MAX_AUX_ROWS)
          for r = 1, n do
            local row = rows[r]
            local line = {}
            for c = 1, #cols do
              local cell = row[cols[c]]
              -- DBRow trả về dạng { value = ... } cho mỗi cột.
              if type(cell) == "table" then cell = cell["value"] end
              line[#line + 1] = csv(cell)
            end
            out:write(table.concat(line, ",") .. "\n")
            if r % FLUSH_EVERY == 0 then out:flush() end
          end
          out:flush()
          out:close()
          dumped = dumped + 1
          note(string.format("GD3 %s: %d dong, %d cot%s", tname, n, #cols,
            #rows > MAX_AUX_ROWS and " (DA CAT BOT)" or ""))
        end
      end
    end
  end
  note(string.format("GD3: dump duoc %d bang phu", dumped))
end

---------------------------------------------------------------------------
-- Báo cáo
---------------------------------------------------------------------------

-- Ghi báo cáo ra FILE trước, rồi mới hiện hộp thoại.
--
-- Lượt chạy trước chết ở chính đoạn nối chuỗi này, sau khi đã quét xong mọi
-- thứ. Nếu báo cáo nằm trên đĩa trước thì dù hộp thoại có nổ, người chạy vẫn
-- cầm được kết quả và không phải khởi động lại game.
do
  local log = openOut("fc26_log.txt")
  if log then
    log:write(table.concat(report, "\n"))
    log:write("\n")
    log:flush()
    log:close()
  end
end

-- `OUT_DIR` chắc chắn là chuỗi ở đây: script đã dừng từ trước nếu không tìm
-- được thư mục ghi được. Không có sự đảm bảo đó thì `..` sẽ ném lỗi với nil.
MessageBox(
  "Dump FC 26 DB",
  "Xong. Cac file nam o:\n" .. OUT_DIR .. "\n\n"
    .. table.concat(report, "\n")
    .. "\n\n>>> BAY GIO LUU GAME NGAY <<<\n"
    .. "Roi chep cac file fc26_*.csv vao dataset_fc26/"
)

--[[
  Lấy ĐÚNG những bảng mà trang còn thiếu — nhỏ và nhanh, không phải bản dump
  toàn bộ 322 bảng.

  ────────────────────────────────────────────────────────────────────────────
  CÁCH CHẠY
  ────────────────────────────────────────────────────────────────────────────

      1. Vào THẲNG career mode của bạn (không phải menu chính).
      2. Bật Live Editor, bấm F9.
      3. Features -> Lua Engine -> File -> Open -> chọn file này -> Execute.
      4. Xong sẽ hiện hộp thoại liệt kê file đã ghi (chỉ vài giây).
      5. >>> LƯU GAME NGAY <<< rồi dùng đúng file save vừa lưu đó.

  Bước 5 không phải hình thức. Trang sẽ ĐỐI CHIẾU export với save: nếu danh sách
  cầu thủ trong export khác với đội hình đọc từ save, nó từ chối dùng export
  thay vì hiển thị số liệu của hai thời điểm khác nhau trộn vào nhau.

  ────────────────────────────────────────────────────────────────────────────
  VÌ SAO LẦN NÀY NHANH VÀ AN TOÀN HƠN HẲN
  ────────────────────────────────────────────────────────────────────────────

  `fc26-dump-db.lua` quét cả 322 bảng, trong đó có `players` với 21.437 dòng và
  mỗi dòng phải gọi `GetPlayerName` — tài liệu Live Editor ghi rõ hàm đó chậm.
  Script này chạm đúng 6 bảng, bảng lớn nhất là `teamplayerlinks`, và KHÔNG gọi
  `GetPlayerName` lần nào.

  Vẫn giữ nguyên ba bài học đã trả giá để có:

    * KHÔNG dùng API con trỏ (`LE.db:GetTable` / `GetFirstRecord` /
      `GetRecordFieldValue`). Đó là thứ đã giết tiến trình game ở lượt trước, và
      vì nó là code C++ nên `pcall` không bắt được.
    * THỬ GHI THẬT để tìm thư mục output. Biến `desktop_path` trong Live Editor
      thật là `nil`, mà `string.format("%s", nil)` cho ra chuỗi "nil" chứ không
      ném lỗi — nên cả lượt chạy có thể ghi vào thư mục `nil\` và thất bại lặng
      lẽ.
    * `tonumber()` khi đọc ô. `GetDBTableRows` trả ô dạng chuỗi; một phép kiểm
      `type(x) == "number"` sẽ trượt IM LẶNG và cho ra file đủ dòng nhưng rỗng
      giá trị.

  ────────────────────────────────────────────────────────────────────────────
  LẤY GÌ, VÀ ĐỂ LÀM GÌ
  ────────────────────────────────────────────────────────────────────────────

    career_users            đội nào là đội của BẠN (`clubteamid`).
                            Hiện trang phải đoán bằng quy tắc "≥16 cầu thủ và
                            ≥2 thủ môn"; bảng này nói thẳng.

    cm_teamsheets           ĐỘI HÌNH THẬT bạn đã xếp: playerid0..10 là 11 suất
                            đá chính theo đúng thứ tự ô, tiếp theo là dự bị,
                            cộng đội trưởng và tên đội hình. Đây là thứ duy nhất
                            biến "đội hình gợi ý" thành đội hình thật — save
                            không lưu được thông tin này (đã thử và loại năm
                            cách lưu khác nhau).

    teamplayerlinks         SỐ ÁO và mã vị trí trong đội. Số áo không nằm trong
                            bản ghi cầu thủ vì nó thuộc về cặp (cầu thủ, đội).

    career_playercontract   LƯƠNG. Chỉ có ở đây; bảng `players` 149 cột không có
                            cột lương nào.

    career_managerinfo      Ngày tháng thật trong career (`bigwindate`...), để
                            chỉnh lại mốc tính tuổi.

    career_calendar         Ngày hiện tại — CÓ THỂ VÔ DỤNG: ở bản export trước
                            `currdate` là 20080101, tức chưa được ghi. Lấy vì nó
                            đúng một dòng, và nếu có dữ liệu thật thì cột Tuổi
                            hết sai số ±1.

  Không lấy `players`, `formations`, `default_teamsheets` — trang đã có đủ.
]]

require 'imports/other/helpers'

---------------------------------------------------------------------------
-- CẤU HÌNH
---------------------------------------------------------------------------

--- Bảng cần lấy. Thêm tên bảng ghi trong `fc26_progress.txt` vào SKIP nếu
--- script chết ở bảng nào đó.
local WANT = {
  "career_users",
  "career_managerinfo",
  "career_calendar",
  "cm_teamsheets",
  "career_playercontract",
  "teamplayerlinks",
}

local SKIP = {
  -- ["ten_bang_gay_crash"] = true,
}

--- Trần dòng cho một bảng. `teamplayerlinks` cỡ 21.000 dòng.
local MAX_ROWS = 200000

--- Số dòng giữa hai lần flush xuống đĩa.
local FLUSH_EVERY = 2000

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

--- Bọc ô cho an toàn với CSV. Tên đội hình có dấu phẩy là chuyện bình thường.
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

  Ứng viên đầu tiên là thư mục dataset của dự án, để file rơi thẳng vào đúng chỗ
  cần dùng thay vì phải chép tay từ Desktop. Không có thư mục đó — máy khác,
  đường dẫn khác — thì lùi về Desktop như cũ.
]]
local OUT_DIR = nil
do
  local candidates = {}
  local function add(dir)
    if type(dir) == "string" and #dir > 0 then candidates[#candidates + 1] = dir end
  end

  add("D:\\Claude\\projects\\hang-rua\\dataset_fc26\\Live Editor")
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
    "Dump career FC 26 - KHONG GHI DUOC FILE",
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

  Crash ở tầng C++ không để lại vết gì trong log Lua và không chạy được đoạn dọn
  dẹp nào. File này là cách DUY NHẤT biết bảng nào đã giết tiến trình.
]]
local function checkpoint(tname)
  local f = openOut("fc26_progress.txt")
  if f then
    f:write("dang xu ly: " .. tname .. "\n")
    f:flush()
    f:close()
  end
end

--- Ô của `GetDBTableRows` có thể là bảng `{value = ...}` hoặc giá trị trần.
local function cellValue(cell)
  if type(cell) == "table" then return cell["value"] end
  return cell
end

---------------------------------------------------------------------------
-- Quét
---------------------------------------------------------------------------

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

--[[
  CỔNG CHẶN: phải đang ở TRONG career mode, kiểm trước khi ghi bất cứ thứ gì.

  Lượt chạy đầu tiên của script này thất bại đúng kiểu tệ nhất — im lặng. Nó
  chạy xong, ghi "xong" vào file tiến độ, hiện hộp thoại báo thành công, và
  người dùng tin là xong. Nhưng nó chạy từ menu chính chứ không phải trong
  career, nên:

    * bốn bảng `career_*` và `cm_*` trả nil và bị bỏ qua lặng lẽ
    * `teamplayerlinks` VẪN chạy, vì đó là bảng gốc của game — và nó ghi đè
      file cũ bằng roster gốc KHÔNG CÓ câu lạc bộ của người chơi

  Tức là lượt chạy vừa không lấy được gì, vừa phá mất dữ liệu tốt đang có.

  Nên giờ kiểm trước: `cm_teamsheets` và `career_users` chỉ tồn tại khi career
  đã nạp. Không có chúng thì dừng luôn, chưa mở file nào. Một lượt chạy không
  ghi gì và nói rõ lý do thì luôn tốt hơn một lượt chạy ghi nhầm.
]]
do
  local missing = {}
  for _, probe in ipairs({ "career_users", "cm_teamsheets" }) do
    local cols = fieldNames(probe)
    local rows = cols and try(GetDBTableRows, probe) or nil
    if not rows or #rows == 0 then missing[#missing + 1] = probe end
  end

  if #missing > 0 then
    MessageBox(
      "Dump career FC 26 - CHUA VAO CAREER MODE",
      "Khong doc duoc bang: " .. table.concat(missing, ", ") .. "\n\n" ..
      "Nhung bang nay chi ton tai khi career da nap. Rat co the ban dang o\n" ..
      "menu chinh chu khong phai trong career.\n\n" ..
      "CACH LAM DUNG:\n" ..
      "  1. Vao THANG career mode cua ban (thay duoc lich thi dau, doi hinh)\n" ..
      "  2. Moi bat Live Editor va chay lai file nay\n\n" ..
      "Script DUNG LUON, chua ghi file nao — de khong de len ban export cu."
    )
    return
  end
end

local dumped, empty, failed = 0, 0, 0

for i = 1, #WANT do
  local tname = WANT[i]

  if SKIP[tname] then
    note("BO QUA (trong SKIP): " .. tname)
  else
    checkpoint(tname)

    local cols = fieldNames(tname)
    if not cols then
      note("KHONG DOC DUOC COT: " .. tname)
      failed = failed + 1
    else
      -- Lời gọi DUY NHẤT chạm vào dữ liệu bảng. Trả nil thì bỏ qua, KHÔNG có
      -- đường lui bằng con trỏ — đó chính là thứ đã giết game lượt trước.
      local rows = try(GetDBTableRows, tname)

      if not rows or #rows == 0 then
        note("BANG RONG: " .. tname)
        empty = empty + 1
      else
        local f = openOut("fc26_" .. tname .. ".csv")
        if not f then
          failed = failed + 1
        else
          f:write(table.concat(cols, ",") .. "\n")

          local n = #rows
          if n > MAX_ROWS then n = MAX_ROWS end

          for r = 1, n do
            local row = rows[r]
            local out = {}
            for c = 1, #cols do
              out[c] = csv(cellValue(row[cols[c]]))
            end
            f:write(table.concat(out, ",") .. "\n")
            if r % FLUSH_EVERY == 0 then f:flush() end
          end

          f:flush()
          f:close()
          note(string.format("%s: %d dong", tname, n))
          dumped = dumped + 1
        end
      end
    end
  end
end

---------------------------------------------------------------------------
-- Xong
---------------------------------------------------------------------------

do
  local f = openOut("fc26_progress.txt")
  if f then
    f:write("xong\n")
    f:flush()
    f:close()
  end
end

MessageBox(
  "Dump career FC 26 - XONG",
  string.format(
    "%d bang da ghi, %d bang rong, %d bang loi.\n\nThu muc:\n%s\n\n%s\n\n" ..
    ">>> LUU GAME NGAY BAY GIO <<<\nRoi dung dung file save vua luu do.",
    dumped, empty, failed, OUT_DIR, table.concat(report, "\n")
  )
)

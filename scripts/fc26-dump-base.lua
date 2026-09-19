--[[
  Chụp MỘT LẦN 11 bảng hằng số phiên bản của FC 26, để mọi file save về sau
  đọc ra trang đầy đủ mà không phải mở game lần nào nữa.

  ────────────────────────────────────────────────────────────────────────────
  CÁCH CHẠY
  ────────────────────────────────────────────────────────────────────────────

      1. Ở MENU CHÍNH. KHÔNG vào career nào cả.
      2. Bật Live Editor, bấm F9.
      3. Features -> Lua Engine -> File -> Open -> chọn file này -> Execute.
      4. Xong sẽ hiện hộp thoại liệt kê file đã ghi.
      5. Chạy `npm run build:fc26` để sinh lại asset.

  Bước 1 không phải hình thức — xem phần CỔNG CHẶN bên dưới.

  ────────────────────────────────────────────────────────────────────────────
  CHỤP RỘNG, CHỌN HẸP LÚC BUILD
  ────────────────────────────────────────────────────────────────────────────

  Script này giữ NGUYÊN MỌI CỘT của 11 bảng, kể cả những cột hôm nay không ai
  dùng. Đó là chủ ý: cần thêm một trường về sau thì chạy lại `npm run build:fc26`
  chứ không phải mở lại game. Cái giá là khoảng 12MB CSV nằm trong repo — một
  con số một lần, không tăng theo số save.

  Vì sao chủ ý đó quan trọng: bảng `dcplayernames` (tên cầu thủ có nameid từ
  44.000 trở lên) đã bị bỏ sót suốt một thời gian dài vì không ai nghĩ tới nó,
  và hậu quả là 15% cầu thủ mất tên, phải nhờ một dataset công khai 1,9MB tra
  bù. Chụp hẹp là cách sinh ra đúng loại thiếu sót đó.

  KHÔNG chụp bốn bảng lưới mặt và xương — `flesh` 22.590KB, `skeletal` 21.300KB,
  `fat` 18.176KB, `skins` 6.330KB, tổng khoảng 68MB. Chúng là lý do bản dump
  toàn bộ 248 bảng chạy hàng chục phút, và không phục vụ gì cho trang.

  ────────────────────────────────────────────────────────────────────────────
  BA BÀI HỌC ĐÃ TRẢ GIÁ, GIỮ NGUYÊN TỪ BẢN DUMP CAREER
  ────────────────────────────────────────────────────────────────────────────

    * KHÔNG dùng API con trỏ (`LE.db:GetTable` / `GetFirstRecord` /
      `GetRecordFieldValue`). Đó là thứ đã giết tiến trình game ở một lượt
      trước, và vì nó là code C++ nên `pcall` không bắt được.
    * THỬ GHI THẬT để tìm thư mục output. Biến `desktop_path` trong Live Editor
      thật là `nil`, mà `string.format("%s", nil)` cho ra chuỗi "nil" chứ không
      ném lỗi — nên cả lượt chạy có thể ghi vào thư mục `nil\` và thất bại
      lặng lẽ.
    * `tonumber()` khi đọc ô. `GetDBTableRows` trả ô dạng chuỗi; một phép kiểm
      `type(x) == "number"` sẽ trượt IM LẶNG và cho ra file đủ dòng nhưng rỗng
      giá trị.
]]

require 'imports/other/helpers'

---------------------------------------------------------------------------
-- CẤU HÌNH
---------------------------------------------------------------------------

--- Mười một bảng hằng số phiên bản — phải giống hệt `scripts/fc26-base-tables.ts`.
--- `scripts/check-fc26-base.ts` là thứ giữ hai danh sách không lệch nhau; đúng
--- kiểu lệch đó (thiếu `dcplayernames`) đã làm 15% cầu thủ mất tên.
local WANT = {
  "playernames",        -- tên, nameid 0–41.189
  "dcplayernames",      -- tên, nameid 44.000+  (bảng từng bị bỏ sót)
  "players",            -- tập id roster gốc, vị trí sở trường
  "teamplayerlinks",    -- số áo, CLB
  "teams",              -- tên CLB
  "leagues",            -- tên giải, cờ isinternationalleague
  "leagueteamlinks",    -- CLB thuộc giải nào
  "nations",            -- tên quốc gia
  "formations",         -- hình học sân
  "default_teamsheets", -- sơ đồ nào thực sự có đội dùng (871 -> vài chục)
  "teamkits",           -- màu áo, để dành
}

local SKIP = {
  -- ["ten_bang_gay_crash"] = true,
}

--- Trần dòng cho một bảng. `teamplayerlinks` cỡ 24.000 dòng.
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

--- Bọc ô cho an toàn với CSV. Áp dụng cho CẢ hàng tiêu đề, không riêng hàng
--- dữ liệu — quên hàng tiêu đề là khuyết điểm dự án này đã mắc hai lần.
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

  Ứng viên đầu tiên là `dataset_fc26/base` của dự án, để file rơi thẳng vào
  đúng chỗ `npm run build:fc26` đọc, thay vì phải chép tay từ Desktop.
]]
local OUT_DIR = nil
do
  local candidates = {}
  local function add(dir)
    if type(dir) == "string" and #dir > 0 then candidates[#candidates + 1] = dir end
  end

  add("D:\\Claude\\projects\\hang-rua\\dataset_fc26\\base")
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
    "Dump base FC 26 - KHONG GHI DUOC FILE",
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

--- Ô của `GetDBTableRows` có thể là bảng `{value = ...}` hoặc giá trị trần.
local function cellValue(cell)
  if type(cell) == "table" then return cell["value"] end
  return cell
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

--[[
  CỔNG CHẶN: phải ở NGOÀI career mode, kiểm trước khi ghi bất cứ thứ gì.

  Đây là cổng của `fc26-dump-career.lua` LỘN NGƯỢC. Bản kia dừng khi bảng
  career RỖNG; bản này dừng khi chúng CÓ dữ liệu.

  Lý do không phải quy ước mà là cấu trúc: `dataset_fc26/base/` nuôi những
  asset mà MỌI người dùng tải về. Chạy ngoài career thì bảng `career_*` rỗng,
  nên dữ liệu của một người chơi không có đường nào lọt vào đó — mạnh hơn bất
  kỳ lời hứa nào trong chú thích.

  Đây không phải rủi ro giả định. Bản chụp khởi tạo của dự án này được lấy
  TRONG career, và hậu quả đo được: 55 cầu thủ học viện của một người lọt vào
  `players.csv`, hai CLB người đó tự tạo lọt vào `teams.csv`, 16 dòng
  `default_teamsheets` trỏ tới học viện. Riêng 55 cầu thủ kia còn làm hỏng cả
  một tính năng — chúng khiến `isShipped()` trả true, nên tab Cầu thủ trẻ loại
  nhầm đúng những người nó phải tìm. Phải viết một bộ lọc ở khâu gieo để vá.

  Chạy đúng chỗ thì không có gì để vá.

  Bài học kèm theo, từ một lượt chạy sai trạng thái trước đây: nó thất bại đúng
  kiểu tệ nhất — im lặng. Bốn bảng bị bỏ qua, hai bảng vẫn ghi, hộp thoại báo
  "XONG", và một trong hai bảng ấy GHI ĐÈ bản export tốt. Nên kiểm TRƯỚC khi
  mở bất kỳ file nào.
]]
do
  local loaded = {}
  for _, probe in ipairs({ "career_users", "cm_teamsheets" }) do
    local cols = fieldNames(probe)
    local rows = cols and try(GetDBTableRows, probe) or nil
    if rows and #rows > 0 then loaded[#loaded + 1] = probe end
  end

  if #loaded > 0 then
    MessageBox(
      "Dump base FC 26 - DANG O TRONG CAREER MODE",
      "Doc duoc bang career: " .. table.concat(loaded, ", ") .. "\n\n" ..
      "File nay chi duoc chay NGOAI career mode. Thu muc base/ nuoi nhung\n" ..
      "asset ma MOI nguoi dung tai ve, nen du lieu career cua ban khong duoc\n" ..
      "phep lot vao do.\n\n" ..
      "Lan chup truoc lay trong career da lam 55 cau thu hoc vien lot vao\n" ..
      "bang players, va phai viet mot bo loc rieng de va.\n\n" ..
      "CACH LAM DUNG:\n" ..
      "  1. Thoat ve MENU CHINH (khong vao career nao)\n" ..
      "  2. Moi bat Live Editor va chay lai file nay\n\n" ..
      "Script DUNG LUON, chua ghi file nao."
    )
    return
  end
end

---------------------------------------------------------------------------
-- Quét
---------------------------------------------------------------------------

local dumped, empty, failed = 0, 0, 0
local wrote = {}

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
        -- Tên file KHÔNG có tiền tố `fc26_`, để khớp `BASE_TABLES[].name`.
        local f = openOut(tname .. ".csv")
        if not f then
          failed = failed + 1
        else
          local head = {}
          for c = 1, #cols do head[c] = csv(cols[c]) end
          f:write(table.concat(head, ",") .. "\n")

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
          wrote[tname] = true
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

--[[
  Thieu bang la CANH BAO, khong phai "XONG".

  Chuoi hong day du neu khong doi tieu de: mot bang tra nil -> khong mo file ->
  file CU cua bang do song sot trong base/ -> cong kiem van xanh (file ton tai,
  du dong, dung cot khoa) -> build tron 10 bang phien ban moi voi mot bang
  phien ban cu. Chinh bang `dcplayernames` la thu da bi bo sot mot lan va lam
  mat ten 15% cau thu.

  Chu thich dau file nay da ghi dung bai hoc do ("that bai dung kieu te nhat —
  im lang… hop thoai bao XONG") roi phan ket lai lap lai no.
]]
local missing = {}
for i = 1, #WANT do
  if not wrote[WANT[i]] then missing[#missing + 1] = WANT[i] end
end

MessageBox(
  (#missing > 0)
    and ("Dump base FC 26 - THIEU " .. #missing .. " BANG")
    or "Dump base FC 26 - XONG",
  ((#missing > 0) and ("!!! THIEU: " .. table.concat(missing, ", ") ..
     "
DUNG chay build:fc26 voi ban chup nay — file cu cua nhung bang do
" ..
     "van con trong base/ va se bi tron lan voi ban moi.

") or "") ..
  string.format(
    "%d bang da ghi, %d bang rong, %d bang loi.\n\nThu muc:\n%s\n\n%s\n\n" ..
    "BUOC TIEP THEO: chay `npm run build:fc26` roi `npm run check:fc26`.\n" ..
    "Cong kiem se bao neu co du lieu career lot vao.",
    dumped, empty, failed, OUT_DIR, table.concat(report, "\n")
  )
)

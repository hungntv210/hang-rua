/**
 * Chạy thử `fc26-dump-career.lua` ngoài game, bằng VM Lua với API Live Editor
 * giả lập.
 *
 *   node scripts/check-lua-career.mjs [duong-dan-file-lua]
 *
 * ─── VÌ SAO CÓ BỘ KIỂM RIÊNG, KHÔNG DÙNG `check-lua-dump.mjs` ───────────────
 *
 * Bộ kia kiểm hợp đồng của script cào TOÀN BỘ database: phải có manifest, phải
 * có `fc26_players.csv`, phải tra tên từng cầu thủ. Script này cố ý không làm
 * gì trong số đó — nó chạm đúng sáu bảng và không gọi `GetPlayerName` lần nào.
 * Đem nó qua bộ kiểm kia thì 15 mục trượt, và không mục nào nói lên điều gì về
 * tính đúng đắn của nó.
 *
 * Nhưng các BẤT BIẾN AN TOÀN thì dùng chung, vì chúng đều được trả giá bằng một
 * lượt khởi động game: không chạm API con trỏ, `desktop_path` là nil, không có
 * thư mục ghi được, và mốc tiến độ.
 *
 * ─── BẤT BIẾN RIÊNG CỦA SCRIPT NÀY ──────────────────────────────────────────
 *
 * Giá trị duy nhất của nó so với bản cào toàn bộ là NHANH. Mà nhanh chỉ đúng
 * chừng nào nó không đụng `players` (21.437 dòng, mỗi dòng một lời gọi chậm).
 * Nên "không bao giờ chạm bảng players" là một phép kiểm, không phải một lời
 * hứa trong chú thích.
 *
 * Cần: npm i -D fengari luaparse
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import fengari from "fengari";
import luaparse from "luaparse";

const { lua, lauxlib, lualib, to_luastring } = fengari;

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = process.argv[2] ? resolve(process.argv[2]) : join(here, "fc26-dump-base.lua");
const OUT = join(here, "..", ".local", "lua-base-smoke");
const PROJECT_DIR = "D:\\Claude\\projects\\hang-rua\\dataset_fc26\\base";

let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

// ── Cú pháp ─────────────────────────────────────────────────────────────────
try {
  luaparse.parse(readFileSync(SCRIPT, "utf8"), { luaVersion: "5.3" });
  check("cú pháp Lua 5.3", true);
} catch (e) {
  check("cú pháp Lua 5.3", false, e.message);
  process.exit(1);
}

const DRIVER = String.raw`
package.loaded['imports/other/helpers'] = true

CAPTURED, LOGS, BOX, TOUCHED_CURSOR, TOUCHED = {}, {}, nil, false, {}

local function basename(p)
  local last = 0
  for i = 1, #p do
    local b = string.byte(p, i)
    if b == 47 or b == 92 then last = i end
  end
  return string.sub(p, last + 1)
end

local function writable(path)
  for i = 1, #WRITABLE do
    if string.sub(path, 1, #WRITABLE[i]) == WRITABLE[i] then return true end
  end
  return false
end

io = io or {}
io.open = function(path)
  if not writable(path) then return nil end
  local name = basename(path)
  local buf = {}
  CAPTURED[name] = buf
  ORDER[#ORDER + 1] = name
  DIRS[#DIRS + 1] = path
  return {
    write = function(self, s) buf[#buf + 1] = s end,
    flush = function() end,
    close = function() end,
  }
end

os = os or {}
os.getenv = function(k) return ENV[k] end
os.remove = function() return true end

LOGGER = { LogInfo = function(self, s) LOGS[#LOGS + 1] = tostring(s) end }
function MessageBox(title, msg) BOX = title .. "\n" .. msg end

-- BẪY: API con trỏ là thứ đã giết game. Chạm vào là hỏng.
LE = setmetatable({}, { __index = function()
  TOUCHED_CURSOR = true
  error("BAY: script cham vao API con tro (LE.db) - day la thu da giet game")
end })

local SCHEMA = {
  -- 11 bang hang so phien ban ma 'fc26-dump-base.lua' phai chup
  playernames = { "nameid", "name" },
  dcplayernames = { "nameid", "name" },
  players = { "playerid", "overallrating", "firstnameid", "lastnameid" },
  teamplayerlinks = { "playerid", "teamid", "jerseynumber", "position" },
  teams = { "teamid", "teamname" },
  leagues = { "leagueid", "leaguename", "isinternationalleague" },
  leagueteamlinks = { "leagueid", "teamid" },
  nations = { "nationid", "nationname" },
  formations = { "formationid", "formationname", "position0", "offset0x" },
  default_teamsheets = { "teamid", "playerid0", "captainid" },
  teamkits = { "teamkitid", "teamid" },
  -- Bang CAREER: chi ton tai khi da nap career. Cong chan cua ban base phai
  -- DUNG khi doc duoc chung — nguoc chieu voi ban career.
  career_users = { "userid", "clubteamid" },
  cm_teamsheets = { "teamid", "playerid0" },
  -- Bang luoi mat/xuong: ~68MB, ly do ban dump 248 bang chay hang chuc phut.
  -- Script KHONG duoc cham vao.
  flesh = { "id", "blob" },
  skeletal = { "id", "blob" },
  bang_no = { "x" },                    -- GetDBTableRows se nem loi
  bang_hong_schema = { "y" },           -- GetDBTableFields se nem loi
}

local NIL_TABLE = os.getenv("NIL_TABLE")

function GetDBTablesNames()
  local out = {}
  for k in pairs(SCHEMA) do out[#out + 1] = k end
  return out
end

function GetDBTableFields(name)
  TOUCHED[#TOUCHED + 1] = "fields:" .. name
  if name == "bang_hong_schema" then error("khong mo duoc cot") end
  local cols = SCHEMA[name]
  if not cols then return nil end
  local out = {}
  for i = 1, #cols do out[i] = { name = cols[i] } end
  return out
end

local function wrap(t)
  local o = {}
  for k, v in pairs(t) do o[k] = { value = v } end
  return o
end

function GetDBTableRows(name)
  TOUCHED[#TOUCHED + 1] = "rows:" .. name
  if name == "bang_no" then error("no khi doc du lieu") end
  -- NO_CAREER: dung o menu chinh. Bang career/cm tra nil, bang goc van chay.
  if NO_CAREER and (string.sub(name, 1, 7) == "career_" or string.sub(name, 1, 3) == "cm_")
     and name ~= "career_calendar" then
    return nil
  end
  if name == "career_calendar" then return nil end          -- bang co schema, khong co du lieu
  if name == "career_users" then
    return { wrap({ userid = "0", clubteamid = "115486", nationalteamid = "-1",
                    firstname = "Ashley", surname = "Cole" }) }
  elseif name == "career_managerinfo" then
    return { wrap({ clubteamid = "115486", bigwindate = "20251028", wage = "61000" }) }
  elseif name == "cm_teamsheets" then
    -- Ten doi hinh co DAU PHAY: phai duoc boc dung.
    return { wrap({ teamid = "115486", teamsheetname = "NEW GALAXY FC, Default",
                    captainid = "460008", playerid0 = "460011", playerid1 = "271266" }) }
  elseif name == "career_playercontract" then
    return { wrap({ playerid = "460047", teamid = "115486", wage = 44500.0 }) }
  elseif name == "teamplayerlinks" then
    return { wrap({ playerid = "460011", teamid = "115486", jerseynumber = "12", position = "0" }),
             wrap({ playerid = "271266", teamid = "115486", jerseynumber = "28", position = "3" }) }
  elseif name == "players" then
    return { wrap({ playerid = "158023", overallrating = "90",
                    firstnameid = "21799", lastnameid = "24898" }) }
  end
  -- Bang duoc chi dinh tra nil: kich ban "thieu mot bang".
  if NIL_TABLE and name == NIL_TABLE then return nil end
  if name == "teams" then
    -- Ten CLB co DAU PHAY: phai duoc boc dung, ke ca o hang tieu de.
    return { wrap({ teamid = "1808", teamname = "NEW GALAXY FC, Default" }) }
  end
  -- Moi bang con lai trong SCHEMA: mot dong tong hop tu chinh danh sach cot.
  local cols = SCHEMA[name]
  if cols then
    local row = {}
    for i = 1, #cols do row[cols[i]] = tostring(100 + i) end
    return { wrap(row) }
  end
  return nil
end

dofile(SCRIPT_PATH)
`;

function run({ desktopPath, writable, env = {}, noCareer = false }) {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  const setStr = (name, value) => {
    if (value === null || value === undefined) lua.lua_pushnil(L);
    else lua.lua_pushstring(L, to_luastring(value));
    lua.lua_setglobal(L, to_luastring(name));
  };

  setStr("SCRIPT_PATH", SCRIPT);
  setStr("desktop_path", desktopPath);

  lua.lua_pushboolean(L, noCareer ? 1 : 0);
  lua.lua_setglobal(L, to_luastring("NO_CAREER"));

  lua.lua_newtable(L);
  writable.forEach((v, i) => {
    lua.lua_pushstring(L, to_luastring(v));
    lua.lua_rawseti(L, -2, i + 1);
  });
  lua.lua_setglobal(L, to_luastring("WRITABLE"));

  for (const name of ["ORDER", "DIRS"]) {
    lua.lua_newtable(L);
    lua.lua_setglobal(L, to_luastring(name));
  }

  lua.lua_newtable(L);
  for (const [k, v] of Object.entries(env)) {
    lua.lua_pushstring(L, to_luastring(k));
    lua.lua_pushstring(L, to_luastring(v));
    lua.lua_rawset(L, -3);
  }
  lua.lua_setglobal(L, to_luastring("ENV"));

  const status = lauxlib.luaL_dostring(L, to_luastring(DRIVER));
  if (status !== lua.LUA_OK) {
    return { error: lua.lua_tojsstring(L, -1), files: {}, touched: [], dirs: [], box: null, cursor: false };
  }

  const readStringArray = (name) => {
    const out = [];
    lua.lua_getglobal(L, to_luastring(name));
    const n = lua.lua_rawlen(L, -1);
    for (let i = 1; i <= n; i += 1) {
      lua.lua_rawgeti(L, -1, i);
      out.push(lua.lua_tojsstring(L, -1));
      lua.lua_pop(L, 1);
    }
    lua.lua_pop(L, 1);
    return out;
  };

  const files = {};
  lua.lua_getglobal(L, to_luastring("CAPTURED"));
  lua.lua_pushnil(L);
  while (lua.lua_next(L, -2) !== 0) {
    const key = lua.lua_tojsstring(L, -2);
    let content = "";
    lua.lua_pushnil(L);
    while (lua.lua_next(L, -2) !== 0) {
      content += lua.lua_tojsstring(L, -1);
      lua.lua_pop(L, 1);
    }
    files[key] = content;
    lua.lua_pop(L, 1);
  }
  lua.lua_pop(L, 1);

  lua.lua_getglobal(L, to_luastring("BOX"));
  const box = lua.lua_isnil(L, -1) ? null : lua.lua_tojsstring(L, -1);
  lua.lua_pop(L, 1);
  lua.lua_getglobal(L, to_luastring("TOUCHED_CURSOR"));
  const cursor = lua.lua_toboolean(L, -1);
  lua.lua_pop(L, 1);

  return { error: null, files, touched: readStringArray("TOUCHED"), dirs: readStringArray("DIRS"), box, cursor };
}

// ── 1. Chạy ĐÚNG trạng thái: ngoài career ───────────────────────────────────
//
// Với script này, "bình thường" nghĩa là NGOÀI career — ngược với bản career.
// `noCareer: true` mô phỏng đứng ở menu chính: bảng `career_*`/`cm_*` trả nil.
console.log("\n1. Ngoài career mode — trạng thái ĐÚNG, phải chụp đủ 11 bảng");
const a = run({ desktopPath: "C:\\Desktop", writable: [PROJECT_DIR, "C:\\Desktop"], noCareer: true });
check("chạy không ném lỗi", !a.error, a.error ?? "");

const WANT = [
  "playernames", "dcplayernames", "players", "teamplayerlinks", "teams",
  "leagues", "leagueteamlinks", "nations", "formations", "default_teamsheets",
  "teamkits",
];
const missing = WANT.filter((t) => !a.files[`${t}.csv`]);
check(`chụp đủ ${WANT.length} bảng`, missing.length === 0, missing.join(", "));

// Tên file KHÔNG có tiền tố `fc26_` — phải khớp `BASE_TABLES[].name` để
// `check-fc26-base.ts` và bản dựng tìm thấy.
const prefixed = Object.keys(a.files).filter((f) => f.startsWith("fc26_") && f.endsWith(".csv"));
check("tên file không mang tiền tố `fc26_`", prefixed.length === 0, prefixed.join(", "));

check("ghi thẳng vào thư mục dự án", a.dirs.some((d) => d.includes("dataset_fc26")), a.dirs.join(" "));

// ── 2. BẤT BIẾN: không bao giờ chạm API con trỏ ─────────────────────────────
console.log("\n2. Bất biến — API con trỏ là thứ đã giết tiến trình game");
check("KHÔNG chạm vào LE.db", !a.cursor);

// ── 3. BẤT BIẾN: không đụng bảng lưới mặt/xương ─────────────────────────────
console.log("\n3. Bất biến — không đụng ~68MB lưới mặt/xương");
for (const heavy of ["flesh", "skeletal"]) {
  check(`KHÔNG đọc bảng \`${heavy}\``, !a.touched.includes(`rows:${heavy}`));
  check(`KHÔNG sinh ${heavy}.csv`, !a.files[`${heavy}.csv`]);
}

// ── 4. CỔNG CHẶN đảo chiều: đang TRONG career thì phải từ chối ──────────────
//
// Đây là phép kiểm cho một lỗi ĐÃ XẢY RA THẬT và đã phải vá bằng một bộ lọc
// riêng: bản chụp khởi tạo lấy trong career làm 55 cầu thủ học viện của một
// người lọt vào `players.csv`, hai CLB người đó tự tạo lọt vào `teams.csv`.
// Riêng 55 người kia còn làm hỏng tab Cầu thủ trẻ — `isShipped()` trả true
// nên nó loại nhầm đúng những người nó phải tìm.
console.log("\n4. Trong career mode — phải từ chối, KHÔNG được ghi gì");
const e = run({ desktopPath: "C:\\Desktop", writable: ["C:\\Desktop"] });
check("KHÔNG ném lỗi", !e.error, e.error ?? "");
check("báo rõ là đang trong career", !!e.box && e.box.includes("DANG O TRONG CAREER MODE"));
const eData = Object.keys(e.files).filter((f) => f !== "fc26_write_test.tmp");
check("không ghi file dữ liệu nào", eData.length === 0, eData.join(" "));
// Cổng chặn PHẢI đọc `career_users`/`cm_teamsheets` — đó là cách nó biết
// mình đang ở đâu. Thứ bị cấm là chạm vào bảng BASE trước khi từ chối.
const baseTouched = e.touched.filter((t) => t.startsWith("rows:") && WANT.includes(t.slice(5)));
check("không chạm bảng base nào trước khi từ chối", baseTouched.length === 0, baseTouched.join(" "));

// ── 5. Thiếu bảng phải ỒN, không được báo "XONG" ────────────────────────────
//
// Chuỗi hỏng nếu im lặng: một bảng trả nil -> không mở file -> file CŨ của
// bảng đó sống sót trong `base/` -> `check-fc26-base.ts` vẫn xanh (file tồn
// tại, đủ dòng, đúng cột khoá) -> bản dựng trộn 10 bảng phiên bản mới với một
// bảng phiên bản cũ. `dcplayernames` chính là bảng đã bị bỏ sót một lần và
// làm mất tên 15% cầu thủ.
console.log("\n5. Một bảng trả nil — hộp thoại phải đổi thành cảnh báo");
const f = run({
  desktopPath: "C:\\Desktop",
  writable: ["C:\\Desktop"],
  noCareer: true,
  env: { NIL_TABLE: "dcplayernames" },
});
check("KHÔNG ném lỗi", !f.error, f.error ?? "");
check("không sinh dcplayernames.csv", !f.files["dcplayernames.csv"]);
check("tiêu đề hộp thoại là CẢNH BÁO, không phải XONG",
  !!f.box && f.box.includes("THIEU") && !f.box.split("\n")[0].includes("XONG"),
  (f.box ?? "").split("\n")[0]);
check("nêu đích danh bảng thiếu", !!f.box && f.box.includes("dcplayernames"));
check("bảng đứng SAU bảng thiếu vẫn được ghi", !!f.files["teamkits.csv"]);

// ── 6. Thoát ký tự CSV, kể cả HÀNG TIÊU ĐỀ ──────────────────────────────────
console.log("\n6. Thoát ký tự CSV — quên hàng tiêu đề là lỗi đã mắc hai lần");
const teams = a.files["teams.csv"] ?? "";
check("có hàng tiêu đề", teams.startsWith("teamid,teamname"));
check("bọc ô có dấu phẩy", teams.includes('"NEW GALAXY FC, Default"'));
const players = a.files["players.csv"] ?? "";
check("số thực nguyên in ra không có .0", !players.includes(".0,") && !players.endsWith(".0"));

// ── 7. desktop_path = nil ───────────────────────────────────────────────────
console.log("\n7. desktop_path = nil — lỗi từng làm mất một lượt chạy");
const b = run({
  desktopPath: null,
  writable: ["C:\\Users\\x\\Desktop"],
  env: { USERPROFILE: "C:\\Users\\x" },
  noCareer: true,
});
check("KHÔNG ném lỗi", !b.error, b.error ?? "");
check("vẫn ghi được dữ liệu", !!b.files["playernames.csv"]);
check("không ghi vào thư mục tên 'nil'", !b.dirs.some((x) => x.includes("nil\\")));

// ── 8. Không thư mục nào ghi được ───────────────────────────────────────────
console.log("\n8. Không thư mục nào ghi được — phải dừng NGAY, không quét");
const c = run({ desktopPath: null, writable: [], env: {}, noCareer: true });
check("KHÔNG ném lỗi", !c.error, c.error ?? "");
check("báo lỗi rõ ràng qua hộp thoại", !!c.box && c.box.includes("KHONG GHI DUOC"));
check("không quét (không sinh file nào)", Object.keys(c.files).length === 0);
check("không chạm bảng nào", c.touched.length === 0);

// ── 9. File tiến độ ─────────────────────────────────────────────────────────
//
// Ngược với bản career: ở đây chạy XONG thì file phải BIẾN MẤT, nên sự tồn
// tại của nó là tín hiệu "lần trước chết giữa chừng". Ghi "xong" vào nó sẽ để
// lại một file rác trong thư mục dữ liệu mà `.gitignore` đã gỡ ignore.
console.log("\n9. File tiến độ — tồn tại nghĩa là lần trước crash");
// Mock không hiện thực `os.remove`, nên không kiểm được việc xoá. Kiểm thứ
// thật sự quan trọng: KHÔNG còn ghi chữ "xong" — dấu hiệu thành công giả mà
// bản trước để lại ngay cả khi thiếu bảng.
check(
  "không còn ghi dấu 'xong' gây hiểu nhầm",
  !(a.files["fc26_progress.txt"] ?? "").includes("xong"),
  a.files["fc26_progress.txt"] ?? "(đã xoá)",
);
check("hộp thoại nhắc bước tiếp theo", !!a.box && a.box.includes("build:fc26"));

mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(a.files)) {
  writeFileSync(join(OUT, name), content, "utf8");
}

console.log(failed === 0 ? `\nTất cả đều đạt. File mẫu ở ${OUT}` : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed === 0 ? 0 : 1);

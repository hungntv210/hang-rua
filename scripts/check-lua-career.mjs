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
const SCRIPT = process.argv[2] ? resolve(process.argv[2]) : join(here, "fc26-dump-career.lua");
const OUT = join(here, "..", ".local", "lua-career-smoke");
const PROJECT_DIR = "D:\\Claude\\projects\\hang-rua\\dataset_fc26\\Live Editor";

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
  career_users = { "userid", "clubteamid", "nationalteamid", "firstname", "surname" },
  career_managerinfo = { "clubteamid", "bigwindate", "wage" },
  career_calendar = { "currdate", "startdate" },
  cm_teamsheets = { "teamid", "teamsheetname", "captainid", "playerid0", "playerid1" },
  career_playercontract = { "playerid", "teamid", "wage" },
  teamplayerlinks = { "playerid", "teamid", "jerseynumber", "position" },
  players = { "playerid", "overallrating" },
  bang_no = { "x" },                    -- GetDBTableRows se nem loi
  bang_hong_schema = { "y" },           -- GetDBTableFields se nem loi
}

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
    return { wrap({ playerid = "158023", overallrating = "90" }) }
  end
  return nil
end

dofile(SCRIPT_PATH)
`;

function run({ desktopPath, writable, env = {} }) {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  const setStr = (name, value) => {
    if (value === null || value === undefined) lua.lua_pushnil(L);
    else lua.lua_pushstring(L, to_luastring(value));
    lua.lua_setglobal(L, to_luastring(name));
  };

  setStr("SCRIPT_PATH", SCRIPT);
  setStr("desktop_path", desktopPath);

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

// ── 1. Chạy bình thường, thư mục dự án ghi được ─────────────────────────────
console.log("\n1. Bình thường — ghi thẳng vào thư mục dataset của dự án");
const a = run({ desktopPath: "C:\\Desktop", writable: [PROJECT_DIR, "C:\\Desktop"] });
check("chạy không ném lỗi", !a.error, a.error ?? "");
check("có fc26_career_users.csv (đội nào là của mình)", !!a.files["fc26_career_users.csv"]);
check("có fc26_cm_teamsheets.csv (đội hình thật)", !!a.files["fc26_cm_teamsheets.csv"]);
check("có fc26_teamplayerlinks.csv (số áo + vị trí)", !!a.files["fc26_teamplayerlinks.csv"]);
check("có fc26_career_playercontract.csv (lương)", !!a.files["fc26_career_playercontract.csv"]);
check(
  "ưu tiên thư mục dataset của dự án, không phải Desktop",
  a.dirs.every((d) => d.startsWith(PROJECT_DIR)),
  a.dirs[0] ?? "",
);

// ── 2. BẤT BIẾN: không bao giờ chạm API con trỏ ─────────────────────────────
console.log("\n2. BẤT BIẾN — API con trỏ là thứ đã giết game");
check("KHÔNG chạm vào LE.db", !a.cursor);

// ── 3. BẤT BIẾN: không đụng bảng nặng ───────────────────────────────────────
console.log("\n3. BẤT BIẾN — giá trị của script này là NHANH");
check("KHÔNG đọc dữ liệu bảng `players`", !a.touched.includes("rows:players"));
check("KHÔNG sinh fc26_players.csv", !a.files["fc26_players.csv"]);
check(
  "chỉ chạm đúng những bảng cần",
  a.touched.filter((t) => t.startsWith("rows:")).length <= 6,
  a.touched.filter((t) => t.startsWith("rows:")).join(" "),
);

// ── 4. Bảng hỏng không được làm hỏng cả lượt ────────────────────────────────
console.log("\n4. Bảng lỗi phải bị bỏ qua, các bảng SAU nó vẫn phải chạy");
const d = run({
  desktopPath: "C:\\Desktop",
  writable: ["C:\\Desktop"],
});
check("`career_calendar` (trả nil) bị bỏ qua", !d.files["fc26_career_calendar.csv"]);
check(
  "bảng đứng SAU bảng rỗng vẫn được ghi",
  !!d.files["fc26_cm_teamsheets.csv"] && !!d.files["fc26_teamplayerlinks.csv"],
);

// ── 5. Nội dung CSV ─────────────────────────────────────────────────────────
console.log("\n5. Nội dung CSV");
const sheets = a.files["fc26_cm_teamsheets.csv"] ?? "";
check("giữ đủ cột", sheets.includes("playerid0") && sheets.includes("captainid"));
check('bọc đúng tên đội hình có dấu phẩy', sheets.includes('"NEW GALAXY FC, Default"'));
const contract = a.files["fc26_career_playercontract.csv"] ?? "";
check(
  "số thực nguyên in ra không có .0",
  contract.includes("44500") && !contract.includes("44500.0"),
);
const links = a.files["fc26_teamplayerlinks.csv"] ?? "";
check("giữ được ô dạng CHUỖI", links.includes("460011") && links.includes("12"));

// ── 6. desktop_path = nil ───────────────────────────────────────────────────
console.log("\n6. desktop_path = nil — lỗi từng làm mất một lượt chạy");
const b = run({
  desktopPath: null,
  writable: ["C:\\Users\\x\\Desktop"],
  env: { USERPROFILE: "C:\\Users\\x" },
});
check("KHÔNG ném lỗi", !b.error, b.error ?? "");
check("vẫn ghi được dữ liệu", !!b.files["fc26_cm_teamsheets.csv"]);
check("không ghi vào thư mục tên 'nil'", !b.dirs.some((x) => x.includes("nil\\")));

// ── 7. Không thư mục nào ghi được ───────────────────────────────────────────
console.log("\n7. Không thư mục nào ghi được — phải dừng NGAY, không quét");
const c = run({ desktopPath: null, writable: [], env: {} });
check("KHÔNG ném lỗi", !c.error, c.error ?? "");
check("báo lỗi rõ ràng qua hộp thoại", !!c.box && c.box.includes("KHONG GHI DUOC"));
check("không quét (không sinh file nào)", Object.keys(c.files).length === 0);
check("không chạm bảng nào", c.touched.length === 0);

// ── 8. Mốc tiến độ ──────────────────────────────────────────────────────────
console.log("\n8. Mốc tiến độ — cách duy nhất truy ra bảng gây crash");
check(
  "chạy xong thì fc26_progress.txt ghi 'xong'",
  (a.files["fc26_progress.txt"] ?? "").includes("xong"),
);
check("hộp thoại nhắc lưu game", !!a.box && a.box.includes("LUU GAME NGAY"));

mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(a.files)) {
  writeFileSync(join(OUT, name), content, "utf8");
}

console.log(failed === 0 ? `\nTất cả đều đạt. File mẫu ở ${OUT}` : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed === 0 ? 0 : 1);

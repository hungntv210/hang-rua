/**
 * Chạy thử `fc26-dump-db.lua` ngoài game, bằng VM Lua với API Live Editor giả lập.
 *
 *   node scripts/check-lua-dump.mjs
 *
 * VÌ SAO CẦN: script Lua kia chạy ĐÚNG MỘT LẦN trên máy người dùng, trong game
 * đang mở. Một lỗi cú pháp hay một lời gọi nil là mất trắng lượt khởi động game,
 * và không có cách nào thử lại rẻ hơn. Kiểm bằng mắt không bắt được loại lỗi đó.
 *
 * Bộ giả lập dựng sẵn vài cái bẫy mà dữ liệu thật chắc chắn có:
 *   - tên chứa dấu phẩy VÀ dấu nháy kép  -> kiểm escaping CSV
 *   - số thực nguyên (70.0)              -> Lua 5.3 in ra "70.0", phải thành "70"
 *   - playerid = 0                        -> phải bị bỏ qua
 *   - một bảng ném lỗi khi đọc cột        -> phải vào manifest chứ không giết lượt chạy
 *   - cầu thủ không có đội (teamid = -1)  -> tên đội để trống
 *
 * Cần: npm i -D fengari luaparse
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import luaparse from "luaparse";
import fengari from "fengari";

const { lua, lauxlib, lualib, to_luastring } = fengari;

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, "fc26-dump-db.lua");
const OUT = join(here, "..", ".local", "lua-smoke");

let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

// ── 1. Cú pháp ──────────────────────────────────────────────────────────────
const source = readFileSync(SCRIPT, "utf8");
try {
  luaparse.parse(source, { luaVersion: "5.3" });
  check("cú pháp Lua 5.3", true);
} catch (e) {
  check("cú pháp Lua 5.3", false, e.message);
  process.exit(1);
}

// ── 2. Giả lập API Live Editor ──────────────────────────────────────────────
// `io.open` không có trong fengari, nên bắt nội dung vào bộ nhớ. Tách tên file
// bằng so sánh byte (47 = '/', 92 = '\') để không phải thoát ký tự qua nhiều lớp.
const DRIVER = String.raw`
package.loaded['imports/other/helpers'] = true
desktop_path = "OUT"

CAPTURED = {}
local function basename(p)
  local last = 0
  for i = 1, #p do
    local b = string.byte(p, i)
    if b == 47 or b == 92 then last = i end
  end
  return string.sub(p, last + 1)
end
io = io or {}
io.open = function(path)
  local buf = {}
  CAPTURED[basename(path)] = buf
  return {
    write = function(self, s) buf[#buf + 1] = s end,
    flush = function() end,
    close = function() end,
  }
end

LOGGER = { LogInfo = function(self, s) LOGS[#LOGS + 1] = tostring(s) end }
LOGS = {}
function MessageBox(title, msg) BOX = msg end

local SCHEMA = {
  players = { "playerid", "overallrating", "potential", "volleys",
              "defensiveawareness", "gkpositioning", "value", "contractvaliduntil" },
  teams = { "teamid", "teamname" },
  teamplayerlinks = { "playerid", "teamid", "position" },
  career_calendar = { "currentdate" },
  assetcryptokeys = { "keyid" },
}

function GetDBTablesNames()
  return { "players", "teams", "teamplayerlinks", "career_calendar",
           "assetcryptokeys", "bang_hong" }
end

function GetDBTableFields(name)
  if name == "bang_hong" then error("khong mo duoc") end
  local cols = SCHEMA[name]
  if not cols then return nil end
  local out = {}
  for i = 1, #cols do out[i] = { name = cols[i] } end
  return out
end

local PLAYERS = {
  { playerid = 158023, overallrating = 90, potential = 90, volleys = 88,
    defensiveawareness = 34, gkpositioning = 14, value = 41000000, contractvaliduntil = 2027 },
  { playerid = 460021, overallrating = 66, potential = 94, volleys = 40,
    defensiveawareness = 55, gkpositioning = 9, value = 3200000, contractvaliduntil = 2030 },
  { playerid = 999, overallrating = 70.0, potential = 75.0, volleys = 50.0,
    defensiveawareness = 50.0, gkpositioning = 50.0, value = 0.0, contractvaliduntil = 2025.0 },
  { playerid = 0 },
}
local NAMES = { [158023] = "Lionel Messi", [460021] = 'Ren "Teo" Imada, Jr.',
                [999] = "Nguyen Van A" }
local TEAM_OF = { [158023] = 241, [460021] = 1, [999] = -1 }
local TEAM_NAME = { [241] = "FC Barcelona", [1] = "Arsenal, The" }

function GetPlayerName(pid) return NAMES[pid] or "" end
function GetTeamIdFromPlayerId(pid) return TEAM_OF[pid] or -1 end
function GetTeamName(tid) return TEAM_NAME[tid] or "" end

local T = { _i = 0 }
function T:GetFirstRecord() self._i = 1; return 1 end
function T:GetNextValidRecord()
  self._i = self._i + 1
  if self._i > #PLAYERS then return 0 end
  return self._i
end
function T:GetRecordFieldValue(rec, field)
  local row = PLAYERS[rec]
  if not row then error("ban ghi khong ton tai") end
  return row[field]
end
LE = { db = { GetTable = function(self, name)
  if name == "players" then return T end
  return nil
end } }

function GetDBTableRows(name)
  if name == "teams" then
    return { { teamid = { value = 241 }, teamname = { value = "FC Barcelona" } },
             { teamid = { value = 1 }, teamname = { value = "Arsenal, The" } } }
  elseif name == "teamplayerlinks" then
    return { { playerid = { value = 158023 }, teamid = { value = 241 }, position = { value = 21 } },
             { playerid = { value = 460021 }, teamid = { value = 1 }, position = { value = 25 } } }
  elseif name == "career_calendar" then
    return { { currentdate = { value = 20260916 } } }
  end
  return nil
end

dofile(SCRIPT_PATH)
`;

const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);
lua.lua_pushstring(L, to_luastring(SCRIPT));
lua.lua_setglobal(L, to_luastring("SCRIPT_PATH"));

const status = lauxlib.luaL_dostring(L, to_luastring(DRIVER));
if (status !== lua.LUA_OK) {
  check("chạy không ném lỗi", false, lua.lua_tojsstring(L, -1));
  process.exit(1);
}
check("chạy không ném lỗi", true);

// ── 3. Lấy nội dung các file ────────────────────────────────────────────────
const files = {};
lua.lua_getglobal(L, to_luastring("CAPTURED"));
lua.lua_pushnil(L);
while (lua.lua_next(L, -2) !== 0) {
  const name = lua.lua_tojsstring(L, -2);
  let content = "";
  lua.lua_pushnil(L);
  while (lua.lua_next(L, -2) !== 0) {
    content += lua.lua_tojsstring(L, -1);
    lua.lua_pop(L, 1);
  }
  files[name] = content;
  lua.lua_pop(L, 1);
}

mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(OUT, name), content, "utf8");
}

// ── 4. Kiểm nội dung ────────────────────────────────────────────────────────
const players = files["fc26_players.csv"] ?? "";
const manifest = files["fc26_manifest.csv"] ?? "";
const rows = players.trim().split("\n");

check("có fc26_manifest.csv", manifest.length > 0);
check("có fc26_players.csv", players.length > 0);
check("có fc26_teamplayerlinks.csv (ground truth CLB)", !!files["fc26_teamplayerlinks.csv"]);

check("bỏ qua bản ghi playerid = 0", rows.length === 4, `${rows.length - 1} cầu thủ`);
check(
  "bọc đúng tên có dấu phẩy và dấu nháy",
  players.includes('"Ren ""Teo"" Imada, Jr."'),
);
check("bọc đúng tên đội có dấu phẩy", players.includes('"Arsenal, The"'));
check(
  "số thực nguyên in ra không có .0",
  /(^|,)70(,|$)/m.test(players) && !players.includes("70.0"),
);
check(
  "bảng đọc lỗi vẫn vào manifest",
  /^bang_hong,,$/m.test(manifest.trim()),
);
check(
  "bảng ngoài danh sách không bị dump",
  !files["fc26_assetcryptokeys.csv"] && manifest.includes("assetcryptokeys"),
);
check("cầu thủ không đội -> tên đội trống", /,-1,,/.test(players));

console.log(
  failed === 0
    ? `\nTất cả đều đạt. File mẫu ở ${OUT}`
    : `\n${failed} mục KHÔNG đạt.`,
);
process.exit(failed === 0 ? 0 : 1);

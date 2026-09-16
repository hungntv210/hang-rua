/**
 * Chạy thử `fc26-dump-db.lua` ngoài game, bằng VM Lua với API Live Editor giả lập.
 *
 *   node scripts/check-lua-dump.mjs
 *
 * VÌ SAO CẦN: script Lua kia chạy trong game đang mở, và mỗi lượt tốn của người
 * dùng một lần khởi động game. Kiểm bằng mắt không bắt được lỗi lúc chạy.
 *
 * ─── BÀI HỌC ĐÃ TRẢ GIÁ ─────────────────────────────────────────────────────
 *
 * Bản đầu dùng thẳng biến toàn cục `desktop_path`, thừa kế từ script cũ mà chưa
 * bao giờ kiểm chứng. Trong Live Editor thật nó là `nil`, và hậu quả rất khó lần:
 * `string.format("%s", nil)` KHÔNG ném lỗi mà cho ra chuỗi "nil", nên mọi file
 * được ghi vào thư mục `nil\` không tồn tại, thất bại lặng lẽ trong pcall, và cả
 * lượt quét chạy xong mà không ghi được byte nào.
 *
 * Bộ kiểm cũ CÓ hiện triệu chứng đó (mọi io.open đều thất bại) nhưng chỉ chạy
 * MỘT kịch bản, nên nó bị quy cho hạn chế của VM giả lập. Vì thế giờ có nhiều
 * kịch bản, và ít nhất một kịch bản phải để môi trường thiếu thứ script cần.
 *
 * Cần: npm i -D fengari luaparse
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import luaparse from "luaparse";
import fengari from "fengari";

const { lua, lauxlib, lualib, to_luastring } = fengari;

const here = dirname(fileURLToPath(import.meta.url));
// Cho phep chi dinh file khac, de kiem duoc ca ban cu khi can doi chieu.
const SCRIPT = process.argv[2] ? resolve(process.argv[2]) : join(here, "fc26-dump-db.lua");
const OUT = join(here, "..", ".local", "lua-smoke");

let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

// ── Cú pháp ─────────────────────────────────────────────────────────────────
const source = readFileSync(SCRIPT, "utf8");
try {
  luaparse.parse(source, { luaVersion: "5.3" });
  check("cú pháp Lua 5.3", true);
} catch (e) {
  check("cú pháp Lua 5.3", false, e.message);
  process.exit(1);
}

/**
 * Bộ giả lập.
 *
 * `WRITABLE` là danh sách tiền tố thư mục mà `io.open` chịu mở — mô phỏng đúng
 * thực tế: ghi vào thư mục không tồn tại thì thất bại. Không có nó thì mọi
 * đường dẫn đều "ghi được" và kịch bản `desktop_path = nil` không kiểm được gì.
 */
const DRIVER = String.raw`
package.loaded['imports/other/helpers'] = true

CAPTURED, LOGS, BOX = {}, {}, nil

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
  local buf = {}
  CAPTURED[basename(path)] = buf
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

local SCHEMA = {
  players = { "playerid", "overallrating", "potential", "volleys",
              "defensiveawareness", "gkpositioning", "value", "contractvaliduntil" },
  teams = { "teamid", "teamname" },
  teamplayerlinks = { "playerid", "teamid", "position" },
  transfers = { "playerid", "teamid" },
  assetcryptokeys = { "keyid" },
}

function GetDBTablesNames()
  return { "players", "teams", "teamplayerlinks", "transfers",
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
local LINKS = {
  { playerid = 158023, teamid = 241, position = 21 },
  { playerid = 460021, teamid = 1, position = 25 },
}
local NAMES = { [158023] = "Lionel Messi", [460021] = 'Ren "Teo" Imada, Jr.',
                [999] = "Nguyen Van A" }
local TEAM_OF = { [158023] = 241, [460021] = 1, [999] = -1 }
local TEAM_NAME = { [241] = "FC Barcelona", [1] = "Arsenal, The" }

function GetPlayerName(pid) return NAMES[pid] or "" end
function GetTeamIdFromPlayerId(pid) return TEAM_OF[pid] or -1 end
function GetTeamName(tid) return TEAM_NAME[tid] or "" end

local function cursorTable(rows)
  local T = { _i = 0 }
  function T:GetFirstRecord() self._i = 1; return 1 end
  function T:GetNextValidRecord()
    self._i = self._i + 1
    if self._i > #rows then return 0 end
    return self._i
  end
  function T:GetRecordFieldValue(rec, field)
    local row = rows[rec]
    if not row then error("ban ghi khong ton tai") end
    return row[field]
  end
  return T
end

LE = { db = { GetTable = function(self, name)
  if name == "players" then return cursorTable(PLAYERS) end
  if name == "teamplayerlinks" then return cursorTable(LINKS) end
  return nil
end } }

if HAS_TABLE_ROWS then
  function GetDBTableRows(name)
    if name == "teams" then
      return { { teamid = { value = 241 }, teamname = { value = "FC Barcelona" } },
               { teamid = { value = 1 }, teamname = { value = "Arsenal, The" } } }
    elseif name == "teamplayerlinks" then
      return { { playerid = { value = 158023 }, teamid = { value = 241 }, position = { value = 21 } },
               { playerid = { value = 460021 }, teamid = { value = 1 }, position = { value = 25 } } }
    end
    return nil
  end
end

dofile(SCRIPT_PATH)
`;

/** Chạy một kịch bản, trả về các file script đã ghi + hộp thoại + log. */
function run({ desktopPath, writable, env = {}, hasTableRows = true }) {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  const setStr = (name, value) => {
    if (value === null || value === undefined) lua.lua_pushnil(L);
    else lua.lua_pushstring(L, to_luastring(value));
    lua.lua_setglobal(L, to_luastring(name));
  };
  const setList = (name, items) => {
    lua.lua_newtable(L);
    items.forEach((v, i) => {
      lua.lua_pushstring(L, to_luastring(v));
      lua.lua_rawseti(L, -2, i + 1);
    });
    lua.lua_setglobal(L, to_luastring(name));
  };

  setStr("SCRIPT_PATH", SCRIPT);
  setStr("desktop_path", desktopPath);
  setList("WRITABLE", writable);
  lua.lua_pushboolean(L, hasTableRows);
  lua.lua_setglobal(L, to_luastring("HAS_TABLE_ROWS"));

  lua.lua_newtable(L);
  for (const [k, v] of Object.entries(env)) {
    lua.lua_pushstring(L, to_luastring(k));
    lua.lua_pushstring(L, to_luastring(v));
    lua.lua_rawset(L, -3);
  }
  lua.lua_setglobal(L, to_luastring("ENV"));

  const status = lauxlib.luaL_dostring(L, to_luastring(DRIVER));
  if (status !== lua.LUA_OK) {
    return { error: lua.lua_tojsstring(L, -1), files: {}, box: null };
  }

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
  lua.lua_pop(L, 1);

  lua.lua_getglobal(L, to_luastring("BOX"));
  const box = lua.lua_isnil(L, -1) ? null : lua.lua_tojsstring(L, -1);
  return { error: null, files, box };
}

// ── Kịch bản 1: bình thường ─────────────────────────────────────────────────
console.log("\n1. desktop_path hợp lệ");
const a = run({ desktopPath: "C:\\Desktop", writable: ["C:\\Desktop"] });
check("chạy không ném lỗi", !a.error, a.error ?? "");

const players = a.files["fc26_players.csv"] ?? "";
const manifest = a.files["fc26_manifest.csv"] ?? "";
const rows = players.trim().split("\n");

check("có fc26_manifest.csv", manifest.length > 0);
check("có fc26_players.csv", players.length > 0);
check("có fc26_teamplayerlinks.csv (ground truth CLB)", !!a.files["fc26_teamplayerlinks.csv"]);
check("có fc26_log.txt (báo cáo nằm trên đĩa)", !!a.files["fc26_log.txt"]);
check("bỏ qua bản ghi playerid = 0", rows.length === 4, `${rows.length - 1} cầu thủ`);
check("bọc đúng tên có dấu phẩy và dấu nháy", players.includes('"Ren ""Teo"" Imada, Jr."'));
check("bọc đúng tên đội có dấu phẩy", players.includes('"Arsenal, The"'));
check(
  "số thực nguyên in ra không có .0",
  /(^|,)70(,|$)/m.test(players) && !players.includes("70.0"),
);
check("bảng đọc lỗi vẫn vào manifest", /^bang_hong,,$/m.test(manifest.trim()));
check(
  "bảng ngoài danh sách không bị dump",
  !a.files["fc26_assetcryptokeys.csv"] && manifest.includes("assetcryptokeys"),
);
check("cầu thủ không đội -> tên đội trống", /,-1,,/.test(players));

// ── Kịch bản 2: desktop_path nil — đúng lỗi đã làm hỏng một lượt chạy thật ──
console.log("\n2. desktop_path = nil, phải lùi về USERPROFILE");
const b = run({
  desktopPath: null,
  writable: ["C:\\Users\\x\\Desktop"],
  env: { USERPROFILE: "C:\\Users\\x" },
});
check("KHÔNG ném lỗi khi desktop_path là nil", !b.error, b.error ?? "");
check("vẫn ghi được fc26_players.csv", !!b.files["fc26_players.csv"]);
check("không ghi vào thư mục tên 'nil'", !JSON.stringify(b.files).includes("nil\\\\"));
check("hộp thoại cuối không rỗng", !!b.box);

// ── Kịch bản 3: không thư mục nào ghi được ──────────────────────────────────
console.log("\n3. không thư mục nào ghi được — phải dừng NGAY, không quét");
const c = run({ desktopPath: null, writable: [], env: {} });
check("KHÔNG ném lỗi", !c.error, c.error ?? "");
check("báo lỗi rõ ràng qua hộp thoại", !!c.box && c.box.includes("KHONG GHI DUOC"));
check("không quét (không sinh file nào)", Object.keys(c.files).length === 0);

// ── Kịch bản 4: GetDBTableRows vắng mặt ─────────────────────────────────────
console.log("\n4. GetDBTableRows vắng mặt — phải lùi về API con trỏ");
const d = run({
  desktopPath: "C:\\Desktop",
  writable: ["C:\\Desktop"],
  hasTableRows: false,
});
check("KHÔNG ném lỗi", !d.error, d.error ?? "");
check(
  "teamplayerlinks vẫn dump được qua con trỏ",
  (d.files["fc26_teamplayerlinks.csv"] ?? "").split("\n").length >= 3,
);
check("fc26_players.csv vẫn đầy đủ", (d.files["fc26_players.csv"] ?? "").length > 0);

mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(a.files)) {
  writeFileSync(join(OUT, name), content, "utf8");
}

console.log(
  failed === 0 ? `\nTất cả đều đạt. File mẫu ở ${OUT}` : `\n${failed} mục KHÔNG đạt.`,
);
process.exit(failed === 0 ? 0 : 1);

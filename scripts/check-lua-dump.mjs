/**
 * Chạy thử `fc26-dump-db.lua` ngoài game, bằng VM Lua với API Live Editor giả lập.
 *
 *   node scripts/check-lua-dump.mjs [duong-dan-file-lua]
 *
 * VÌ SAO CẦN: script kia chạy trong game đang mở và mỗi lượt tốn của người dùng
 * một lần khởi động game. Đã mất hai lượt vì lỗi mà đọc bằng mắt không thấy:
 * một lần do `desktop_path` là nil, một lần do API con trỏ giết tiến trình.
 *
 * ─── PHÉP THỬ QUAN TRỌNG NHẤT: BẪY Ở API CON TRỎ ───────────────────────────
 *
 * `LE.db:GetTable` + `GetFirstRecord` + `GetRecordFieldValue` là thứ đã giết
 * game. Chúng là hàm C++ nên `pcall` KHÔNG bắt được — không lớp bảo vệ Lua nào
 * chặn nổi. Cách duy nhất giữ an toàn là không bao giờ gọi chúng.
 *
 * Nên bộ giả lập đặt bẫy: chạm vào `LE.db` là bật cờ. Kịch bản 5 khẳng định cờ
 * đó không bao giờ bật. Đây là phép kiểm bất biến, không phải kiểm hành vi —
 * nó bắt được cả trường hợp ai đó thêm lại nhánh con trỏ về sau.
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
const SCRIPT = process.argv[2] ? resolve(process.argv[2]) : join(here, "fc26-dump-db.lua");
const OUT = join(here, "..", ".local", "lua-smoke");

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

/**
 * Bộ giả lập.
 *
 * `WRITABLE` là danh sách tiền tố thư mục mà `io.open` chịu mở — mô phỏng đúng
 * thực tế: ghi vào thư mục không tồn tại thì thất bại. Không có nó thì mọi
 * đường dẫn đều "ghi được" và kịch bản `desktop_path = nil` không kiểm được gì.
 */
const DRIVER = String.raw`
package.loaded['imports/other/helpers'] = true

CAPTURED, LOGS, BOX, TOUCHED_CURSOR = {}, {}, nil, false

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
  cm_teamsheets = { "teamid", "sourceformationid", "playerid0", "playerid1", "captainid" },
  formations = { "formationid", "formationname", "position0", "offset0x", "offset0y" },
  teamformationteamstylelinks = { "teamid", "formationid" },
  teamplayerlinks = { "playerid", "teamid", "jerseynumber", "position" },
  teams = { "teamid", "teamname" },
  players = { "playerid", "overallrating", "potential" },
  transfers = { "playerid", "teamid" },          -- co schema NHUNG khong co du lieu
  bang_no = { "x" },                             -- GetDBTableRows se nem loi
  assetcryptokeys = { "keyid" },
}

function GetDBTablesNames()
  return { "assetcryptokeys", "players", "transfers", "teams", "teamplayerlinks",
           "bang_no", "formations", "cm_teamsheets", "teamformationteamstylelinks",
           "bang_hong_schema" }
end

function GetDBTableFields(name)
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
  if name == "bang_no" then error("no khi doc du lieu") end
  if name == "transfers" then return nil end          -- dung cach transfers that hoat dong
  if name == "assetcryptokeys" then return nil end
  if name == "cm_teamsheets" then
    return { wrap({ teamid = 115486, sourceformationid = 7, playerid0 = 460011,
                    playerid1 = 271266, captainid = 261299 }) }
  elseif name == "formations" then
    return { wrap({ formationid = 7, formationname = "4-2-3-1", position0 = 0,
                    offset0x = 0.0, offset0y = -1.0 }) }
  elseif name == "teamformationteamstylelinks" then
    return { wrap({ teamid = 115486, formationid = 7 }) }
  elseif name == "teamplayerlinks" then
    return { wrap({ playerid = 460011, teamid = 115486, jerseynumber = 12, position = 0 }),
             wrap({ playerid = 271266, teamid = 115486, jerseynumber = 28, position = 3 }) }
  elseif name == "teams" then
    return { wrap({ teamid = 115486, teamname = "Arsenal, The" }) }
  elseif name == "players" then
    -- CHUOI chu khong phai number. GetDBTableRows that tra ve kieu nay, va mot
    -- phep kiem type(x) == "number" se truot IM LANG: luot chay ra 21.437
    -- dong voi 0 ten ma khong co dong log loi nao.
    return { wrap({ playerid = "158023", overallrating = "90", potential = "90" }),
             wrap({ playerid = "460021", overallrating = "66", potential = "94" }),
             wrap({ playerid = "999", overallrating = "70", potential = "75" }) }
  end
  return nil
end

local NAMES = { [158023] = "Lionel Messi", [460021] = 'Ren "Teo" Imada, Jr.',
                [999] = "Nguyen Van A" }
function GetPlayerName(pid) return NAMES[pid] or "" end
function GetTeamIdFromPlayerId(pid) return pid == 999 and -1 or 115486 end
function GetTeamName(tid) return tid == 115486 and "Arsenal, The" or "" end

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

  lua.lua_newtable(L);
  lua.lua_setglobal(L, to_luastring("ORDER"));

  lua.lua_newtable(L);
  for (const [k, v] of Object.entries(env)) {
    lua.lua_pushstring(L, to_luastring(k));
    lua.lua_pushstring(L, to_luastring(v));
    lua.lua_rawset(L, -3);
  }
  lua.lua_setglobal(L, to_luastring("ENV"));

  const status = lauxlib.luaL_dostring(L, to_luastring(DRIVER));
  const error_ = status !== lua.LUA_OK ? lua.lua_tojsstring(L, -1) : null;
  if (error_) return { error: error_, files: {}, order: [], box: null, cursor: false };

  /** CAPTURED: bảng của bảng — mỗi file là mảng các mẩu đã ghi. */
  const readFiles = () => {
    const out = {};
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
      out[key] = content;
      lua.lua_pop(L, 1);
    }
    lua.lua_pop(L, 1);
    return out;
  };

  /** ORDER: mảng chuỗi phẳng — thứ tự file được mở, để kiểm thứ tự ưu tiên. */
  const readOrder = () => {
    const out = [];
    lua.lua_getglobal(L, to_luastring("ORDER"));
    const n = lua.lua_rawlen(L, -1);
    for (let i = 1; i <= n; i += 1) {
      lua.lua_rawgeti(L, -1, i);
      out.push(lua.lua_tojsstring(L, -1));
      lua.lua_pop(L, 1);
    }
    lua.lua_pop(L, 1);
    return out;
  };

  const files = readFiles();
  const order = readOrder();

  lua.lua_getglobal(L, to_luastring("BOX"));
  const box = lua.lua_isnil(L, -1) ? null : lua.lua_tojsstring(L, -1);
  lua.lua_pop(L, 1);
  lua.lua_getglobal(L, to_luastring("TOUCHED_CURSOR"));
  const cursor = lua.lua_toboolean(L, -1);

  return { error: null, files, order, box, cursor };
}

// ── 1. Bình thường ──────────────────────────────────────────────────────────
console.log("\n1. desktop_path hợp lệ — cào toàn bộ");
const a = run({ desktopPath: "C:\\Desktop", writable: ["C:\\Desktop"] });
check("chạy không ném lỗi", !a.error, a.error ?? "");
check("có fc26_manifest.csv", !!a.files["fc26_manifest.csv"]);
check("có fc26_cm_teamsheets.csv (team sheet)", !!a.files["fc26_cm_teamsheets.csv"]);
check("có fc26_formations.csv (hình học sân)", !!a.files["fc26_formations.csv"]);
check("có fc26_teamplayerlinks.csv (số áo + vị trí)", !!a.files["fc26_teamplayerlinks.csv"]);
check("có fc26_players.csv", !!a.files["fc26_players.csv"]);
check("có fc26_log.txt", !!a.files["fc26_log.txt"]);

// ── 2. BẤT BIẾN: không bao giờ chạm API con trỏ ─────────────────────────────
console.log("\n2. BẤT BIẾN — API con trỏ là thứ đã giết game");
check("KHÔNG chạm vào LE.db", !a.cursor);

// ── 3. Bảng hỏng không được làm hỏng cả lượt ────────────────────────────────
console.log("\n3. Bảng lỗi phải bị bỏ qua, không giết lượt chạy");
check("`transfers` (GetDBTableRows trả nil) bị bỏ qua", !a.files["fc26_transfers.csv"]);
check("`bang_no` (ném lỗi khi đọc) bị bỏ qua", !a.files["fc26_bang_no.csv"]);
check(
  "bảng đọc lỗi cột vẫn vào manifest",
  /^bang_hong_schema,,$/m.test((a.files["fc26_manifest.csv"] ?? "").trim()),
);
check("các bảng sau đó VẪN được dump", !!a.files["fc26_teams.csv"]);

// ── 4. Thứ tự ưu tiên ───────────────────────────────────────────────────────
console.log("\n4. Thứ tự — thứ quý nhất phải ghi trước");
const dataFiles = a.order.filter((f) => f.startsWith("fc26_") && f.endsWith(".csv"));
const iSheet = dataFiles.indexOf("fc26_cm_teamsheets.csv");
const iPlayers = dataFiles.indexOf("fc26_players.csv");
check("manifest ghi đầu tiên", dataFiles[0] === "fc26_manifest.csv", dataFiles[0]);
check("cm_teamsheets trước players", iSheet >= 0 && iSheet < iPlayers, `${iSheet} < ${iPlayers}`);

// ── 5. Nội dung ─────────────────────────────────────────────────────────────
console.log("\n5. Nội dung CSV");
const players = a.files["fc26_players.csv"] ?? "";
check("players có cột tra cứu riêng", players.startsWith("playerid_key,player_name,current_teamid,current_teamname,"));
check("bọc đúng tên có dấu phẩy và dấu nháy", players.includes('"Ren ""Teo"" Imada, Jr."'));
check("bọc đúng tên đội có dấu phẩy", players.includes('"Arsenal, The"'));
check("số thực nguyên in ra không có .0", /(^|,)70(,|$)/m.test(players) && !players.includes("70.0"));
check("cầu thủ không đội -> tên đội trống", /,-1,,/.test(players));
check(
  "cm_teamsheets giữ đủ cột",
  (a.files["fc26_cm_teamsheets.csv"] ?? "").includes("sourceformationid"),
);
// Lỗi đã xảy ra thật: GetDBTableRows trả ô dạng CHUỖI, phép kiểm kiểu trượt im
// lặng, và cả lượt chạy ra 21.437 dòng với 0 tên.
check("tra được tên dù giá trị ô là CHUỖI", players.includes("Lionel Messi"));
check("tra được mã đội dù giá trị ô là CHUỖI", /,115486,/.test(players));

// ── 6. desktop_path nil ─────────────────────────────────────────────────────
console.log("\n6. desktop_path = nil — lỗi từng làm mất một lượt chạy");
const b = run({
  desktopPath: null,
  writable: ["C:\\Users\\x\\Desktop"],
  env: { USERPROFILE: "C:\\Users\\x" },
});
check("KHÔNG ném lỗi", !b.error, b.error ?? "");
check("vẫn ghi được dữ liệu", !!b.files["fc26_cm_teamsheets.csv"]);
check("không ghi vào thư mục tên 'nil'", !JSON.stringify(b.files).includes("nil\\\\"));

// ── 7. Không thư mục nào ghi được ───────────────────────────────────────────
console.log("\n7. Không thư mục nào ghi được — phải dừng NGAY, không quét");
const c = run({ desktopPath: null, writable: [], env: {} });
check("KHÔNG ném lỗi", !c.error, c.error ?? "");
check("báo lỗi rõ ràng qua hộp thoại", !!c.box && c.box.includes("KHONG GHI DUOC"));
check("không quét (không sinh file nào)", Object.keys(c.files).length === 0);

// ── 8. Mốc tiến độ ──────────────────────────────────────────────────────────
console.log("\n8. Mốc tiến độ — cách duy nhất truy ra bảng gây crash");
check(
  "chạy xong thì fc26_progress.txt ghi 'xong'",
  (a.files["fc26_progress.txt"] ?? "").includes("xong"),
);

mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(a.files)) {
  writeFileSync(join(OUT, name), content, "utf8");
}

console.log(
  failed === 0 ? `\nTất cả đều đạt. File mẫu ở ${OUT}` : `\n${failed} mục KHÔNG đạt.`,
);
process.exit(failed === 0 ? 0 : 1);

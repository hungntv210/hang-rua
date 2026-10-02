/**
 * Kiểm phần logic thuần của giao diện (không cần trình duyệt).
 *
 *   npm run check:ui
 *
 * Mỗi phép kiểm có CẢ phía đúng lẫn phía sai: một `isActive` luôn trả `true`
 * hay luôn trả `false` đều phải bị bắt.
 */
import { NAV_ITEMS, isActive, type NavItem } from "../lib/nav";

let failed = 0;
function check(name: string, ok: boolean) {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
}

const byId = (id: string): NavItem => {
  const item = NAV_ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`NAV_ITEMS thiếu mục "${id}"`);
  return item;
};

// --- Menu -------------------------------------------------------------
check("menu có đúng 5 mục", NAV_ITEMS.length === 5);
check(
  "thứ tự và màu khớp spec",
  NAV_ITEMS.map((i) => `${i.id}:${i.tone}`).join(",") ===
    "home:navy,schedule:royal,standings:aqua,cup:sky,save-reader:salmon",
);

const home = byId("home");
const schedule = byId("schedule");
const standings = byId("standings");
const cup = byId("cup");
const save = byId("save-reader");

check("/ sáng Trang chủ", isActive("/", home));
check("/football/standings/premier-league không sáng Trang chủ", !isActive("/football/standings/premier-league", home));
check("/save-reader không sáng Trang chủ", !isActive("/save-reader", home));
check("/football sáng Lịch đấu", isActive("/football", schedule));
check("/football/league/premier-league sáng Lịch đấu", isActive("/football/league/premier-league", schedule));
check("/football/standings không sáng Lịch đấu", !isActive("/football/standings", schedule));
check("/football/standings/la-liga sáng Xếp hạng", isActive("/football/standings/la-liga", standings));
check("/football/bracket/champions-league sáng Cúp", isActive("/football/bracket/champions-league", cup));
check("/football/bracket không sáng Xếp hạng", !isActive("/football/bracket", standings));
check("/save-reader/fc27 sáng Save Reader", isActive("/save-reader/fc27", save));
check("/ không sáng Save Reader", !isActive("/", save));
// Mỗi đường dẫn chỉ sáng ĐÚNG MỘT mục.
for (const path of ["/", "/football", "/football/league/serie-a", "/football/standings", "/football/bracket", "/save-reader/fc26"]) {
  const lit = NAV_ITEMS.filter((i) => isActive(path, i)).length;
  check(`${path} sáng đúng 1 mục (đang ${lit})`, lit === 1);
}

if (failed > 0) {
  console.error(`\n${failed} phép kiểm trượt.`);
  process.exit(1);
}
console.log("\nTẤT CẢ ĐẠT.");

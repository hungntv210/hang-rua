/**
 * Kiểm lớp đọc asset: `Fc26World` và chuỗi tra tên ba bậc.
 *
 *   npx tsx scripts/check-fc26-lib.ts
 *
 * Ba nhóm ở cuối là các đầu vào mà spec ngầm định nhưng không phần nào của
 * đường chạy bình thường chạm tới: asset hỏng, chỉ số ngoài dải, và dấu 65535.
 * Chúng là chỗ trang dễ vỡ theo kiểu người dùng nhìn thấy nhất.
 */
import { readFileSync } from "node:fs";

import { Fc26Names, collapseDoubledName } from "../lib/fc26/names";
import { Fc26World, loadFc26World } from "../lib/fc26/world";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const world = Fc26World.fromPayload(
  JSON.parse(readFileSync("public/fc26/world.json", "utf8")),
);
const names = Fc26Names.fromPayload(
  JSON.parse(readFileSync("public/fc26/names.json", "utf8")),
);

console.log("── Fc26World ──");
check("tra được tên quốc gia", world.nation(1) === "Albania", String(world.nation(1)));
check("quốc tịch null trả null", world.nation(null) === null);
check("mã quốc gia lạ trả null", world.nation(99_999) === null);
check("tập id gốc đủ lớn", world.shippedIds().size >= 20_000, `${world.shippedIds().size}`);

// `clubOf` phải trả CLB, không phải đội tuyển quốc gia. #158023 là Lionel Messi.
const club = world.clubOf(158023);
check("clubOf trả CLB chứ không phải đội tuyển", !!club && !/Argentina/i.test(club.name),
  club ? `${club.name} · ${club.league}` : "null");
check("clubOf với id không tồn tại trả null", world.clubOf(-1) === null);

console.log("\n── chuỗi tra tên ──");
check("tên thường dùng thắng tên+họ", names.resolve(5982, 40655, 7926) === "Cristiano Ronaldo");
check("ghép tên + họ", names.resolve(21799, 24898, 0) === "Lionel Messi");
// Cầu thủ MỘT tên được game lưu bằng cách đặt tên và họ bằng nhau.
check("mononym không in hai lần", names.resolve(40399, 40399, 0) === "Zothanpuia");
check("collapseDoubledName vẫn chuẩn hoá", collapseDoubledName("Zheng Zheng") === "Zheng");

console.log("\n── đầu vào bất thường ──");
check("dấu 65535 trả null", names.resolve(65535, 5125, 0) === null);
check("chỉ số ngoài mọi dải trả null", names.resolve(9_999_999, 9_999_998, 0) === null);
check("thiếu một mảnh trả null", names.resolve(21799, null, 0) === null);
check("cả ba bằng 0 trả null", names.resolve(0, 0, 0) === null);

/*
 * Asset hỏng phải trả `null` chứ không ném.
 *
 * Trang vẫn phải hiện đủ chỉ số đọc từ save khi mất tên — mất asset làm trang
 * nghèo đi, không được làm hỏng thứ khác. Cổng này dễ vỡ im lặng: đổi `.catch`
 * thành `.then` là hợp đồng mất mà không phép kiểm nào khác thấy.
 *
 * Bọc trong hàm async chứ không dùng `await` ở cấp cao nhất: `process.exit`
 * chạy đồng bộ ngay sau, nên top-level await sẽ thoát trước khi promise xong.
 */
async function checkBrokenAsset() {
  const broken = await loadFc26World("http://127.0.0.1:1/khong-ton-tai.json");
  check("world.json tải hỏng trả null, không ném", broken === null);

  console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
  process.exit(failed ? 1 : 0);
}
void checkBrokenAsset();

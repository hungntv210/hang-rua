/**
 * Cổng kiểm đầu-cuối: bốn save thật, toàn bộ pipeline.
 *
 *   npm run check:fc26
 *
 * Gộp mọi cổng con lại một lệnh, vì việc phải nhớ chạy đúng năm script với
 * đúng đối số chính là nguyên nhân của sự lệch pha mà cả kế hoạch này tồn tại
 * để sửa: `dcplayernames` có trong game từ đầu nhưng bản dựng kho tên không
 * bao giờ được cập nhật để đọc nó.
 *
 * Ba phép kiểm ở mục "tổng thể" chỉ có nghĩa khi nhìn toàn cục, và là những
 * thứ dễ trôi đi nhất khi đổi nguồn dữ liệu. Quan trọng nhất là SỐ NGƯỜI hiển
 * thị: một thay đổi làm mất vài nghìn cầu thủ vẫn khiến mọi phép kiểm về tên
 * đạt 100% — càng ít người thì càng dễ đạt.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Fc26World } from "../lib/fc26/world";
import { parseSaveBuffer } from "../lib/save";

const SAVE_DIR = join(homedir(), "AppData", "Local", "EA SPORTS FC 26", "settings");
/** Chỉ đọc file bắt đầu bằng `Cm` trong thư mục settings của game. */
const SAVES = [
  "CmMgrC20260704192007839",
  "CmMgrC20260729233455335",
  "CmMgrC20260917112651768",
  "CmMgrC20260919014703842",
].map((f) => join(SAVE_DIR, f));

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const run = (label: string, args: string[]) => {
  console.log(`\n══ ${label} ══`);
  try {
    /*
     * Bọc nháy đối số có khoảng trắng.
     *
     * `shell: true` là bắt buộc trên Windows vì `npx` là file `.cmd`, nhưng nó
     * cũng khiến đối số bị shell cắt theo khoảng trắng. Đường dẫn save nằm
     * trong `EA SPORTS FC 26` nên bị cắt làm bốn — và hỏng theo kiểu khó thấy:
     * cổng con vẫn chạy, chỉ là không nhận được save nào, rồi trượt vì "không
     * có dữ liệu" chứ không phải vì lỗi thật.
     */
    const quoted = ["tsx", ...args].map((a) => (a.includes(" ") ? `"${a}"` : a));
    execFileSync("npx", quoted, { stdio: "inherit", shell: true });
  } catch {
    failed += 1;
    console.log(`FAIL  ${label} — cổng con này không đạt`);
  }
};

const present = SAVES.filter((p) => existsSync(p));
if (present.length === 0) {
  console.log("Không tìm thấy file save nào — bỏ qua các cổng cần save.");
}

run("CSV", ["scripts/check-csv.ts"]);
run("dataset_fc26/base", ["scripts/check-fc26-base.ts"]);
run("world.json", ["scripts/check-fc26-world.ts"]);
run("lớp đọc", ["scripts/check-fc26-lib.ts"]);
if (present.length) {
  run("kho tên trên save thật", ["scripts/check-fc26-names.ts", ...present]);
  run("CLB và số áo", ["scripts/check-fc26-club.ts", ...present]);
  for (const p of present) run(`cầu thủ trẻ · ${p.split(/[\\/]/).pop()}`, ["scripts/check-youth.ts", p]);
}

console.log("\n══ tổng thể ══");

const kb = (p: string) => statSync(p).size / 1024;
const total =
  kb("public/fc26/names.json") + kb("public/fc26/world.json") + kb("public/fc26/formations.json");
/*
 * Spec hứa giảm từ ~2,8MB xuống ~1MB. Nới lên 1,4MB để không đỏ chỉ vì một bản
 * cập nhật đội hình làm kho tên dài thêm chút ít — nhưng vẫn đủ chặt để bắt
 * việc ai đó vô tình nướng lại một dataset lớn vào asset.
 */
check("tổng asset dưới 1,4MB", total < 1_400, `${total.toFixed(0)} KB`);

// Không còn dấu vết nguồn công khai.
const gone = !existsSync("public/fc26/players.json") && !existsSync("public/fc26/squads.json");
check("players.json và squads.json đã xoá", gone);

const world = JSON.parse(readFileSync("public/fc26/world.json", "utf8"));
check(
  "world.json có đủ năm phần",
  !!world.squads && !!world.leagueOfTeam && !!world.nationNames && !!world.shippedIds && !!world.utIds,
);

/*
 * SỐ NGƯỜI HIỂN THỊ — mốc chống trôi.
 *
 * Đo trước khi đổi nguồn dữ liệu. Nếu một thay đổi làm mất vài nghìn cầu thủ
 * thì mọi phép kiểm về tên vẫn xanh (ít người thì dễ đạt 100% hơn), và không
 * cổng nào khác thấy. Đây là cổng duy nhất canh điều đó.
 */
const w = Fc26World.fromPayload(JSON.parse(readFileSync("public/fc26/world.json", "utf8")));
const EXPECT: Record<string, number> = {
  CmMgrC20260917112651768: 19_405,
  CmMgrC20260919014703842: 19_336,
};
for (const [file, want] of Object.entries(EXPECT)) {
  const path = join(SAVE_DIR, file);
  if (!existsSync(path)) continue;
  const buf = readFileSync(path);
  const doc = parseSaveBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), {
    fileName: file,
  });
  const shown = (doc.career?.players ?? []).filter((p) => !w.isUltimateTeam(p.playerId)).length;
  check(
    `${file}: số người hiển thị không trôi`,
    Math.abs(shown - want) <= want * 0.01,
    `${shown} (mốc ${want})`,
  );
}

console.log(failed === 0 ? "\nTOÀN BỘ ĐẠT." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

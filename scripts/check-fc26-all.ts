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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { BASE_DIR } from "./fc26-base-tables";
import { Fc26World } from "../lib/fc26/world";
import { parseSaveBuffer } from "../lib/save";

const SAVE_DIR = join(homedir(), "AppData", "Local", "EA SPORTS FC 26", "settings");

/*
 * TỰ TÌM save, không ghim tên file.
 *
 * Bản đầu liệt kê bốn tên cụ thể. Nhưng game đặt tên save theo dấu thời gian và
 * THAY THẾ bản cũ, nên cứ mỗi lần người dùng lưu game là danh sách lệch và cổng
 * đỏ vì một lý do không liên quan gì tới đúng/sai của code. Một cổng đỏ vì lý do
 * sai là cổng sẽ bị bỏ qua.
 *
 * Đòi TỐI THIỂU ba save thay vì một con số cố định: đủ để phép kiểm có ý nghĩa
 * (một save không chứng minh được tính tổng quát — cả kế hoạch này sinh ra từ
 * đúng bài học đó), mà không vỡ khi người dùng chơi tiếp.
 *
 * Chỉ đọc file bắt đầu bằng `Cm`, theo đúng ràng buộc của dự án.
 */
const MIN_SAVES = 3;
const SAVES = existsSync(SAVE_DIR)
  ? readdirSync(SAVE_DIR)
      .filter((f) => f.startsWith("Cm"))
      .sort()
      .map((f) => join(SAVE_DIR, f))
  : [];

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const runNode = (label: string, args: string[]) => {
  console.log(`
== ${label} ==`);
  try {
    execFileSync("node", args, { stdio: "inherit" });
  } catch {
    failed += 1;
    console.log(`FAIL  ${label} — cong con nay khong dat`);
  }
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

/*
 * Thiếu save là TRƯỢT, không phải "bỏ qua".
 *
 * Bản đầu chỉ in một dòng rồi bỏ qua sáu cổng con và vẫn kết thúc bằng "TOÀN BỘ
 * ĐẠT", `exit 0`. Nghĩa là bất kỳ ai không có sẵn bốn file save trong máy —
 * người khác, CI, hoặc chính mình sau khi dọn thư mục settings — chạy lệnh kiểm
 * duy nhất của dự án và được báo xanh mà không một dòng dữ liệu save nào được
 * đọc.
 *
 * Đây đúng là kiểu hỏng đã xảy ra một lần trong chính nhánh này: `shell: true`
 * cắt đường dẫn theo khoảng trắng nên cổng con không nhận được save nào. Lần
 * đó tôi sửa đường vận chuyển; bên tiêu thụ vẫn fail-open, nên bất kỳ lý do
 * nào khác làm mất save đều cho ra cùng một màu xanh.
 */
const present = SAVES;
check(
  `tìm được ít nhất ${MIN_SAVES} file save để kiểm`,
  present.length >= MIN_SAVES,
  `${present.length} save trong ${SAVE_DIR}`,
);

run("CSV", ["scripts/check-csv.ts"]);

/*
 * Cong Lua chay bang fengari (VM Lua trong Node) voi API Live Editor gia lap.
 * `fc26-dump-base.lua` khong chay duoc o day, nhung khong co nghia la khong
 * kiem duoc: bo harness nay da co san trong repo tu hai luot khoi dong game
 * truoc, va ngay lan chay dau no bat duoc mot loi cu phap Lua that trong
 * script moi — loi se ngon mot luot khoi dong game nua neu khong ai chay.
 */
runNode("script Lua chup base", ["scripts/check-lua-base.mjs"]);
runNode("script Lua chup career", ["scripts/check-lua-career.mjs"]);
run("dataset_fc26/base", ["scripts/check-fc26-base.ts"]);
run("world.json", ["scripts/check-fc26-world.ts"]);
run("lớp đọc", ["scripts/check-fc26-lib.ts"]);
if (present.length >= MIN_SAVES) {
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
 * Asset có cũ hơn nguồn không?
 *
 * Mọi cổng khác đọc ASSET và khẳng định asset đúng — không cổng nào hỏi asset
 * có được dựng lại sau lần nguồn đổi gần nhất hay không. Sửa một CSV trong
 * `dataset_fc26/` rồi quên `npm run build:fc26` thì toàn bộ bộ kiểm vẫn xanh,
 * trên đúng cái asset cũ. `builtAt` được ghi vào cả ba payload nhưng trước
 * đây không ai đọc nó.
 *
 * Dùng mtime chứ không dùng `builtAt`: `builtAt` chỉ tới ngày, nên sửa nguồn
 * rồi dựng lại trong cùng một ngày sẽ không phân biệt được.
 */
const newest = (paths: string[]) => Math.max(...paths.map((p) => statSync(p).mtimeMs));
const inputs = [
  ...readdirSync(BASE_DIR).map((f) => join(BASE_DIR, f)),
  "dataset_fc26/ut-ids.json",
].filter((p) => existsSync(p) && statSync(p).isFile());
const assets = ["names.json", "world.json", "formations.json"].map((f) => join("public/fc26", f));
const newestInput = newest(inputs);
const oldestAsset = Math.min(...assets.map((p) => statSync(p).mtimeMs));
check(
  "asset mới hơn mọi file nguồn",
  oldestAsset >= newestInput,
  oldestAsset >= newestInput
    ? ""
    : `nguồn đổi lúc ${new Date(newestInput).toISOString()} — chạy \`npm run build:fc26\``,
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
  CmMgrC20260919235736377: 19_331,
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

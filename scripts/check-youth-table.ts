/**
 * Kiểm việc định vị BẢNG HỌC VIỆN trong file save.
 *
 *   npx tsx scripts/check-youth-table.ts <save…>
 *
 * ─── VÌ SAO BẢNG NÀY QUAN TRỌNG ─────────────────────────────────────────────
 *
 * Trước đây tab Cầu thủ trẻ lọc theo suy luận: "do career sinh ra + tuổi học
 * viện + còn khoảng phát triển". Cách đó lấy về học viện của MỌI câu lạc bộ
 * trong save, không riêng đội người dùng — đo trên một save thật: 47 cầu thủ
 * do career sinh ra, trong khi học viện thật chỉ 16 người.
 *
 * Bảng này nói thẳng ai thuộc học viện của đội người chơi, nên nó thay suy
 * luận bằng dữ liệu.
 *
 * ─── PHÉP KIỂM QUAN TRỌNG NHẤT ──────────────────────────────────────────────
 *
 * Không phải "tìm thấy bảng" mà là **mọi người trong bảng đều là cầu thủ trẻ
 * thật**. Một vùng byte ngẫu nhiên có thể tình cờ cho ra vài số trông như
 * playerId; thứ nó không làm được là cho ra hàng chục id phân biệt mà người
 * nào cũng 14–21 tuổi và còn khoảng phát triển.
 */
import { readFileSync } from "node:fs";

import { Fc26World } from "../lib/fc26/world";
import { parseSaveBuffer } from "../lib/save";
import { findYouthTable } from "../lib/save/career/youth-table";

/*
 * Không có save nào truyền vào là TRƯỢT, không phải "không có gì để kiểm".
 * Vòng lặp 0 vòng rồi `exit 0` là một cổng báo xanh mà không đọc byte nào —
 * đã xảy ra thật trong dự án này.
 */
if (process.argv.length <= 2) {
  console.log("FAIL  không có file save nào được truyền vào — cổng này không kiểm được gì");
  process.exit(1);
}

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const world = Fc26World.fromPayload(
  JSON.parse(readFileSync("public/fc26/world.json", "utf8")),
);
const shipped = world.shippedIds();

/** Dải tuổi học viện. Rộng hơn 14–18 vì cầu thủ có thể ở lại tới 21. */
const MIN_AGE = 14;
const MAX_AGE = 21;

for (const savePath of process.argv.slice(2)) {
  const name = savePath.split(/[\\/]/).pop()!;
  console.log(`\n── ${name} ──`);

  const buf = readFileSync(savePath);
  const doc = parseSaveBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { fileName: name },
  );
  const players = doc.career?.players ?? [];
  if (players.length === 0) {
    check(`${name}: đọc được career`, false);
    continue;
  }
  const byId = new Map(players.map((p) => [p.playerId, p]));

  const youthIds = new Set(
    players
      .filter(
        (p) =>
          !shipped.has(p.playerId) &&
          !world.isUltimateTeam(p.playerId) &&
          p.age !== null &&
          p.age >= MIN_AGE &&
          p.age <= MAX_AGE,
      )
      .map((p) => p.playerId),
  );
  console.log(`       ${youthIds.size} cầu thủ trẻ do career sinh ra trong toàn save`);

  const table = findYouthTable(new Uint8Array(buf), youthIds);
  if (!table) {
    /*
     * Không tìm thấy bảng là kết quả HỢP LỆ, không phải lỗi: một career vừa
     * bắt đầu thì chưa có lứa nào. Nhưng nó phải đi kèm điều kiện — nếu save
     * có sẵn hàng chục cầu thủ trẻ mà không tìm ra bảng, thì đó là bộ định vị
     * hỏng chứ không phải career trống.
     */
    check(
      `${name}: không có bảng thì cũng phải không có mấy cầu thủ trẻ`,
      youthIds.size < 10,
      `${youthIds.size} cầu thủ trẻ nhưng không tìm thấy bảng`,
    );
    continue;
  }

  const ages = table.playerIds
    .map((id) => byId.get(id)?.age)
    .filter((a): a is number => a !== undefined && a !== null);
  console.log(
    `       bảng @${table.offset} · ${table.playerIds.length} dòng · tuổi ${Math.min(...ages)}–${Math.max(...ages)}`,
  );

  check(`${name}: bảng đủ lớn để có nghĩa`, table.playerIds.length >= 6);
  check(
    `${name}: không id nào lặp`,
    new Set(table.playerIds).size === table.playerIds.length,
  );
  // Đây là phép kiểm cốt lõi: một vùng byte ngẫu nhiên không cho ra toàn cầu
  // thủ trẻ thật.
  const known = table.playerIds.filter((id) => byId.has(id));
  const young = known.filter((id) => {
    const a = byId.get(id)!.age;
    return a !== null && a >= MIN_AGE && a <= MAX_AGE;
  });
  check(
    `${name}: mọi người đọc được đều trong dải tuổi học viện`,
    known.length > 0 && young.length === known.length,
    `${young.length}/${known.length}`,
  );
  check(
    `${name}: phần lớn có trong bảng cầu thủ`,
    known.length / table.playerIds.length >= 0.8,
    `${known.length}/${table.playerIds.length}`,
  );
  // Học viện là tập CON của nhóm suy luận cũ, và phải nhỏ hơn hẳn — đó chính
  // là lý do tính năng này tồn tại.
  check(
    `${name}: hẹp hơn cách suy luận cũ`,
    table.playerIds.length <= youthIds.size,
    `${table.playerIds.length} vs ${youthIds.size}`,
  );
  const growth = known
    .map((id) => {
      const p = byId.get(id)!;
      return p.overall !== null && p.potential !== null ? p.potential - p.overall : null;
    })
    .filter((g): g is number => g !== null);
  check(
    `${name}: hầu hết còn khoảng phát triển`,
    growth.filter((g) => g > 0).length / growth.length >= 0.8,
    `${growth.filter((g) => g > 0).length}/${growth.length}`,
  );
}

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

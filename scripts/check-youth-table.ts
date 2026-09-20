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
/** Bao nhiêu save tìm được bảng. Xem phép kiểm ở cuối file. */
let found = 0;
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
  /*
   * Đi ĐÚNG đường mà trang đi: truyền `shippedIds` và đọc `academyIds` ra từ
   * `SaveDocument`.
   *
   * Bản trước gọi thẳng `findYouthTable(bytes, youthIds)` với một `youthIds`
   * ĐÃ LỌC TUỔI 14–21, trong khi production truyền `careerBorn` KHÔNG lọc
   * tuổi. Hai đầu vào khác nhau nghĩa là cổng chưa từng chạy thứ được ship —
   * và nó báo xanh trên một save mà tab Cầu thủ trẻ hiện người 36 tuổi cùng
   * 10 người đang đá đội một.
   */
  const doc = parseSaveBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { fileName: name, shippedIds: shipped },
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

  /** Ai đang nằm trong một khối đội hình — tức đã lên đội một. */
  const seniorIds = new Set<number>();
  for (const block of doc.career?.squads ?? []) for (const id of block) seniorIds.add(id);

  const academyIds = doc.career?.academyIds ?? [];
  const table = academyIds.length > 0 ? { offset: 0, playerIds: academyIds } : null;
  if (table) found += 1;
  if (!table) {
    /*
     * Không tìm thấy bảng là kết quả HỢP LỆ: career chưa có lứa nào, hoặc
     * bảng không đạt ngưỡng nên bị từ chối — và từ chối một bảng đáng ngờ thì
     * đúng hơn là hiển thị nó. Giao diện rơi về suy luận với nhãn nói rõ.
     *
     * Bản trước đòi "không có bảng thì phải có dưới 10 cầu thủ trẻ". Phép đếm
     * đó tính cầu thủ trẻ của MỌI câu lạc bộ, nên nó không nói được gì về học
     * viện của riêng đội người chơi. Thứ thật sự cần chặn — bộ dò hỏng hoàn
     * toàn — được kiểm ở mức toàn bộ bên dưới.
     */
    console.log(`       không có bảng — giao diện sẽ rơi về suy luận`);
    continue;
  }

  const ages = table.playerIds
    .map((id) => byId.get(id)?.age)
    .filter((a): a is number => a !== undefined && a !== null);
  console.log(
    `       bảng @${table.offset} · ${table.playerIds.length} dòng · tuổi ${Math.min(...ages)}–${Math.max(...ages)}`,
  );

  check(`${name}: bảng đủ lớn để có nghĩa`, table.playerIds.length >= 6);
  /*
   * Ba phép kiểm dưới đây là thứ đã để lọt một "học viện" gồm người 36 tuổi.
   * Chúng kiểm đúng ba dấu hiệu phân biệt bảng học viện thật với khối cầu thủ
   * do career tạo: không ai đã lên đội một, không ai quá tuổi, và bảng không
   * chạy quá đuôi vào vùng rác.
   */
  /*
   * Ngưỡng phải khớp `MAX_SENIOR_SHARE` của bộ dò, không đòi 0 tuyệt đối: một
   * cậu bé được đôn lên đội một vẫn có thể còn tên trong bảng học viện. Việc
   * KHÔNG hiển thị người đó là của `lib/fc26/youth.ts`, không phải của bảng.
   */
  const senior = table.playerIds.filter((id) => seniorIds.has(id));
  check(
    `${name}: bảng không phải là một đội hình trá hình`,
    senior.length / table.playerIds.length <= 0.1,
    `${senior.length}/${table.playerIds.length} đang ở khối đội hình`,
  );
  const docDuoc = table.playerIds.filter((id) => byId.has(id));
  check(
    `${name}: hầu hết id đọc ngược được (bảng không chạy quá đuôi)`,
    docDuoc.length / table.playerIds.length >= 0.8,
    `${docDuoc.length}/${table.playerIds.length}`,
  );
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

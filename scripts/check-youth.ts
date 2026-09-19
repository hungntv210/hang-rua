/**
 * Kiểm bộ lọc cầu thủ trẻ trên save thật.
 *
 *   npx tsx scripts/check-youth.ts <save…>
 *
 * Phép kiểm đáng giá nhất là phép kiểm ÂM TÍNH: nội dung Ultimate Team và ô
 * trống trong bảng đều "không có trong roster xuất xưởng" giống hệt cầu thủ
 * học viện, và chúng phải bị loại. Chỉ kiểm "có tìm ra 8 người không" thì một
 * bộ lọc trả về tất cả cũng qua.
 */
import { readFileSync } from "node:fs";

import { Fc26Names } from "../lib/fc26/names";
import { Fc26World } from "../lib/fc26/world";
import { findYouthPlayers } from "../lib/fc26/youth";
import { type LineupPlayer, pickSquad } from "../lib/fc26/lineup";
import { parseSaveBuffer } from "../lib/save";
import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodeAllPlayers } from "../lib/save/career/players";
import { positionName } from "../lib/save/career/schema";
import { findSquads } from "../lib/save/career/squad";

const world = Fc26World.fromPayload(
  JSON.parse(readFileSync("public/fc26/world.json", "utf8")),
);
const known = world.shippedIds();

/*
 * Kho tên qua chính `Fc26Names` — không tự dựng lại logic tra pool ở đây.
 *
 * Bộ kiểm phải đi qua CÙNG chuỗi tra tên mà giao diện đi, nếu không nó mù
 * trước đúng loại lỗi vừa xảy ra: tab cầu thủ trẻ đọc danh sách THÔ thay vì
 * danh sách đã ghép tên, nên hiện `#804279` cho một cầu thủ mà kho tên thừa
 * sức tra ra "James Maddison". Bộ kiểm cũ cũng dùng danh sách thô, nên nó
 * không thể thấy gì.
 */
const names = Fc26Names.fromPayload(
  JSON.parse(readFileSync("public/fc26/names.json", "utf8")),
);

/** Tra tên đúng thứ tự ưu tiên của giao diện: save → kho tên. */
function resolveName(p: {
  name: string | null;
  firstNameId: number | null;
  lastNameId: number | null;
  commonNameId: number | null;
}): string | null {
  return p.name ?? names.resolve(p.firstNameId, p.lastNameId, p.commonNameId);
}

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

/*
 * Không có save nào truyền vào là TRƯỢT, không phải "không có gì để kiểm".
 *
 * Vòng lặp `for (const p of process.argv.slice(2))` với 0 đối số chạy 0 vòng
 * rồi `exit 0` — một cổng báo xanh trong khi không đọc một byte dữ liệu nào.
 * Đã xảy ra thật trong dự án này: `shell: true` cắt đường dẫn chứa khoảng
 * trắng, cổng con không nhận được save nào, và cả bộ vẫn xanh.
 */
if (process.argv.length <= 2) {
  console.log("FAIL  không có file save nào được truyền vào — cổng này không kiểm được gì");
  process.exit(1);
}

for (const savePath of process.argv.slice(2)) {
  const name = savePath.split(/[\\/]/).pop()!;
  console.log(`\n── ${name} ──`);

  const buffer = readFileSync(savePath);
  const doc = parseSaveBuffer(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    { fileName: name },
  );
  const career = doc.career;
  if (!career) {
    check(`${name}: đọc được career`, false);
    continue;
  }

  // Đội hình chính, để loại người đã lên đội một.
  const bytes = new Uint8Array(buffer);
  const loc = locatePlayerTable(bytes)!;
  const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);
  const byId = new Map<number, LineupPlayer>(
    decodeAllPlayers(reader, loc.count).map((p) => [
      p.playerId,
      { playerId: p.playerId, position: positionName(p.positionCode), overall: p.overall },
    ]),
  );
  const squad =
    pickSquad(findSquads(bytes, new Set(byId.keys())).map((s) => s.playerIds), byId) ?? [];

  // Ghép tên TRƯỚC khi lọc, đúng thứ tự giao diện làm.
  const enriched = career.players.map((p) => ({ ...p, name: resolveName(p) }));
  const { players, stats } = findYouthPlayers(enriched, known, new Set(squad));
  console.log(
    `       ${stats.careerCreated} do career sinh ra → loại ${stats.inSenior} ở đội một, ` +
      `${stats.tooOld} quá tuổi, ${stats.implausible} vô lý → còn ${players.length}`,
  );

  for (const p of players) {
    console.log(
      `       #${p.playerId} ${p.age}t ${p.position.padEnd(4)} ` +
        `CS ${p.overall}/${p.potential} cao ${p.heightCm} ${p.name ?? "(chưa tra được tên)"}`,
    );
  }

  // ── Bất biến: rác phải bị loại hết ──────────────────────────────────────
  check(`${name}: loại được rác`, stats.implausible + stats.tooOld > 0, `${stats.careerCreated} ứng viên thô`);
  check(
    `${name}: mọi người còn lại đều trong dải tuổi học viện`,
    players.every((p) => p.age !== null && p.age >= 14 && p.age <= 21),
  );
  check(
    `${name}: mọi người còn lại đều còn khoảng phát triển`,
    players.every((p) => (p.potential ?? 0) > (p.overall ?? 0)),
  );
  check(
    `${name}: không ai đang ở đội hình chính`,
    players.every((p) => !squad.includes(p.playerId)),
  );
  check(
    `${name}: thể hình hợp lý`,
    players.every((p) => (p.heightCm ?? 0) >= 150 && (p.heightCm ?? 0) <= 215),
  );
  check(
    `${name}: không lọt nội dung Ultimate Team (chỉ số 88+ mà vẫn gọi là trẻ)`,
    players.every((p) => (p.overall ?? 0) < 88),
  );
  check(`${name}: sắp theo tiềm năng giảm dần`, players.every((p, i) =>
    i === 0 ? true : (players[i - 1].potential ?? 0) >= (p.potential ?? 0),
  ));

  /*
   * Tên không được lặp từ đầu.
   *
   * Lỗi đã xảy ra thật: ô thứ ba của bản ghi tên là HỌ ở career này nhưng là
   * TÊN ĐẦY ĐỦ ở career khác, nên phép ghép "ô 0 + ô 2" cho ra "Shane Shane
   * Kluivert" ở 9/19 cầu thủ regen. Trông vẫn như một cái tên, nên không ai
   * nhận ra cho tới khi đọc kỹ danh sách.
   */
  const dup = enriched.filter((p) => {
    if (!p.name) return false;
    const w = p.name.split(/\s+/);
    return w.length >= 2 && w[0] === w[1];
  });
  check(`${name}: tên không bị lặp từ đầu`, dup.length === 0, dup.slice(0, 3).map((p) => p.name).join(", "));

  /*
   * Không ai bị bỏ trống tên khi kho tên tra được.
   *
   * Đây là phép kiểm bắt được lỗi vừa sửa. Cầu thủ thật sự không tra được thì
   * vẫn chấp nhận — cái sai là để trống một người mà nguồn dữ liệu có sẵn.
   */
  const lostName = players.filter((p) => !p.name && resolveName({ ...p, name: null }));
  check(
    `${name}: không bỏ sót tên mà kho tên tra được`,
    lostName.length === 0,
    lostName.slice(0, 3).map((p) => `#${p.playerId}`).join(", "),
  );
  const unnamed = players.filter((p) => !p.name);
  console.log(`       ${unnamed.length}/${players.length} không tra được tên (kho tên thiếu)`);
}

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

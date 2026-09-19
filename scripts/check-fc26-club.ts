/**
 * Kiểm số áo và nhận diện CLB, trên save thật.
 *
 *   npx tsx scripts/check-fc26-club.ts <save…>
 *
 * Kế thừa `scripts/check-squads.ts` (Fc26Squads/squads.json), xoá ở Task 6 vì
 * nguồn dữ liệu đã chuyển sang `Fc26World`/`world.json`. Phép kiểm quan trọng
 * nhất không phải "có số áo" mà là **asset KHÔNG chứa đội hình xuất phát**.
 * Cột `position` bị cố ý bỏ khỏi file; nếu ai đó thêm lại thì lỗi đã gỡ bỏ
 * trước đây quay lại, và nó quay lại một cách im lặng.
 *
 * ─── MỐC SO SÁNH, ĐO TRÊN `main` BẰNG CHÍNH `check-squads.ts` SẮP BỊ XOÁ ────
 *
 *   ok  có dữ liệu đội — 835 đội
 *   ok  KHÔNG chứa mã vị trí
 *   FAIL  CmMgrC20260704192007839: chọn được khối đội hình   <- ĐÃ ĐỎ TỪ TRƯỚC
 *   FAIL  CmMgrC20260729233455335: chọn được khối đội hình   <- ĐÃ ĐỎ TỪ TRƯỚC
 *   ok  CmMgrC20260917112651768: từ chối thay vì đoán bừa    (CLB tự tạo, 24 cầu thủ)
 *   ok  CmMgrC20260919014703842: nhận ra CLB — Brighton, 25/28 phiếu, 25/28 có số áo
 *
 * Đã tự chạy lại `check-squads.ts` trên chính bốn save này trước khi xoá, và
 * kết quả khớp nguyên văn số đo trên. Hai FAIL đó là `pickSquad` không tìm ra
 * khối đội hình trong hai save tháng 7 — lỗi có TRƯỚC nhánh này, không liên
 * quan tới nguồn dữ liệu (squads.json hay world.json thì cũng vậy, vì cả hai
 * đọc chung một khối đội hình đầu vào từ `findSquads`/`pickSquad`). Ở đây in
 * CẢNH BÁO cho đúng hai save đó thay vì FAIL, để người sau không tưởng đây là
 * lỗi do đổi nguồn — nhưng KHÔNG hạ ngưỡng chung: một save khác lỡ trượt
 * `pickSquad` vẫn phải báo FAIL, vì đó có thể là một hồi quy thật.
 */
import { readFileSync } from "node:fs";

import { type LineupPlayer, pickSquad } from "../lib/fc26/lineup";
import { Fc26World } from "../lib/fc26/world";
import { BitRecordReader } from "../lib/save/bitreader";
import { locatePlayerTable } from "../lib/save/career/locate";
import { decodeAllPlayers } from "../lib/save/career/players";
import { positionName } from "../lib/save/career/schema";
import { findSquads } from "../lib/save/career/squad";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};
const warn = (label: string, detail = "") => {
  console.log(`WARN  ${label}${detail ? ` — ${detail}` : ""}`);
};

/*
 * Danh sách miễn trừ giờ RỖNG — và việc nó từng không rỗng là một bài học.
 *
 * Hai save tháng 7 từng trượt "chọn được khối đội hình", và tôi xếp chúng vào
 * đây như một "mốc đã biết, không liên quan tới nguồn dữ liệu". Sai: cả hai
 * trượt vì `findSquads` quét nhảy 4 byte một trong khi khối của chúng nằm ở
 * offset lệch. Cùng một lỗi sau đó làm hỏng một save MỚI của người dùng —
 * và lúc đó nó không còn được miễn trừ nên mới lộ ra.
 *
 * Nói cách khác: gán nhãn "đã biết" cho một triệu chứng chưa tìm ra nguyên
 * nhân đã che đúng cái lỗi đó thêm một thời gian nữa. Giữ danh sách này rỗng;
 * thêm tên vào đây chỉ hợp lệ khi đã BIẾT nguyên nhân và nguyên nhân đó thật
 * sự nằm ngoài phạm vi dự án.
 */
const KNOWN_PICKSQUAD_GAPS = new Set<string>([]);

const rawJson = readFileSync("public/fc26/world.json", "utf8");
const payload = JSON.parse(rawJson);
const world = Fc26World.fromPayload(payload);

console.log("── asset ──");
check("có dữ liệu đội", Object.keys(payload.squads ?? {}).length > 100, `${payload.teamCount} đội`);
check("có tên đội", Object.keys(payload.names ?? {}).length > 100);
// Bất biến: đội hình xuất phát KHÔNG được nướng vào đây.
check(
  "KHÔNG chứa mã vị trí (đội hình xuất phát)",
  !("positions" in payload) && !rawJson.includes('"position'),
);

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

  const bytes = new Uint8Array(readFileSync(savePath));
  const loc = locatePlayerTable(bytes);
  if (!loc) {
    check(`${name}: định vị được bảng cầu thủ`, false);
    continue;
  }
  const reader = new BitRecordReader(bytes, loc.base, loc.recordBytes, loc.count);
  const byId = new Map<number, LineupPlayer>(
    decodeAllPlayers(reader, loc.count).map((p) => [
      p.playerId,
      { playerId: p.playerId, position: positionName(p.positionCode), overall: p.overall },
    ]),
  );
  const squad = pickSquad(
    findSquads(bytes, new Set(byId.keys())).map((s) => s.playerIds),
    byId,
  );
  if (!squad) {
    if (KNOWN_PICKSQUAD_GAPS.has(name)) {
      warn(`${name}: chọn được khối đội hình`, "biết trước, không liên quan tới world.json — xem đầu file");
    } else {
      check(`${name}: chọn được khối đội hình`, false);
    }
    continue;
  }

  const club = world.matchClub(squad);
  if (!club) {
    // CLB tự tạo — không nhận ra được, và đó là hành vi ĐÚNG. Đoán bừa tệ hơn
    // im lặng: ngưỡng cũ 0,4 từng khớp một CLB tự tạo với "AFC Bournemouth"
    // chỉ vì chín cầu thủ trong đội vốn từ đó.
    console.log(`       không nhận ra CLB (${squad.length} cầu thủ) — đúng với CLB tự tạo`);
    check(`${name}: từ chối thay vì đoán bừa`, true);
    continue;
  }
  const covered = squad.filter((id) => club.jerseyOf.has(id)).length;
  console.log(
    `       CLB ${club.teamId} "${club.name}" (${club.league ?? "?"}) · ${club.matched}/${club.total} phiếu · ` +
      `${covered}/${squad.length} có số áo`,
  );
  check(`${name}: nhận ra CLB có tên`, !!club.name, club.name ?? "");
  check(`${name}: nhận ra giải đấu`, !!club.league, club.league ?? "");
  check(`${name}: đa số rõ rệt`, club.matched / club.total >= 0.6);
  check(`${name}: phần lớn có số áo`, covered / squad.length >= 0.6, `${covered}/${squad.length}`);

  const jerseys = squad.map((id) => club.jerseyOf.get(id)).filter((j): j is number => !!j);
  check("số áo không trùng nhau", new Set(jerseys).size === jerseys.length);
  check("số áo nằm trong dải hợp lệ", jerseys.every((j) => j >= 1 && j <= 99));

  // CLB thật phải tra ngược được từ một cầu thủ bất kỳ trong đội, và phải ra
  // CLB chứ không phải đội tuyển quốc gia — thứ dataset công khai không làm được.
  const sample = squad.find((id) => club.jerseyOf.has(id));
  const back = sample === undefined ? null : world.clubOf(sample);
  check(`${name}: clubOf tra ngược ra đúng CLB`, back?.name === club.name,
    `${back?.name ?? "null"} vs ${club.name}`);
}

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

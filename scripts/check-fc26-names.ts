/**
 * Kiểm kho tên trên bốn file save thật.
 *
 *   npx tsx scripts/check-fc26-names.ts <save…>
 *
 * Số cần theo dõi là độ phủ của KHO TÊN MỘT MÌNH, không phải của cả chuỗi tra
 * tên. Suốt một thời gian dài chuỗi đo được 99,98% trong khi kho tên chỉ đạt
 * 85% và `players.json` âm thầm gánh 15% — số tổng đẹp đã che mất điều đó.
 * Nên ở đây cố ý KHÔNG dùng `players.json`.
 */
import { readFileSync } from "node:fs";

import { Fc26Names } from "../lib/fc26/names";
import { readNewgenNames } from "../lib/save/career/newgen-names";
import { parseSaveBuffer } from "../lib/save";
import { readCsv } from "./csv";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const payload = JSON.parse(readFileSync("public/fc26/names.json", "utf8"));
const names = Fc26Names.fromPayload(payload);

console.log("── asset ──");
check("là bảng gốc, không phải suy ra", payload.exact === true);
check("một kho dùng chung", !!payload.pool && !payload.first);
check("đủ mục", payload.count >= 46_000, `${payload.count} tên`);
// Dải 44.000+ là `dcplayernames` — bảng bị bỏ sót suốt và là nguyên nhân
// khiến 15% cầu thủ phải nhờ `players.json`.
check(
  "có dải dcplayernames (44.000+)",
  payload.pool.id.some((n: number) => n >= 44_000),
);
check("không mục nào rỗng", payload.pool.text.every((s: string) => s.trim().length > 0));
check(
  "không nameid trùng",
  new Set(payload.pool.id).size === payload.pool.id.length,
);

/*
 * Hai dải nguồn có giao nhau không?
 *
 * Hôm nay không: `playernames` phủ 0–41.189, `dcplayernames` từ 44.000. Nhưng
 * bản cập nhật đội hình sau có thể lấp khoảng giữa, và khi đó bản dựng phải
 * chọn một bên — im lặng chọn bừa là cách hỏng tệ nhất vì tên vẫn hiện ra,
 * chỉ là sai người. Kiểm ngay tại nguồn, không kiểm ở đầu ra: đầu ra là một
 * Map nên nó LUÔN không trùng, kể cả khi nguồn trùng.
 */
const idsOf = (t: string) =>
  new Set(readCsv(`dataset_fc26/base/${t}.csv`).map((r) => Number(r.nameid)));
const a = idsOf("playernames");
const clash = [...idsOf("dcplayernames")].filter((id) => a.has(id));
check("hai bảng tên không giao nhau", clash.length === 0, `${clash.length} nameid trùng`);

// Nhóm nguy hiểm: `65535` là dấu "không có tên", CÓ THẬT trong save 2026-07-29.
check("65535 không tra ra chữ", names.resolve(65535, 5125, 0) === null);
check("chỉ số ngoài mọi dải trả null", names.resolve(9_999_999, 9_999_998, 0) === null);
check("thiếu một mảnh thì trả null, không ghép nửa vời", names.resolve(21799, null, 0) === null);

for (const savePath of process.argv.slice(2)) {
  const label = savePath.split(/[\\/]/).pop()!;
  const buf = readFileSync(savePath);
  const doc = parseSaveBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { fileName: savePath },
  );
  const players = doc.career?.players ?? [];
  if (!players.length) {
    check(`${label}: đọc được career`, false);
    continue;
  }
  const newgen = readNewgenNames(new Uint8Array(buf));

  let ok = 0;
  const miss: string[] = [];
  for (const p of players) {
    if (newgen.has(p.playerId) || names.resolve(p.firstNameId, p.lastNameId, p.commonNameId)) {
      ok += 1;
    } else if (miss.length < 4) {
      miss.push(`#${p.playerId} f=${p.firstNameId} l=${p.lastNameId} c=${p.commonNameId}`);
    }
  }
  const share = ok / players.length;
  console.log(`\n── ${label} (${players.length} cầu thủ) ──`);
  // Ngưỡng 0,9995 chứ không 1,0: save 2026-07-29 có đúng MỘT bản ghi mang
  // `f=65535`, tức game tự đánh dấu "không có tên". Đòi tuyệt đối sẽ biến một
  // hành vi đúng thành lỗi đỏ.
  check(
    `${label}: kho tên phủ ≥99,95% KHÔNG cần players.json`,
    share >= 0.9995,
    `${ok}/${players.length} = ${(share * 100).toFixed(2)}%${miss.length ? ` · còn ${miss.join(", ")}` : ""}`,
  );
}

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);

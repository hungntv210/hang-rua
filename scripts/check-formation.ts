/**
 * Kiểm việc đọc SƠ ĐỒ CHIẾN THUẬT THẬT từ file save.
 *
 *   npx tsx scripts/check-formation.ts <save…>
 *
 * ─── PHÉP KIỂM QUAN TRỌNG NHẤT ──────────────────────────────────────────────
 *
 * Không phải "tìm thấy 22 số" mà là **22 số đó khớp đúng một hình dạng sân có
 * thật**. Phép thử âm tính đã đo: 709 cửa sổ 22 số ngẫu nhiên lấy quanh vùng
 * đó, 0 cái khớp bất kỳ sơ đồ nào. Nên một lần khớp không phải trùng hợp.
 *
 * Và phép kiểm cứng nhất là ĐỘ NHẠY: hai save chỉ khác nhau ở chỗ người chơi
 * đổi sơ đồ phải cho ra hai sơ đồ khác nhau. Chính chỗ này là thứ bản cũ làm
 * sai — nó đoán sơ đồ từ danh sách cầu thủ, mà danh sách đó không đổi.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { Fc26Formations } from "../lib/fc26/formations";
import { parseSaveBuffer } from "../lib/save";
import { findFormationCoords } from "../lib/save/career/formation";

if (process.argv.length <= 2) {
  console.log("FAIL  không có file save nào được truyền vào — cổng này không kiểm được gì");
  process.exit(1);
}

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const table = Fc26Formations.fromPayload(
  JSON.parse(readFileSync("public/fc26/formations.json", "utf8")),
);
check("bảng sơ đồ nạp được", table.shapes.length >= 30, `${table.shapes.length} hình dạng`);

const seen: string[] = [];
for (const path of process.argv.slice(2)) {
  const label = basename(path);
  const bytes = new Uint8Array(readFileSync(path));

  const t0 = Date.now();
  const found = findFormationCoords(bytes);
  const ms = Date.now() - t0;

  check(`${label}: tìm được khối toạ độ`, !!found, found ? `@${found.offset}, ${ms}ms` : "");
  if (!found) continue;

  // Quét 8,5 MB nằm trong worker cùng lúc với mọi phép đọc khác — chậm thì cả
  // trang chậm theo, nên trần này là một phần của yêu cầu chứ không phải ghi chú.
  check(`${label}: quét đủ nhanh`, ms < 2000, `${ms}ms`);

  const shape = table.matchByCoords(found.coords);
  check(`${label}: khớp một sơ đồ có thật`, !!shape, shape ? shape.name : "không khớp hình dạng nào");
  if (shape) seen.push(`${label}=${shape.name}`);

  /*
   * Đi lại đúng đường mà trang đi, không phải đường tắt.
   *
   * Ba phép kiểm trên gọi thẳng `findFormationCoords`. Nếu `formationCoords`
   * rớt ở một tầng nào đó giữa `readCareerPlayers` và `SaveDocument` thì chúng
   * vẫn xanh trong khi trang không vẽ được gì — chính kiểu sai sót đã xảy ra
   * một lần trong dự án này.
   */
  const doc = parseSaveBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    { fileName: label },
  );
  const viaDoc = doc.career?.formationCoords ?? null;
  check(
    `${label}: toạ độ đi qua được tới SaveDocument`,
    !!viaDoc && viaDoc.length === 22 && viaDoc.every((v, i) => v === found.coords[i]),
    viaDoc ? `${viaDoc.length} số` : "null",
  );
  check(
    `${label}: sơ đồ nhận ra từ SaveDocument khớp`,
    table.matchByCoords(viaDoc)?.id === shape?.id,
    table.matchByCoords(viaDoc)?.name ?? "không khớp",
  );
}

/*
 * Độ nhạy chỉ kiểm được khi có từ hai save trở lên. Với một save thì bỏ qua —
 * nhưng nói ra là đã bỏ qua, chứ không im lặng báo xanh.
 */
const names = new Set(seen.map((s) => s.split("=")[1]));
if (seen.length >= 2) {
  console.log(`\nsơ đồ đọc được: ${seen.join(", ")}`);
  check(
    "phân biệt được sơ đồ giữa các save",
    names.size >= 2,
    names.size >= 2 ? `${names.size} sơ đồ khác nhau` : "mọi save ra cùng một sơ đồ — bộ dò có thể đang đọc hằng số",
  );
} else {
  console.log("\nbỏ qua phép kiểm độ nhạy: cần ít nhất 2 save");
}

console.log(failed === 0 ? "\nĐẠT" : `\n${failed} phép kiểm TRƯỢT`);
process.exit(failed === 0 ? 0 : 1);

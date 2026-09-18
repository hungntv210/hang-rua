/**
 * Bảng team sheet của career có nằm trong file save không, và định vị được không?
 *
 *   npx tsx scripts/probe-teamsheet.ts <save> <fc26_cm_teamsheets.csv>
 *
 * ─── VÌ SAO PHẢI DÒ ─────────────────────────────────────────────────────────
 *
 * Đội hình xuất phát đang hiển thị KHÔNG đọc từ save. Nó lấy từ
 * `public/fc26/formations.json`, một ảnh chụp nướng sẵn từ bản export Live
 * Editor. `build-fc26-formations.ts` biện minh rằng đó là "hằng số theo phiên
 * bản game". Với 871 sơ đồ sân thì đúng. Với BẢNG TEAM SHEET thì sai: nó là
 * trạng thái career, đổi mỗi lần người chơi xếp lại đội hình.
 *
 * ─── VÌ SAO LẦN NÀY CÓ CƠ HỘI, KHÁC VỚI LƯƠNG ───────────────────────────────
 *
 * Dò lương thất bại vì thứ cần tìm là 45 con số rời rạc trong file 15MB, và mỗi
 * giá trị 17 bit xuất hiện ngẫu nhiên ~29.000 lần. Không có tín hiệu.
 *
 * Team sheet thì ngược lại: nó là một DÃY playerId liên tiếp theo đúng thứ tự
 * đã biết. Xác suất 11 số 32 bit liên tiếp trùng ngẫu nhiên là ~2^-200. Một lần
 * khớp là đủ để chốt — đây là loại bằng chứng mạnh nhất có thể có trong file
 * nhị phân.
 */
import { readFileSync } from "node:fs";

const [savePath, csvPath] = process.argv.slice(2);
if (!savePath || !csvPath) {
  console.error("dùng: npx tsx scripts/probe-teamsheet.ts <save> <fc26_cm_teamsheets.csv>");
  process.exit(1);
}

const bytes = new Uint8Array(readFileSync(savePath));
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const text = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
const ci = (n: string) => cols.indexOf(n);

interface Sheet {
  teamId: number;
  name: string;
  slots: number[];
  captain: number;
}
const sheets: Sheet[] = lines.slice(1).map((l) => {
  const c = l.split(",");
  const slots: number[] = [];
  for (let i = 0; i < 49; i += 1) {
    const v = Number(c[ci(`playerid${i}`)]);
    slots.push(Number.isFinite(v) ? v : -1);
  }
  return {
    teamId: Number(c[ci("teamid")]),
    name: c[ci("teamsheetname")] ?? "",
    slots,
    captain: Number(c[ci("captainid")]),
  };
});

console.log(`ground truth: ${sheets.length} team sheet`);
for (const s of sheets) {
  const filled = s.slots.filter((v) => v > 0).length;
  console.log(`  đội ${s.teamId} "${s.name}" — ${filled} suất, đội trưởng ${s.captain}`);
}

/**
 * Tìm mọi vị trí mà một DÃY u32 little-endian xuất hiện liên tiếp.
 *
 * Quét theo giá trị đầu tiên rồi mới so phần còn lại — rẻ hơn hẳn so cả dãy ở
 * mọi offset, và cho cùng kết quả.
 */
function findSequence(seq: number[], step = 1): number[] {
  const out: number[] = [];
  const first = seq[0];
  for (let o = 0; o + seq.length * 4 <= bytes.length; o += step) {
    if (view.getUint32(o, true) !== first) continue;
    let ok = true;
    for (let i = 1; i < seq.length; i += 1) {
      if (view.getUint32(o + i * 4, true) !== seq[i]) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(o);
  }
  return out;
}

for (const s of sheets) {
  console.log(`\n════ đội ${s.teamId} "${s.name}" ════`);
  const xi = s.slots.slice(0, 11);
  console.log(`  XI: ${xi.join(", ")}`);

  // Bước 1: dãy 11 playerId của đội hình xuất phát, sát nhau, thẳng hàng 4 byte.
  let at = findSequence(xi, 4);
  console.log(`  dãy XI liên tiếp (thẳng hàng 4 byte): ${at.length} vị trí`);

  // Bước 2: nếu không thấy, thử mọi offset byte — bảng có thể không thẳng hàng.
  if (at.length === 0) {
    at = findSequence(xi, 1);
    console.log(`  dãy XI liên tiếp (mọi offset byte): ${at.length} vị trí`);
  }

  if (at.length === 0) {
    console.log("  → KHÔNG tìm thấy dãy XI trong file. Bảng không lưu dạng mảng u32 liền nhau.");
    continue;
  }

  for (const o of at.slice(0, 4)) {
    console.log(`\n  ── tại offset ${o} ──`);
    // Cả 49 suất có nằm liền nhau từ đây không?
    let run = 0;
    for (let i = 0; i < 49; i += 1) {
      const v = view.getUint32(o + i * 4, true);
      const want = s.slots[i];
      // Ô trống trong CSV là -1; trong file có thể là 0 hoặc 0xFFFFFFFF.
      const empty = want <= 0 && (v === 0 || v === 0xffffffff || v > 2_000_000);
      if (v === want || empty) run += 1;
      else break;
    }
    console.log(`  ${run}/49 suất khớp liên tiếp`);

    // Đội trưởng và teamid có nằm quanh đó không? Đây là thứ cho biết cách
    // nhận ra ĐÂY LÀ ĐỘI NÀO mà không cần bảng dựng sẵn.
    const around: string[] = [];
    for (let k = -32; k <= 60; k += 1) {
      const p = o + k * 4;
      if (p < 0 || p + 4 > bytes.length) continue;
      const v = view.getUint32(p, true);
      if (v === s.teamId) around.push(`teamid tại +${k * 4}`);
      if (v === s.captain && s.captain > 0) around.push(`captain tại +${k * 4}`);
    }
    console.log(`  mốc nhận dạng: ${around.length ? around.join(", ") : "không thấy teamid/captain quanh đó"}`);
  }
}

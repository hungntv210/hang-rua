/**
 * Tải danh sách cầu thủ FC 26 từ api.msmc.cc và chuẩn hoá thành CSV.
 *
 *   npx tsx scripts/fetch-msmc-db.ts dataset_fc26/msmc-fc26.csv
 *
 * VÌ SAO CẦN NGUỒN NÀY: đây là nguồn công khai duy nhất tìm được có **cầu thủ
 * nữ** (Putellas, Bonmatí, Graham Hansen…). Các nguồn khác — sofifa và trang
 * chính thức EA — đều chỉ có nam, mà FC 26 có đội nữ trong Career Mode. Riêng nó
 * bù được ~1.500 cầu thủ mà sofifa thiếu.
 *
 * HAI CÁI BẪY trong dữ liệu thô, đừng bỏ qua:
 *
 * 1. **Trộn hai đời game.** Endpoint trả cả `fc25` lẫn `fc26` trong cùng mảng.
 *    Không lọc thì chỉ số FC 25 sẽ lẫn vào và ghi đè lên bản FC 26.
 * 2. **Mỗi cầu thủ có nhiều bản `update`.** Phải lấy bản mới nhất, nếu không sẽ
 *    dùng chỉ số của title update cũ.
 *
 * Chỉ số ở đây KHÔNG dùng để hiển thị — trang luôn đọc chỉ số từ file save của
 * người dùng. Nguồn này chỉ cấp tên, CLB, giải và quốc tịch.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const API = "https://api.msmc.cc/api/eafc/players";

interface RawPlayer {
  id?: string;
  name?: string;
  gender?: string;
  nation?: string;
  league?: string;
  team?: string;
  game?: string;
  update?: string;
}

const outPath = process.argv[2] ?? "dataset_fc26/msmc-fc26.csv";

function csvCell(value: string): string {
  const s = (value ?? "").trim();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main(): Promise<void> {
  console.log(`đang tải ${API} …`);
  const res = await fetch(API);
  if (!res.ok) throw new Error(`API trả về HTTP ${res.status}`);
  const all = (await res.json()) as RawPlayer[];
  console.log(`nhận ${all.length} bản ghi thô`);

  // Giữ bản update mới nhất của mỗi cầu thủ, chỉ trong FC 26.
  const latest = new Map<number, RawPlayer & { _update: number }>();
  for (const p of all) {
    if (!String(p.game ?? "").includes("26")) continue;
    const id = Number(p.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const update = Number(p.update) || 0;
    const current = latest.get(id);
    if (!current || update > current._update) latest.set(id, { ...p, _update: update });
  }

  const women = [...latest.values()].filter((p) => p.gender === "F").length;
  console.log(`FC 26: ${latest.size} cầu thủ (nữ: ${women})`);

  const header = ["player_id", "short_name", "club_name", "league_name", "nationality_name"];
  const lines = [header.join(",")];
  for (const [id, p] of latest) {
    const name = (p.name ?? "").trim();
    if (!name) continue;
    lines.push([
      String(id),
      csvCell(name),
      csvCell(p.team ?? ""),
      csvCell(p.league ?? ""),
      csvCell(p.nation ?? ""),
    ].join(","));
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join("\n") + "\n");
  console.log(`đã ghi ${lines.length - 1} cầu thủ -> ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(`Không tải được: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

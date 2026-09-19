/**
 * Nhận ra cầu thủ trẻ do career sinh ra, từ chính file save.
 *
 * ─── VÌ SAO KHÔNG DÙNG NGƯỠNG ID ────────────────────────────────────────────
 *
 * Career đầu dùng ID 460xxx cho cầu thủ học viện; career thứ hai dùng 9xxx. Hai
 * dải không liên quan gì nhau, nên mọi ngưỡng kiểu `id >= 400000` đều là hằng
 * số rút từ đúng một mẫu.
 *
 * Thứ chung cho mọi career: cầu thủ do career sinh ra **không có trong DB nhúng**.
 * DB đó dựng từ roster xuất xưởng của game, còn họ được tạo ra sau. Đây là dấu
 * hiệu duy nhất không phụ thuộc vào career cụ thể nào.
 *
 * ─── VÌ SAO PHẢI LỌC THÊM ───────────────────────────────────────────────────
 *
 * "Không có trong DB" một mình thì bắt nhầm rất nhiều. Đo trên save thật: 61
 * bản ghi không có trong DB, trong đó chỉ 8 là cầu thủ học viện thật. Phần còn
 * lại là nội dung Ultimate Team (chỉ số 90+, tuổi 44) và ô trống trong bảng bị
 * giải mã nhầm (chỉ số 1-2, tuổi 41, chiều cao 133cm).
 *
 * Nên lọc thêm bằng những thứ một cầu thủ trẻ thật phải có: tuổi trong dải học
 * viện, còn khoảng phát triển, và thể hình hợp lý.
 *
 * ─── GIỚI HẠN PHẢI NÓI RA Ở GIAO DIỆN ───────────────────────────────────────
 *
 * Save chứa toàn bộ roster của game, và các CLB máy cũng sinh cầu thủ trẻ. Ở
 * đây KHÔNG có cách chắc chắn biết ai thuộc học viện của người chơi — bảng
 * `career_youthplayers` mới nói được điều đó, và nó chỉ có trong bản export
 * Lua. Danh sách này là suy luận, và chỗ hiển thị phải nói đúng như vậy.
 */

import type { SavePlayer } from "../save/types";

/** Học viện FC nhận từ 15; trên 21 thì không còn là cầu thủ trẻ. */
const MIN_AGE = 14;
const MAX_AGE = 21;

/**
 * Phải còn khoảng phát triển. Cầu thủ trẻ mà tiềm năng bằng đúng chỉ số hiện
 * tại gần như luôn là bản ghi rác chứ không phải người thật.
 */
const MIN_GROWTH = 1;

/** Chiều cao ngoài dải này là ô trống bị giải mã nhầm, không phải người. */
const MIN_HEIGHT = 150;
const MAX_HEIGHT = 215;

export interface YouthFilterStats {
  /** Không có trong DB nhúng — tức do career sinh ra. */
  careerCreated: number;
  /** Bị loại vì ngoài dải tuổi học viện. */
  tooOld: number;
  /** Bị loại vì không còn khoảng phát triển hoặc thể hình vô lý. */
  implausible: number;
  /** Bị loại vì đang ở đội hình chính. */
  inSenior: number;
}

export interface YouthResult {
  players: SavePlayer[];
  stats: YouthFilterStats;
}

/**
 * Lọc ra cầu thủ trẻ do career sinh ra.
 *
 * `knownIds` là tập playerId có trong DB nhúng. `seniorIds` là đội hình chính
 * đọc từ save — cầu thủ trẻ đã được đôn lên đội một thì không còn thuộc danh
 * sách này nữa.
 */
export function findYouthPlayers(
  players: SavePlayer[],
  knownIds: Set<number>,
  seniorIds: Set<number>,
): YouthResult {
  const stats: YouthFilterStats = {
    careerCreated: 0,
    tooOld: 0,
    implausible: 0,
    inSenior: 0,
  };
  const out: SavePlayer[] = [];

  for (const p of players) {
    if (knownIds.has(p.playerId)) continue;
    stats.careerCreated += 1;

    if (seniorIds.has(p.playerId)) {
      stats.inSenior += 1;
      continue;
    }
    if (p.age === null || p.age < MIN_AGE || p.age > MAX_AGE) {
      stats.tooOld += 1;
      continue;
    }
    const growth =
      p.overall !== null && p.potential !== null ? p.potential - p.overall : null;
    const height = p.heightCm;
    if (
      growth === null ||
      growth < MIN_GROWTH ||
      height === null ||
      height < MIN_HEIGHT ||
      height > MAX_HEIGHT
    ) {
      stats.implausible += 1;
      continue;
    }
    out.push(p);
  }

  // Sắp theo TIỀM NĂNG giảm dần, không theo chỉ số hiện tại. Với cầu thủ trẻ,
  // câu hỏi luôn là "ai đáng giữ", và chỉ số hiện tại của một cậu bé 15 tuổi
  // gần như không nói gì về điều đó.
  out.sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0));
  return { players: out, stats };
}

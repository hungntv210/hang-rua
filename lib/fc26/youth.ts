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

/**
 * Tỉ lệ tối thiểu của bảng học viện phải sống sót qua bộ lọc tuổi và đội một.
 *
 * Dưới ngưỡng này thì thứ tìm được gần như chắc chắn không phải bảng học
 * viện, và hiển thị mẩu sót lại của nó dưới nhãn "đọc từ save" còn tệ hơn là
 * thành thật rơi về suy luận.
 */
const MIN_SURVIVING_SHARE = 0.5;

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
  /**
   * `"bang"` khi danh sách đọc thẳng từ bảng học viện trong save — chính xác,
   * đúng đội của người chơi. `"suy-luan"` khi không tìm thấy bảng và phải lọc
   * theo dấu hiệu, khi đó danh sách gom cả học viện của câu lạc bộ khác.
   *
   * Giao diện PHẢI nói ra khác biệt này. Hai chế độ cho hai mức tin cậy rất
   * khác nhau, và người xem không có cách nào tự biết mình đang ở chế độ nào.
   */
  source: "bang" | "suy-luan";
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
  academyIds?: Set<number>,
): YouthResult {
  /*
   * Có bảng học viện thì dùng thẳng, bỏ qua mọi suy luận.
   *
   * Bảng nói ai thuộc học viện của ĐỘI NGƯỜI CHƠI. Cách suy luận bên dưới thì
   * không phân biệt được đội: đo trên một save thật, nó gom 45 cầu thủ trẻ do
   * career sinh ra trong khi học viện thật chỉ 25 người — phần dư là học viện
   * của các câu lạc bộ khác.
   *
   * Vẫn sắp theo tiềm năng như nhánh kia, để hai chế độ nhìn giống nhau.
   */
  if (academyIds && academyIds.size > 0) {
    /*
     * Bảng thu hẹp về ĐÚNG ĐỘI, nhưng không tự nó nói ai còn là cầu thủ trẻ.
     *
     * Bản trước tin bảng tuyệt đối — lọc đúng một điều kiện "có tên trong
     * bảng". Đo trên một save thật, tab hiện ra người 36 tuổi và 10 người
     * đang đá đội một, vì bộ dò bắt trúng khối cầu thủ do career TẠO chứ
     * không phải bảng học viện.
     *
     * Bộ dò giờ đã chặt hơn, nhưng "chặt hơn" không phải "không bao giờ sai".
     * Hai bộ lọc dưới đây là thứ quyết định nội dung thật sự hiển thị, và
     * chúng giống hệt nhánh suy luận — bảng chỉ thêm một điều kiện nữa chứ
     * không thay thế các điều kiện cũ.
     */
    const stats: YouthFilterStats = {
      careerCreated: academyIds.size,
      tooOld: 0,
      implausible: 0,
      inSenior: 0,
    };
    const inTable: SavePlayer[] = [];
    let doc = 0;
    for (const p of players) {
      if (!academyIds.has(p.playerId)) continue;
      doc += 1;
      if (seniorIds.has(p.playerId)) {
        stats.inSenior += 1;
        continue;
      }
      if (p.age === null || p.age < MIN_AGE || p.age > MAX_AGE) {
        stats.tooOld += 1;
        continue;
      }
      inTable.push(p);
    }
    // Người có trong bảng nhưng không đọc ngược được bản ghi.
    stats.implausible = academyIds.size - doc;

    /*
     * Còn quá ít người sống sót nghĩa là bảng này không phải học viện.
     *
     * Thà rơi về suy luận với nhãn "suy luận · mọi CLB" — rộng hơn nhưng nói
     * đúng những gì nó là — còn hơn hiện một danh sách ngắn mang nhãn "học
     * viện của bạn · đọc từ save" mà thật ra là mẩu sót lại của một bảng khác.
     */
    if (inTable.length / academyIds.size >= MIN_SURVIVING_SHARE) {
      inTable.sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0));
      return { players: inTable, source: "bang", stats };
    }
  }

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
  return { players: out, stats, source: "suy-luan" };
}

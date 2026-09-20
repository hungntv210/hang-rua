/**
 * Định vị BẢNG HỌC VIỆN của đội người chơi trong file save.
 *
 * ─── CẤU TRÚC ───────────────────────────────────────────────────────────────
 *
 *     [u32 playerId][12 byte khác] × n
 *
 * Bản ghi 16 byte, bốn byte đầu là `playerId`. Đo trên save thật: 25 dòng liền
 * nhau ở 6.710.564, id `460000..460037` không trùng nhau, và mọi người đọc
 * được đều 14–17 tuổi với chỉ số 53–66 / tiềm năng 62–87.
 *
 * Mười hai byte còn lại chưa giải mã. Bảng `career_youthplayers` của game có
 * các cột `playertier`, `monthsinsquad`, `potentialvariance`,
 * `swinglowpotential` — nhiều khả năng chúng nằm trong đó, nhưng chưa cần tới
 * nên chưa dò.
 *
 * ─── VÌ SAO CẦN BẢNG NÀY ────────────────────────────────────────────────────
 *
 * Trước đây tab Cầu thủ trẻ suy luận: "do career sinh ra + tuổi học viện +
 * còn khoảng phát triển". Cách đó gom học viện của MỌI câu lạc bộ trong save.
 * Đo trên một save thật: 47 cầu thủ do career sinh ra, học viện thật 16 người.
 * Không có cách nào tách 16 khỏi 47 mà không bịa — trừ khi đọc đúng bảng này.
 *
 * ─── VÌ SAO ĐỊNH VỊ ĐƯỢC MÀ KHÔNG CẦN OFFSET ────────────────────────────────
 *
 * Cùng lối với `squad.ts`: cấu trúc TỰ XÁC THỰC. Một vùng byte ngẫu nhiên có
 * thể tình cờ cho ra vài số trông như playerId; thứ nó không làm được là cho
 * ra hàng chục id phân biệt mà người nào cũng nằm trong dải tuổi học viện.
 */

/** Bản ghi 16 byte, đo trên save thật. */
const RECORD_BYTES = 16;

/**
 * Số dòng tối thiểu để nhận là bảng.
 *
 * Dưới ngưỡng này thì một cụm trùng hợp vẫn qua được. Một học viện thật luôn
 * có ít nhất vài người; career chưa có lứa nào thì không có bảng, và trả `null`
 * là câu trả lời ĐÚNG cho trường hợp đó.
 */
const MIN_ROWS = 6;

/**
 * Tỉ lệ dòng phải là cầu thủ trẻ đã biết.
 *
 * Không đòi 100%: bảng cầu thủ của save đã lọc bỏ một số bản ghi (nội dung
 * ngoài Career, bản ghi không hợp lý), nên vài id trong bảng học viện không
 * tra ngược được. Đo trên save thật: 22/25. Đòi tuyệt đối sẽ làm bộ định vị
 * đứt giữa bảng và trả về một mẩu cụt.
 */
const MIN_KNOWN_SHARE = 0.8;

/**
 * Khoảng cách tối đa tới id đã nhận gần nhất, cho một dòng KHÔNG tra ngược được.
 *
 * Bảng cầu thủ của save đã lọc bỏ một số bản ghi, nên vài id trong bảng học
 * viện không có trong `youthIds`. Vẫn phải nhận chúng, nếu không đoạn chạy đứt
 * giữa bảng và trả về một mẩu cụt.
 *
 * Nhưng KHÔNG nới theo toàn bộ dải id do career sinh ra. Bản đầu làm vậy và
 * hỏng nặng: một save thật có id career trải từ 9.001 tới 804.279, nên dải nới
 * khớp gần như mọi số, đoạn chạy lan qua cả dữ liệu khác rồi loãng xuống dưới
 * ngưỡng và bảng thật bị bỏ sót hoàn toàn.
 *
 * Neo vào id LIỀN TRƯỚC thay vì vào cả tập: regen sinh cùng lứa mang id liền
 * nhau, nên một người bị lọc khỏi bảng cầu thủ vẫn nằm sát hàng xóm của mình.
 */
const MAX_ID_GAP = 200;

/**
 * Tỉ lệ tối đa được phép đã ở trong một khối đội hình.
 *
 * Học viện và đội một là hai bảng khác nhau; một dãy mà nửa số người đang đá
 * đội một thì không phải học viện. Đo trên save thật, bộ dò từng bắt trúng
 * khối `460000..460023` — cầu thủ do career TẠO của cả save — trong đó 10/25
 * đang đá đội một và người già nhất 36 tuổi.
 *
 * Không đòi 0%: một cậu bé được đôn lên đội một vẫn có thể còn tên trong bảng
 * học viện, và loại thẳng vì một người như thế sẽ vứt cả bảng thật.
 */
const MAX_SENIOR_SHARE = 0.1;

export interface YouthTable {
  /** Offset byte của dòng đầu. Giữ lại để dò lại bằng hex editor khi cần. */
  offset: number;
  playerIds: number[];
}

/**
 * Tìm bảng học viện.
 *
 * `youthIds` là những cầu thủ do career sinh ra trong dải tuổi học viện, đọc
 * từ bảng cầu thủ — truyền vào thay vì tự dò, vì tầng này không được biết tới
 * `lib/fc26` (nơi giữ tập id roster gốc).
 *
 * Trả `null` khi không có bảng nào đạt ngưỡng. Với career vừa bắt đầu thì đó
 * là câu trả lời đúng, không phải lỗi.
 */
export function findYouthTable(
  bytes: Uint8Array,
  youthIds: Set<number>,
  /** Ai đang nằm trong một khối đội hình. Xem `MAX_SENIOR_SHARE`. */
  seniorIds: Set<number> = new Set(),
): YouthTable | null {
  if (youthIds.size === 0) return null;

  const u32 = (o: number): number =>
    (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;

  let best: YouthTable | null = null;
  let o = 0;
  const limit = bytes.length - RECORD_BYTES * MIN_ROWS;

  while (o <= limit) {
    // Đoạn chạy phải MỞ ĐẦU bằng một người đã biết chắc — không cho phép nó
    // bắt đầu từ một id chỉ "gần đúng".
    if (!youthIds.has(u32(o))) {
      o += 1;
      continue;
    }
    const ids: number[] = [];
    const seen = new Set<number>();
    let lastKnown = u32(o);
    for (let k = 0; ; k += 1) {
      const at = o + k * RECORD_BYTES;
      if (at + 4 > bytes.length) break;
      const v = u32(at);
      // Dòng lặp id nghĩa là đã ra khỏi bảng: một học viện không chứa cùng
      // một người hai lần.
      if (seen.has(v)) break;
      if (youthIds.has(v)) lastKnown = v;
      else if (Math.abs(v - lastKnown) > MAX_ID_GAP) break;
      seen.add(v);
      ids.push(v);
    }

    if (ids.length >= MIN_ROWS) {
      const known = ids.filter((id) => youthIds.has(id)).length;
      const senior = ids.filter((id) => seniorIds.has(id)).length;
      if (
        known / ids.length >= MIN_KNOWN_SHARE &&
        senior / ids.length <= MAX_SENIOR_SHARE &&
        (!best || ids.length > best.playerIds.length)
      ) {
        best = { offset: o, playerIds: ids };
      }
    }
    // Nhảy qua đoạn vừa xét. Không nhích tiến thì vòng lặp treo.
    o += Math.max(1, ids.length * RECORD_BYTES);
  }

  return best;
}

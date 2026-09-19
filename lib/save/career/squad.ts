/**
 * Đọc đội hình câu lạc bộ từ file save.
 *
 * ─── CẤU TRÚC ───────────────────────────────────────────────────────────────
 *
 *     [u32 count][u32 playerId × count]
 *
 * Tìm thấy ở vùng ~8,7MB trên save thật: một khối 24 `u32` liền nhau mà cả 24
 * đều là cầu thủ của CLB người chơi, ngay sau một `u32` bằng đúng 24.
 *
 * ─── VÌ SAO KHÔNG CẦN HẰNG SỐ OFFSET ────────────────────────────────────────
 *
 * Cấu trúc này TỰ XÁC THỰC, nên định vị được ở save bất kỳ mà không cần biết
 * trước offset:
 *
 *   1. `count` phải nằm trong dải một đội bóng thật (11-60)
 *   2. đúng `count` phần tử tiếp theo đều phải là playerId có trong bảng cầu thủ
 *   3. phần tử thứ `count+1` KHÔNG được là playerId hợp lệ — nếu còn là, thì
 *      `count` đọc sai chứ không phải ta tìm đúng khối
 *
 * Ràng buộc 3 quan trọng hơn vẻ ngoài của nó: thiếu nó thì mọi vị trí bên trong
 * một khối dài đều "khớp" và ta lấy ra hàng loạt đội hình chồng lấn.
 *
 * ─── VÌ SAO TRẢ VỀ NHIỀU ỨNG VIÊN ───────────────────────────────────────────
 *
 * Save chứa đội hình của nhiều đội. Ở tầng này không có cách nào biết đội nào là
 * của người chơi — đó là việc của `lib/fc26/formations.ts`, nơi đối chiếu từng
 * ứng viên với bảng đội hình đã biết. Tầng này chỉ đọc cấu trúc, không đoán ngữ
 * nghĩa.
 */

/** Đội bóng thật có 11-60 cầu thủ đăng ký. Ngoài dải này là khớp nhầm. */
const MIN_SQUAD = 11;
const MAX_SQUAD = 60;

/** Không quét quá số này — save lớn mà đội hình chỉ có vài chục. */
const MAX_CANDIDATES = 64;

export interface SquadCandidate {
  /** Offset byte của `count`. Giữ lại để dò lại bằng hex editor khi cần. */
  offset: number;
  playerIds: number[];
}

/**
 * Tìm mọi khối đội hình trong file.
 *
 * `validIds` là tập playerId đọc được từ bảng cầu thủ — truyền vào thay vì tự
 * dò lại, vì bảng đó đã được định vị ở `locate.ts` và đọc lại là phí.
 */
export function findSquads(bytes: Uint8Array, validIds: Set<number>): SquadCandidate[] {
  const u32 = (o: number): number =>
    (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;

  const out: SquadCandidate[] = [];
  const limit = bytes.length - 4;

  /*
   * Quét TỪNG BYTE, không nhảy 4 byte một.
   *
   * Bản đầu nhảy `o += 4` vì khối là một dãy `u32` nên "đương nhiên" phải nằm
   * ở vị trí chia hết cho 4. Sai: đo trên bốn save thật, khối nằm ở
   *
   *     09-17        8,70MB  chia hết cho 4   -> tìm thấy
   *     09-19 23:18  8,64MB  LỆCH             -> bỏ sót
   *     07-04, 07-29         LỆCH             -> bỏ sót
   *
   * Tức ba trên bốn save mất hẳn tab Đội hình, và save duy nhất chạy được là
   * chạy được nhờ MAY. Khối không nằm ở đầu một cấu trúc căn lề — nó nằm giữa
   * một vùng dữ liệu có phần tử độ dài lẻ phía trước.
   *
   * Cái giá là quét 4× số vị trí (15M thay vì 3,75M trên file 15MB). Phép thử
   * đầu tiên của vòng lặp chỉ là một phép so số nguyên, và việc này chạy trong
   * Web Worker, nên không ai thấy. Đổi lại là tính năng chạy được trên mọi
   * save thay vì một phần tư.
   */
  for (let o = 0; o + 4 <= limit; o += 1) {
    const count = u32(o);
    if (count < MIN_SQUAD || count > MAX_SQUAD) continue;

    const end = o + 4 + count * 4;
    if (end + 4 > bytes.length) continue;

    let ok = true;
    for (let k = 0; k < count; k += 1) {
      if (!validIds.has(u32(o + 4 + k * 4))) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    // Phần tử ngay sau khối phải KHÔNG phải cầu thủ, nếu không thì `count` sai.
    if (validIds.has(u32(end))) continue;

    const playerIds: number[] = [];
    for (let k = 0; k < count; k += 1) playerIds.push(u32(o + 4 + k * 4));

    /*
     * Ràng buộc 4: không cầu thủ nào lặp lại.
     *
     * Một danh sách đội hình không thể chứa cùng một người hai lần, nên khối
     * có lặp thì không phải đội hình — dù nó thoả cả ba ràng buộc trên.
     *
     * Đo trên save thật: sau khi chuyển sang quét từng byte, một khối 30 phần
     * tử ở 8,78MB khớp cả ba ràng buộc cũ nhưng chứa Lewis Dunk và Nehemiah
     * Oriola mỗi người hai lần. Nó được chọn thay cho khối 28 phần tử sạch ở
     * 8,64MB chỉ vì dài hơn, và hậu quả hiện lên giao diện thành hai cầu thủ
     * mang cùng số áo.
     *
     * Ràng buộc này chỉ có ý nghĩa từ khi quét từng byte: quét căn lề 4 byte
     * không bao giờ chạm tới những khối như vậy.
     */
    if (new Set(playerIds).size !== playerIds.length) continue;
    out.push({ offset: o, playerIds });

    if (out.length >= MAX_CANDIDATES) break;
    // Nhảy qua khối vừa đọc: mọi vị trí bên trong nó không thể là khối khác.
    o = end - 1;
  }

  return out;
}

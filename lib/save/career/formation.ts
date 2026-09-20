/**
 * Đọc SƠ ĐỒ CHIẾN THUẬT THẬT của người chơi từ file save.
 *
 * ─── VÌ SAO FILE NÀY TỒN TẠI ────────────────────────────────────────────────
 *
 * `lib/fc26/lineup.ts` trước đây ĐOÁN sơ đồ: thử cả 26 hình dạng và giữ cái cho
 * điểm xếp người cao nhất. Đổi sơ đồ trong game rồi tải save mới lên thì trang
 * vẫn vẽ như cũ, vì phép đoán chỉ nhìn vào danh sách cầu thủ — mà danh sách đó
 * không đổi khi người chơi đổi sơ đồ.
 *
 * File này đọc sơ đồ thật, nên chỗ đó hết là phỏng đoán.
 *
 * ─── SAVE LƯU SƠ ĐỒ DƯỚI DẠNG TOẠ ĐỘ, KHÔNG PHẢI MÃ SỐ ──────────────────────
 *
 * Team sheet giữ 22 số thực 32-bit liền nhau — toạ độ 11 ô trên sân, cùng dải
 * giá trị với cột `offset<i>x` / `offset<i>y` của bảng `formations`. Không có
 * trường `formationId` nào ở đó: 24 byte ngay sau khối là vai trò cầu thủ đóng
 * gói bit, không phải mã sơ đồ.
 *
 * Thứ tự 22 số trong save KHÔNG khớp thứ tự ô của bảng — đã loại mọi cách ghép
 * (x,y) và (y,x) liền nhau, và cả cách xếp 11 x rồi 11 y. Nên tầng trên đối
 * chiếu bằng TẬP GIÁ TRỊ chứ không theo thứ tự, rồi lấy toạ độ có thứ tự từ
 * chính bảng. Xem `lib/fc26/formations.ts`.
 *
 * ─── VÌ SAO KHÔNG DÙNG OFFSET CỐ ĐỊNH ───────────────────────────────────────
 *
 * Bộ ghi save dời cả khối: hai save cách nhau 73 giây lệch 33,7% số byte. Mọi
 * thứ ở đây phải tự định vị.
 */

/** Dải toạ độ trong bảng `formations` của game: 0,02 … 0,925. */
const MIN_COORD = 0.0199;
const MAX_COORD = 0.9251;
const SLOTS = 11;
const FLOATS = SLOTS * 2;
const BLOCK_BYTES = FLOATS * 4;

/**
 * Bước của bảng sơ đồ theo CÂU LẠC BỘ — khoảng 840 bản ghi đều nhau.
 *
 * Bảng đó là sơ đồ mặc định của mọi đội trong game, không phải của người chơi:
 * đo trên cặp save trước/sau khi đổi sơ đồ, nó KHÔNG đổi một byte nào, trong
 * khi khối team sheet thì đổi. Nên nó phải bị loại, không phải chỉ xếp sau.
 */
const CLUB_TABLE_STRIDE = 152;

export interface FoundFormation {
  offset: number;
  /** 22 toạ độ, theo đúng thứ tự trong file — thứ tự này KHÔNG phải thứ tự ô. */
  coords: number[];
}

/**
 * Tìm khối toạ độ của team sheet đang dùng.
 *
 * Trả `null` khi không thấy — save của phiên bản khác, hoặc career chưa có
 * team sheet. Gọi bên trên phải chịu được `null` chứ không coi là lỗi.
 */
export function findFormationCoords(bytes: Uint8Array): FoundFormation | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hits: number[] = [];

  for (let off = 0; off + BLOCK_BYTES <= bytes.length; off += 1) {
    /*
     * Lọc nhanh bằng byte mũ trước khi đọc đủ 22 số.
     *
     * Mọi toạ độ hợp lệ nằm trong 0,0199…0,9251, và float32 little-endian
     * trong dải đó luôn có byte cao 0x3c…0x3f. Hai mẫu đủ loại ~99,99% offset,
     * và toàn bộ phép quét 8,5 MB xuống còn ~45 ms — đủ nhanh cho worker.
     */
    const a = bytes[off + 3];
    if (a < 0x3c || a > 0x3f) continue;
    const b = bytes[off + BLOCK_BYTES - 1];
    if (b < 0x3c || b > 0x3f) continue;

    let ok = true;
    for (let i = 0; i < FLOATS; i += 1) {
      const v = dv.getFloat32(off + i * 4, true);
      if (!(v >= MIN_COORD && v <= MAX_COORD)) {
        ok = false;
        break;
      }
    }
    if (ok) hits.push(off);
  }

  /*
   * Bỏ bảng theo câu lạc bộ: bản ghi nào có hàng xóm cách đúng một bước thì
   * thuộc về nó.
   *
   * Lọc theo CẤU TRÚC chứ không theo vị trí. Lấy "offset nhỏ nhất" cũng ra
   * đúng kết quả trên sáu save đã thử, nhưng đó là quan sát về cách sắp xếp
   * của một phiên bản, không phải tính chất của dữ liệu.
   */
  const set = new Set(hits);
  const sheets = hits.filter(
    (o) => !set.has(o - CLUB_TABLE_STRIDE) && !set.has(o + CLUB_TABLE_STRIDE),
  );
  if (sheets.length === 0) return null;

  // Team sheet của chính câu lạc bộ người chơi đứng trước các sheet đội tuyển.
  const offset = sheets[0];
  const coords: number[] = [];
  for (let i = 0; i < FLOATS; i += 1) coords.push(dv.getFloat32(offset + i * 4, true));
  return { offset, coords };
}

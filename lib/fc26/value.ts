/**
 * Ước tính giá trị chuyển nhượng.
 *
 * ─── VÌ SAO PHẢI TÍNH ───────────────────────────────────────────────────────
 *
 * Game KHÔNG lưu con số này ở đâu cả. Không phải "chưa giải mã được" — bảng
 * `players` trong export Live Editor có 149 cột và không cột nào là giá trị
 * chuyển nhượng; toàn bộ ~320 bảng cũng vậy. FC dựng con số ấy lúc chạy từ chỉ
 * số, tuổi và tiềm năng, rồi vứt đi.
 *
 * Nên đây là MÔ HÌNH, cùng hạng với `ovr-model.ts` chứ không cùng hạng với các
 * trường đọc thẳng từ save. Mọi chỗ hiển thị phải giữ được sự phân biệt đó: cột
 * này đi kèm dấu ≈ và một câu chú thích, không bao giờ đứng trơ như số đọc được.
 *
 * ─── MÔ HÌNH ────────────────────────────────────────────────────────────────
 *
 * Ba yếu tố, nhân với nhau chứ không cộng — vì chúng tác động theo tỉ lệ:
 *
 *   1. NỀN THEO OVR. Giá trị tăng theo hàm mũ chứ không tuyến tính: chênh 85→90
 *      đắt hơn chênh 65→70 nhiều lần. Hệ số hiệu chuẩn ở `baseFromOverall`.
 *   2. HỆ SỐ TUỔI. Đỉnh giá rơi vào quãng 24-27. Trẻ hơn thì rẻ hơn chút (chưa
 *      chứng minh được), già hơn thì rớt nhanh, và sau 33 thì rớt rất nhanh.
 *   3. HỆ SỐ TIỀM NĂNG. Khoảng cách POT − OVR là thứ khiến một cầu thủ 19 tuổi
 *      chỉ số 70 đắt hơn một cầu thủ 30 tuổi cùng chỉ số. Chỉ tính cho cầu thủ
 *      còn trẻ: với người đã 30, tiềm năng chưa dùng tới là tiềm năng sẽ không
 *      bao giờ dùng tới.
 *
 * ─── ĐỘ CHÍNH XÁC ───────────────────────────────────────────────────────────
 *
 * Không có ground truth để hiệu chuẩn — đó chính là lý do phải tính. Nên con số
 * này đúng về BẬC ĐỘ LỚN và đúng về THỨ TỰ giữa các cầu thủ, không đúng tới
 * từng triệu. Nó dùng để so sánh trong đội, không dùng để ra quyết định.
 *
 * Và nó thừa hưởng sai số của `overall`, vốn cũng là số tính (±1). Ở vùng OVR
 * cao, lệch 1 điểm kéo theo lệch khoảng 12% giá trị.
 */

/** Tuổi bắt đầu và kết thúc quãng đỉnh giá. */
const PEAK_FROM = 24;
const PEAK_TO = 27;

/**
 * Nền theo OVR, ở tuổi đỉnh: `exp((ovr - 60) / 5) × 0,4 triệu` euro.
 *
 * Hai hằng số hiệu chuẩn theo bậc giá quen thuộc của FC chứ không chọn cho đẹp:
 *
 *   CS 60 → 0,4 tr    CS 75 → 8,0 tr     CS 85 → 59 tr
 *   CS 70 → 3,0 tr    CS 80 → 22 tr      CS 90 → 161 tr
 *
 * Lần hiệu chuẩn đầu dùng mẫu số 7,2 và ra 36 tr cho một cầu thủ 90 — thấp hơn
 * thực tế bốn lần. Sai ở chỗ dễ sai nhất của hàm mũ: mẫu số quyết định độ cong,
 * và kiểm ở vùng giữa (nơi mọi mẫu số đều ra số hợp lý) thì không lộ ra.
 * Phải kiểm ở HAI ĐẦU dải.
 */
function baseFromOverall(overall: number): number {
  return Math.exp((overall - 60) / 5) * 0.4e6;
}

/** Hệ số tuổi: 1,0 ở quãng đỉnh, giảm dần hai phía, rớt mạnh sau 33. */
function ageFactor(age: number): number {
  if (age >= PEAK_FROM && age <= PEAK_TO) return 1;
  if (age < PEAK_FROM) {
    // Cầu thủ trẻ rẻ hơn một chút vì chưa chứng minh được — nhưng phần tiềm năng
    // ở hệ số dưới sẽ bù lại, và bù nhiều hơn với người có POT cao.
    return 0.82 + 0.18 * ((age - 15) / (PEAK_FROM - 15));
  }
  if (age <= 30) return 1 - (age - PEAK_TO) * 0.09;
  if (age <= 33) return 0.73 - (age - 30) * 0.13;
  return Math.max(0.04, 0.34 - (age - 33) * 0.08);
}

/**
 * Hệ số tiềm năng: khoảng cách POT − OVR còn khai thác được.
 *
 * Nhân với phần đời cầu thủ còn lại trước tuổi đỉnh — một người 29 tuổi có POT
 * hơn OVR 6 điểm thì 6 điểm ấy gần như không có giá.
 */
function potentialFactor(overall: number, potential: number, age: number): number {
  const headroom = Math.max(0, potential - overall);
  if (headroom === 0) return 1;
  const runway = Math.max(0, Math.min(1, (PEAK_TO - age) / (PEAK_TO - 17)));
  return 1 + headroom * 0.1 * runway;
}

/** Làm tròn theo bậc độ lớn — một con số tính ra không được trông như số đọc được. */
function roundToScale(v: number): number {
  if (v >= 50e6) return Math.round(v / 5e6) * 5e6;
  if (v >= 10e6) return Math.round(v / 1e6) * 1e6;
  if (v >= 1e6) return Math.round(v / 0.1e6) * 0.1e6;
  if (v >= 100e3) return Math.round(v / 50e3) * 50e3;
  return Math.round(v / 10e3) * 10e3;
}

/**
 * Ước tính giá trị, đơn vị euro.
 *
 * Trả `null` khi thiếu bất kỳ đầu vào nào. Một giá trị tính từ dữ liệu khuyết là
 * số sai đội lốt số đúng — cùng quy tắc `computeOverall` đang dùng.
 */
export function estimateValue(
  overall: number | null,
  potential: number | null,
  age: number | null,
): number | null {
  if (overall === null || potential === null || age === null) return null;
  if (overall < 1 || overall > 99 || age < 14 || age > 50) return null;

  const raw =
    baseFromOverall(overall) * ageFactor(age) * potentialFactor(overall, potential, age);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return roundToScale(raw);
}

/**
 * Rút gọn tiền cho bảng: `12,5 tr` / `850 ng`.
 *
 * Dùng đơn vị tiếng Việt chứ không phải `M`/`K` — trang toàn tiếng Việt, và
 * "£12.5M" trong ảnh mẫu là quy ước của bản tiếng Anh.
 */
export function formatMoney(euro: number | null): string {
  if (euro === null) return "—";
  if (euro >= 1e6) {
    const m = euro / 1e6;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(".", ",")} tr`;
  }
  return `${Math.round(euro / 1e3)} ng`;
}

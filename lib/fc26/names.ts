/**
 * Kho tên FC 26 — tra chỉ số tên đọc từ save ra chữ.
 *
 * ─── VỊ TRÍ TRONG CHUỖI TRA TÊN ─────────────────────────────────────────────
 *
 *   1. tên do career sinh ra, đọc thẳng từ save   (chính xác tuyệt đối)
 *   2. kho tên này, tra theo chỉ số                (bảng gốc của game)
 *   3. `#playerId`
 *
 * Trước đây có bốn bậc, và bậc 2 là một dataset công khai 1,9MB tra theo
 * `playerId`. Kho tên xếp SAU nó vì lúc ấy kho là bản SUY RA — tách tên đầy đủ
 * thành hai mảnh rồi bỏ phiếu, đạt 97,6%.
 *
 * Giờ kho tên lấy thẳng từ hai bảng gốc của game (`playernames` phủ nameid
 * 0–41.189, `dcplayernames` phủ từ 44.000), nên nó KHÔNG còn là bản suy ra và
 * lý do xếp sau không còn. Đo trên bốn save thật, chỉ save + kho tên:
 * 100,00% / 99,99% / 100,00% / 100,00%.
 *
 * Người duy nhất không tra ra mang `firstNameId = 65535`, tức chính game đánh
 * dấu "không có tên".
 */

/**
 * Gộp tên bị lặp thành một.
 *
 * Cầu thủ chỉ có MỘT tên được chính GAME lưu bằng cách đặt `firstnameid` và
 * `lastnameid` bằng nhau. Bằng chứng trong bảng gốc: `#81379` có
 * `first=40399 last=40399`, ghép máy móc ra "Zothanpuia Zothanpuia".
 *
 * Trước đây chú thích ở đây nói đó là đặc điểm của dataset công khai. Sai —
 * dataset công khai chỉ chép lại quy ước của game. Nên đây là chuẩn hoá vĩnh
 * viễn: mọi nguồn lấy từ bảng gốc đều sẽ mang đúng đặc điểm này.
 *
 * Không trường hợp nào in hai lần là đúng: hoặc người đó thật sự một tên, hoặc
 * dữ liệu có vấn đề — cả hai đều nên hiện một lần.
 */
export function collapseDoubledName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] === parts[1]) {
    return [parts[0], ...parts.slice(2)].join(" ");
  }
  return name;
}

interface Packed {
  id: number[];
  text: string[];
}

interface Payload {
  builtAt: string;
  /** Kho DUY NHẤT — cả ba chỉ số tên đều trỏ vào đây. */
  pool: Packed;
  /** Luôn `true`: dựng từ bảng gốc, không phải suy ra. */
  exact?: boolean;
  count?: number;
}

function unpack(p: Packed | undefined): Map<number, string> {
  const m = new Map<number, string>();
  if (!p) return m;
  for (let i = 0; i < p.id.length; i += 1) m.set(p.id[i], p.text[i]);
  return m;
}

export class Fc26Names {
  private readonly pool: Map<number, string>;

  private constructor(data: Payload) {
    this.pool = unpack(data.pool);
  }

  static fromPayload(data: Payload): Fc26Names {
    return new Fc26Names(data);
  }

  /**
   * Ghép tên từ ba chỉ số đọc trong save.
   *
   * `commonNameId` khác 0 nghĩa là game hiển thị tên thường dùng thay cho "tên
   * + họ" — bỏ qua nó thì Cristiano Ronaldo ra "Cristiano Santos".
   *
   * Thiếu một trong hai mảnh thì trả `null` chứ không ghép nửa vời: "Sebastian"
   * trơ trọi trông như tên đầy đủ và người xem không có cách nào biết là thiếu.
   */
  resolve(
    firstNameId: number | null,
    lastNameId: number | null,
    commonNameId: number | null,
  ): string | null {
    if (commonNameId) {
      return this.pool.get(commonNameId) ?? null;
    }
    if (firstNameId === null || lastNameId === null) return null;
    const f = this.pool.get(firstNameId);
    const l = this.pool.get(lastNameId);
    if (!f || !l) return null;
    /*
     * Tên và họ trùng nhau nghĩa là cầu thủ chỉ có MỘT tên.
     *
     * Game lưu mononym bằng cách đặt cả hai ô bằng nhau, nên ghép máy móc sẽ
     * ra "Zothanpuia Zothanpuia", "Zheng Zheng", "Lalchungnunga Lalchungnunga".
     * Không trường hợp nào mà in hai lần là đúng: hoặc người đó thật sự một
     * tên, hoặc dữ liệu có vấn đề — cả hai đều nên hiện một lần.
     */
    return f === l ? f : collapseDoubledName(`${f} ${l}`);
  }
}

let pending: Promise<Fc26Names | null> | null = null;

/**
 * Tải kho tên. Hỏng thì trả `null` chứ không ném: mất nó chỉ làm một nhóm nhỏ
 * mất tên, còn mọi chỉ số vẫn đọc được từ save.
 */
export function loadFc26Names(url = "/fc26/names.json"): Promise<Fc26Names | null> {
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: Payload) => Fc26Names.fromPayload(json))
      .catch(() => null);
  }
  return pending;
}

/**
 * Kho tên FC 26 — tra chỉ số tên đọc từ save ra chữ.
 *
 * ─── VỊ TRÍ TRONG CHUỖI TRA TÊN ─────────────────────────────────────────────
 *
 * Đây là ĐƯỜNG LUI, không phải nguồn chính. Thứ tự ưu tiên:
 *
 *   1. tên do career sinh ra, đọc thẳng từ save   (chính xác tuyệt đối)
 *   2. `players.json` tra theo `playerId`          (nguyên văn từ game)
 *   3. kho tên này, tra theo chỉ số                (97,6% khớp từng chữ)
 *   4. `#playerId`
 *
 * Đặt sau `players.json` là có lý do: bản ghi ở đó là chuỗi nguyên văn game trả
 * về, còn ở đây là chữ ghép lại từ hai mảnh. Với cầu thủ có sẵn thì bước 2 luôn
 * đúng hơn. Kho tên tồn tại để cứu nhóm mà bước 2 không với tới — cầu thủ do
 * career sinh ra, thứ không có trong bất kỳ dataset nào.
 *
 * Với nhóm đó thì nó đạt 100%: đo trên 55 cầu thủ regen của một career thật.
 */

interface Packed {
  id: number[];
  text: string[];
}

interface Payload {
  builtAt: string;
  /** Tỉ lệ khớp từng chữ đo lại trên chính nguồn lúc dựng. */
  accuracy: number;
  first: Packed;
  last: Packed;
  common: Packed;
}

function unpack(p: Packed | undefined): Map<number, string> {
  const m = new Map<number, string>();
  if (!p) return m;
  for (let i = 0; i < p.id.length; i += 1) m.set(p.id[i], p.text[i]);
  return m;
}

export class Fc26Names {
  private readonly first: Map<number, string>;
  private readonly last: Map<number, string>;
  private readonly common: Map<number, string>;
  readonly accuracy: number;

  private constructor(data: Payload) {
    this.first = unpack(data.first);
    this.last = unpack(data.last);
    this.common = unpack(data.common);
    this.accuracy = data.accuracy ?? 0;
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
      return this.common.get(commonNameId) ?? null;
    }
    if (firstNameId === null || lastNameId === null) return null;
    const f = this.first.get(firstNameId);
    const l = this.last.get(lastNameId);
    return f && l ? `${f} ${l}` : null;
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

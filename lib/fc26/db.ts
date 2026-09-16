/**
 * DB tên cầu thủ FC 26 — tra `playerId` ra tên, CLB gốc, giải, quốc tịch.
 *
 * Tải một lần rồi giữ lại: file khoảng 1,5MB nên tải lại mỗi lần thả save là phí
 * băng thông của người dùng mà chẳng được gì.
 *
 * DB này **không cấp chỉ số**. Chỉ số luôn đọc hoặc tính từ file save — xem
 * `public/fc26/README.md` để biết vì sao ranh giới đó quan trọng.
 */

export interface Fc26Entry {
  name: string;
  fullName: string;
  club: string;
  league: string;
  nation: string;
}

interface Payload {
  source: string;
  builtAt: string;
  count: number;
  ids: number[];
  names: string[];
  fullNames: string[];
  clubs: string[];
  leagues: string[];
  nations: string[];
  /** Mã quốc gia → tên. Dùng được cho cả cầu thủ không có trong DB. */
  nationNames: Record<string, string>;
}

export class Fc26Database {
  private readonly index: Map<number, number>;
  private readonly data: Payload;

  private constructor(data: Payload) {
    this.data = data;
    this.index = new Map();
    for (let i = 0; i < data.ids.length; i += 1) this.index.set(data.ids[i], i);
  }

  static fromPayload(data: Payload): Fc26Database {
    return new Fc26Database(data);
  }

  get size(): number {
    return this.data.ids.length;
  }

  get source(): string {
    return this.data.source;
  }

  /**
   * Tên quốc gia theo mã đọc từ save.
   *
   * Tách khỏi `get()` vì áp dụng được cho **mọi** cầu thủ, kể cả người không có
   * trong DB — với nhóm đó đây là mẩu thông tin nhận dạng duy nhất còn lại.
   */
  nation(nationalityId: number | null): string | null {
    if (nationalityId === null) return null;
    return this.data.nationNames?.[String(nationalityId)] ?? null;
  }

  get(playerId: number): Fc26Entry | null {
    const i = this.index.get(playerId);
    if (i === undefined) return null;
    return {
      name: this.data.names[i],
      fullName: this.data.fullNames[i] || this.data.names[i],
      club: this.data.clubs[i],
      league: this.data.leagues[i],
      nation: this.data.nations[i],
    };
  }
}

let pending: Promise<Fc26Database | null> | null = null;

/**
 * Tải DB. Hỏng thì trả `null` chứ không ném: thiếu tên làm trang nghèo đi nhưng
 * mọi chỉ số vẫn đọc được từ save, nên không có lý do gì để chặn cả trang.
 */
export function loadFc26Database(url = "/fc26/players.json"): Promise<Fc26Database | null> {
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: Payload) => Fc26Database.fromPayload(json))
      .catch(() => null);
  }
  return pending;
}

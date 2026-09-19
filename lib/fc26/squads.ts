/**
 * Số áo và mã đội của roster gốc FC 26.
 *
 * ─── VÌ SAO ĐƯỢC NƯỚNG SẴN, KHÁC VỚI ĐỘI HÌNH XUẤT PHÁT ────────────────────
 *
 * Số áo và "cầu thủ này thuộc CLB nào đầu mùa" là hằng số theo phiên bản game.
 * Đội hình xuất phát thì không — nó đổi mỗi lần người chơi xếp lại đội, và
 * nướng nó vào asset chính là lỗi đã phải gỡ bỏ một lần.
 *
 * Ranh giới đó không tự giữ được, nên `build-fc26-squads.ts` cố ý KHÔNG ghi cột
 * `position` ra file. Không có dữ liệu thì không ai lỡ dùng nhầm.
 *
 * ─── GIỚI HẠN PHẢI NÓI RA ───────────────────────────────────────────────────
 *
 * Cầu thủ do career sinh ra không bao giờ có trong đây — họ chưa tồn tại lúc
 * game xuất xưởng. Đo trên save thật: 25/28 cầu thủ có số áo với một CLB có
 * sẵn, và ba người thiếu đều là cầu thủ career tạo ra. Chỗ nào không có số áo
 * thì hiện chữ cái đầu tên, không bịa số.
 */

interface Payload {
  builtAt: string;
  teamCount: number;
  /** Mã đội → tên. */
  names: Record<string, string>;
  /** Mã đội → mảng phẳng [playerId, số áo, …]. */
  squads: Record<string, number[]>;
}

export interface ClubMatch {
  teamId: number;
  name: string | null;
  /** playerId → số áo, chỉ trong phạm vi CLB này. */
  jerseyOf: Map<number, number>;
  /** Bao nhiêu cầu thủ của đội đọc từ save thuộc về CLB này. */
  matched: number;
  total: number;
}

export class Fc26Squads {
  /** playerId → danh sách mã đội mà người đó thuộc về (CLB và đội tuyển). */
  private readonly teamsOf: Map<number, number[]>;
  private readonly data: Payload;

  private constructor(data: Payload) {
    this.data = data;
    this.teamsOf = new Map();
    for (const [teamStr, flat] of Object.entries(data.squads ?? {})) {
      const team = Number(teamStr);
      for (let i = 0; i < flat.length; i += 2) {
        const pid = flat[i];
        const list = this.teamsOf.get(pid);
        if (list) list.push(team);
        else this.teamsOf.set(pid, [team]);
      }
    }
  }

  static fromPayload(data: Payload): Fc26Squads {
    return new Fc26Squads(data);
  }

  /**
   * Đội hình đọc từ save thuộc CLB nào?
   *
   * Bỏ phiếu theo đa số thay vì tin một cầu thủ. Một đội bóng trong career luôn
   * có người mới mua từ nơi khác — họ vẫn mang mã CLB CŨ trong dữ liệu gốc, nên
   * tra một người bất kỳ sẽ ra sai đội khá thường xuyên. Đo trên save thật:
   * 25/28 phiếu cho đúng CLB, ba phiếu lạc là cầu thủ mới chuyển đến.
   *
   * ─── NGƯỠNG 0,6 LÀ SỐ ĐO, KHÔNG PHẢI SỐ CHỌN ─────────────────────────────
   *
   * Ngưỡng đầu để 0,4 và nó khớp NHẦM: một CLB do người chơi tự tạo ra khớp
   * "AFC Bournemouth" với 9/21 phiếu (0,43), vì chín cầu thủ trong đội vốn từ
   * Bournemouth. Hậu quả là trang hiện số áo của một CLB khác — sai, mà trông
   * hoàn toàn bình thường.
   *
   * Đo được trên save thật: CLB có sẵn 25/28 = 0,89; CLB tự tạo 9/21 = 0,43.
   * Ngưỡng 0,6 tách sạch hai trường hợp.
   *
   * Một CLB có sẵn nhưng đã thay quá 40% đội hình sẽ rơi xuống dưới ngưỡng và
   * mất số áo. Đó là hướng hỏng ĐÚNG: mất một tính năng nhỏ còn hơn khẳng định
   * sai tên CLB.
   *
   * Trả `null` khi không đội nào đạt ngưỡng, và đoán bừa thì tệ hơn im lặng.
   */
  matchClub(squadIds: number[], minShare = 0.6): ClubMatch | null {
    if (squadIds.length === 0) return null;

    const votes = new Map<number, number>();
    for (const id of squadIds) {
      for (const team of this.teamsOf.get(id) ?? []) {
        votes.set(team, (votes.get(team) ?? 0) + 1);
      }
    }
    let bestTeam = -1;
    let bestN = 0;
    for (const [team, n] of votes) {
      if (n > bestN) {
        bestTeam = team;
        bestN = n;
      }
    }
    if (bestTeam < 0 || bestN < squadIds.length * minShare) return null;

    const flat = this.data.squads[String(bestTeam)] ?? [];
    const jerseyOf = new Map<number, number>();
    for (let i = 0; i < flat.length; i += 2) jerseyOf.set(flat[i], flat[i + 1]);

    return {
      teamId: bestTeam,
      name: this.data.names[String(bestTeam)] ?? null,
      jerseyOf,
      matched: bestN,
      total: squadIds.length,
    };
  }
}

let pending: Promise<Fc26Squads | null> | null = null;

/**
 * Tải bảng số áo. Hỏng thì trả `null` chứ không ném: mất số áo làm trang nghèo
 * đi một chút, không làm hỏng thứ gì khác.
 */
export function loadFc26Squads(url = "/fc26/squads.json"): Promise<Fc26Squads | null> {
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: Payload) => Fc26Squads.fromPayload(json))
      .catch(() => null);
  }
  return pending;
}

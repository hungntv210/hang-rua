/**
 * Thế giới FC 26 như lúc game xuất xưởng — CLB, giải, số áo, quốc gia, tập id.
 *
 * ─── VÌ SAO ĐƯỢC NƯỚNG SẴN, KHÁC VỚI ĐỘI HÌNH XUẤT PHÁT ────────────────────
 *
 * Mọi thứ ở đây là hằng số theo phiên bản game: số áo, "cầu thủ này thuộc CLB
 * nào đầu mùa", tên giải, tên quốc gia. Đội hình xuất phát thì không — nó đổi
 * mỗi lần người chơi xếp lại đội, và nướng nó vào asset chính là lỗi đã phải
 * gỡ bỏ một lần.
 *
 * Ranh giới đó không tự giữ được, nên bản dựng cố ý KHÔNG ghi cột `position`
 * ra file. Không có dữ liệu thì không ai lỡ dùng nhầm.
 *
 * ─── GIỚI HẠN PHẢI NÓI RA ───────────────────────────────────────────────────
 *
 * Cầu thủ do career sinh ra không bao giờ có trong đây — họ chưa tồn tại lúc
 * game xuất xưởng. Chỗ nào không có số áo thì hiện chữ cái đầu tên, không bịa.
 */

export interface WorldPayload {
  builtAt: string;
  teamCount: number;
  names: Record<string, string>;
  squads: Record<string, number[]>;
  /** CHỈ giải trong nước, nên có mặt ở đây nghĩa là CLB chứ không phải đội tuyển. */
  leagueOfTeam: Record<string, number>;
  leagueNames: Record<string, string>;
  nationNames: Record<string, string>;
  /** Mã hoá delta tăng dần. */
  shippedIds: number[];
  /** Mã hoá delta tăng dần. */
  utIds: number[];
}

export interface ClubMatch {
  teamId: number;
  name: string | null;
  league: string | null;
  /** playerId → số áo, chỉ trong phạm vi CLB này. */
  jerseyOf: Map<number, number>;
  /** Bao nhiêu cầu thủ của đội đọc từ save thuộc về CLB này. */
  matched: number;
  total: number;
}

function undelta(d: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const x of d) {
    acc += x;
    out.push(acc);
  }
  return out;
}

export class Fc26World {
  /** playerId → danh sách mã đội mà người đó thuộc về (CLB và đội tuyển). */
  private readonly teamsOf: Map<number, number[]>;
  private readonly shipped: Set<number>;
  private readonly ut: Set<number>;
  private readonly data: WorldPayload;

  private constructor(data: WorldPayload) {
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
    this.shipped = new Set(undelta(data.shippedIds ?? []));
    this.ut = new Set(undelta(data.utIds ?? []));
  }

  static fromPayload(data: WorldPayload): Fc26World {
    return new Fc26World(data);
  }

  /**
   * Mọi playerId có trong roster xuất xưởng của game.
   *
   * Dùng để nhận ra cầu thủ do career SINH RA: ai không có ở đây thì không tồn
   * tại lúc game phát hành. Đó là dấu hiệu duy nhất không phụ thuộc career cụ
   * thể nào — dải ID thì mỗi career một khác.
   */
  shippedIds(): Set<number> {
    return this.shipped;
  }

  /**
   * Cầu thủ này là nội dung Ultimate Team, không thuộc danh sách career.
   *
   * Danh sách này là DI SẢN từ dataset công khai và không tái tạo được từ bảng
   * gốc: bảng `players` của game là roster Career thuần, không chứa Icon nào.
   * Nhưng nó vẫn đúng — đo trên hai save, nó lọc 112 và 67 người và không ai
   * trong số đó có trong bảng gốc. Bỏ đi thì cả trăm bản ghi lạ hiện lên đầu
   * bảng, vì bảng sắp theo chỉ số.
   */
  isUltimateTeam(playerId: number): boolean {
    return this.ut.has(playerId);
  }

  /** Tên quốc gia theo mã đọc từ save. Áp dụng cho MỌI cầu thủ, kể cả người không tra được tên. */
  nation(nationalityId: number | null): string | null {
    if (nationalityId === null) return null;
    return this.data.nationNames?.[String(nationalityId)] ?? null;
  }

  /**
   * CLB gốc của một cầu thủ — CLB thật, không phải đội tuyển quốc gia.
   *
   * `teamplayerlinks` nối cầu thủ với cả hai. Lọc theo `leagueOfTeam`, vốn chỉ
   * chứa giải trong nước, nên đội tuyển tự rụng khỏi kết quả.
   */
  clubOf(playerId: number): { name: string; league: string | null } | null {
    for (const team of this.teamsOf.get(playerId) ?? []) {
      const league = this.data.leagueOfTeam?.[String(team)];
      if (league === undefined) continue;
      const name = this.data.names?.[String(team)];
      if (!name) continue;
      return { name, league: this.data.leagueNames?.[String(league)] ?? null };
    }
    return null;
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
   * Trả `null` khi không đội nào đạt ngưỡng, vì đoán bừa tệ hơn im lặng.
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

    const leagueId = this.data.leagueOfTeam?.[String(bestTeam)];
    return {
      teamId: bestTeam,
      name: this.data.names[String(bestTeam)] ?? null,
      league:
        leagueId === undefined ? null : (this.data.leagueNames?.[String(leagueId)] ?? null),
      jerseyOf,
      matched: bestN,
      total: squadIds.length,
    };
  }
}

let pending: Promise<Fc26World | null> | null = null;

/**
 * Tải asset. Hỏng thì trả `null` chứ không ném: mất nó làm trang nghèo đi một
 * chút, không làm hỏng việc đọc chỉ số từ save.
 */
export function loadFc26World(url = "/fc26/world.json"): Promise<Fc26World | null> {
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: WorldPayload) => Fc26World.fromPayload(json))
      .catch(() => null);
  }
  return pending;
}

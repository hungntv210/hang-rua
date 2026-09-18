/**
 * Đối chiếu đội hình đọc từ save với bảng sơ đồ đã dựng sẵn.
 *
 * ─── CỔNG KHỚP LÀ THỨ GIỮ CHO KHÔNG BAO GIỜ HIỆN SAI ────────────────────────
 *
 * `formations.json` chứa đội hình mặc định của 815 đội, trong đó có cả CLB do
 * career của người dựng dataset tạo ra. Nếu vẽ bừa theo mã đội thì save của
 * người khác sẽ thấy đội hình của người dựng — đúng cái bẫy mà cả dự án này
 * được thiết kế để tránh.
 *
 * Nên sơ đồ chỉ được vẽ khi **đội hình đọc từ save chứa đủ cầu thủ** của một
 * team sheet cụ thể. Career của người khác không thể trùng tập cầu thủ: riêng ID
 * học viện 460xxx đã do từng career tự sinh.
 *
 * Ngưỡng đặt ở 9/11 chứ không phải 11/11 vì chuyển nhượng làm lệch một hai suất
 * mà vẫn đúng đội. Dưới ngưỡng thì trả `null` — gọi ở tầng trên sẽ lùi về cách
 * xếp theo vị trí sở trường, có nhãn nói rõ.
 */

/** Số cầu thủ của đội hình xuất phát phải khớp tối thiểu. */
const MIN_MATCH = 9;

interface FormationRow {
  id: number;
  name: string;
  /** Mã vị trí FIFA (0-27) cho 11 ô. */
  pos: number[];
  /** Toạ độ chuẩn hoá: x 0 (trái) → 1 (phải), y 0 (khung nhà) → 1 (khung đối thủ). */
  off: Array<[number, number]>;
}

/** `[teamId, formationId, xi, bench, jersey]` — mảng thay vì object để nhẹ file. */
type SheetRow = [number, number, number[], number[], number[]];

interface Payload {
  builtAt: string;
  formations: FormationRow[];
  sheets: SheetRow[];
}

export interface LineupSlot {
  /** Toạ độ chuẩn hoá trên sân. */
  x: number;
  y: number;
  positionCode: number;
  playerId: number;
  /** 0 nghĩa là không có số áo trong dữ liệu. */
  jersey: number;
}

export interface Lineup {
  formationName: string;
  slots: LineupSlot[];
  /** Cầu thủ trong đội hình nhưng không đá chính. */
  benchIds: number[];
  /**
   * TOÀN BỘ cầu thủ của đội, đọc từ save.
   *
   * Khác `benchIds`: chỗ kia lấy từ bảng dự bị của team sheet dựng sẵn, nên chỉ
   * có 7-12 người. Bảng cầu thủ theo nhóm vị trí cần cả đội, kể cả người không
   * nằm trong danh sách đăng ký trận nào.
   */
  squadIds: number[];
  /** Số áo tra theo playerId, cho cả đá chính lẫn dự bị. */
  jerseyOf: Map<number, number>;
  /** Bao nhiêu trong 11 suất khớp — hiển thị cho người xem tự đánh giá. */
  matched: number;
}

export class Fc26Formations {
  private readonly formations: Map<number, FormationRow>;
  private readonly sheets: SheetRow[];

  private constructor(data: Payload) {
    this.formations = new Map(data.formations.map((f) => [f.id, f]));
    this.sheets = data.sheets;
  }

  static fromPayload(data: Payload): Fc26Formations {
    return new Fc26Formations(data);
  }

  /**
   * Tìm đội hình khớp nhất với danh sách cầu thủ đọc từ save.
   *
   * Trả `null` khi không có team sheet nào đạt ngưỡng — nghĩa là save này thuộc
   * một career khác, và vẽ sơ đồ nào cũng là bịa.
   */
  match(squadIds: number[]): Lineup | null {
    const squad = new Set(squadIds);
    let best: { sheet: SheetRow; matched: number } | null = null;

    for (const sheet of this.sheets) {
      const xi = sheet[2];
      let matched = 0;
      for (const pid of xi) if (squad.has(pid)) matched += 1;
      if (matched >= MIN_MATCH && (!best || matched > best.matched)) {
        best = { sheet, matched };
      }
      if (matched === xi.length) break;  // không thể hơn được nữa
    }
    if (!best) return null;

    const [, formationId, xi, bench, jersey] = best.sheet;
    const formation = this.formations.get(formationId);
    if (!formation) return null;

    const jerseyOf = new Map<number, number>();
    [...xi, ...bench].forEach((pid, i) => {
      const j = jersey[i] ?? 0;
      if (j > 0) jerseyOf.set(pid, j);
    });

    const slots: LineupSlot[] = xi.map((playerId, i) => ({
      x: formation.off[i]?.[0] ?? 0.5,
      y: formation.off[i]?.[1] ?? 0.5,
      positionCode: formation.pos[i] ?? 0,
      playerId,
      jersey: jerseyOf.get(playerId) ?? 0,
    }));

    return {
      formationName: formation.name,
      slots,
      // Chỉ giữ người thực sự có trong save: team sheet có thể liệt kê cầu thủ
      // đã rời đội, và hiện họ ra thì sai.
      benchIds: bench.filter((pid) => squad.has(pid)),
      squadIds,
      jerseyOf,
      matched: best.matched,
    };
  }
}

let pending: Promise<Fc26Formations | null> | null = null;

/**
 * Tải bảng sơ đồ. Hỏng thì trả `null` chứ không ném: mất sơ đồ làm trang nghèo
 * đi nhưng bảng cầu thủ vẫn đọc được đầy đủ từ save.
 */
export function loadFc26Formations(
  url = "/fc26/formations.json",
): Promise<Fc26Formations | null> {
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: Payload) => Fc26Formations.fromPayload(json))
      .catch(() => null);
  }
  return pending;
}

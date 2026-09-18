/**
 * Dựng đội hình từ CHÍNH file save của người dùng.
 *
 * ─── VÌ SAO FILE NÀY TỒN TẠI ────────────────────────────────────────────────
 *
 * Bản trước lấy đội hình xuất phát từ `formations.json`, một ảnh chụp nướng sẵn
 * lúc build từ một bản export Live Editor. File save chỉ dùng để CHỌN xem phát
 * lại dòng nào trong ảnh chụp đó. Hệ quả đo được trên ba save của cùng một
 * người:
 *
 *     save 30-07   khớp 0/11   → trang không vẽ được gì
 *     save 12-08   khớp 11/11  → phát lại ảnh chụp 17-09
 *     save 17-09   khớp 11/11  → phát lại ảnh chụp 17-09
 *
 * Tức là: xếp lại đội hình trong game rồi tải save mới lên, trang vẫn hiện y
 * nguyên trạng thái cũ; còn save trước ngày chụp thì không hiện gì. Điều đó phá
 * đúng nguyên tắc của dự án — mọi thứ hiển thị phải đọc từ save người dùng tải
 * lên.
 *
 * ─── THỨ ĐỌC ĐƯỢC VÀ THỨ KHÔNG ──────────────────────────────────────────────
 *
 * ĐỌC ĐƯỢC từ save: danh sách cầu thủ của đội, vị trí sở trường của từng người,
 * và mọi chỉ số. Đã kiểm: khối đội hình trong save chính là 20 suất của team
 * sheet cộng 4 dự bị ngoài danh sách.
 *
 * KHÔNG đọc được: ai đá ô nào. Đã thử và loại năm cách lưu — dãy playerId u32
 * liên tiếp, chỉ số vào mảng đội hình (u8/u16/u32), hoán vị ngược, mảng mã vị
 * trí song song, và vùng byte ngay sau khối. Số áo cũng không có: nó thuộc về
 * cặp (cầu thủ, đội) chứ không thuộc về cầu thủ, và dò trong bản ghi 144 byte
 * với 24 mẫu ở cổng 100% không ra trường nào.
 *
 * ─── HỆ QUẢ PHẢI NÓI RA, KHÔNG ĐƯỢC GIẤU ────────────────────────────────────
 *
 * Nên đội hình ở đây là ĐỘI HÌNH GỢI Ý, suy từ vị trí sở trường và chỉ số, chứ
 * không phải đội hình người chơi đã xếp. Nó cùng hạng với `overall` và
 * `valueEstimate`: số tính, không phải số đọc. Mọi chỗ hiển thị phải gọi đúng
 * tên nó — một đội hình gợi ý trông y hệt một đội hình thật là thứ tệ hơn cả
 * không hiển thị gì.
 */

import { FIT_WEIGHT, fitOf, groupOf, type Fit } from "./positions";

export interface FormationShape {
  id: number;
  name: string;
  /** Mã vị trí FIFA (0-27) cho 11 ô. */
  pos: number[];
  /** Toạ độ chuẩn hoá: x 0 (trái) → 1 (phải), y 0 (khung nhà) → 1 (khung đối thủ). */
  off: Array<[number, number]>;
}

/** Tối thiểu cho một đội bóng thật. Xem `pickSquad`. */
const MIN_SQUAD_SIZE = 16;
const MIN_KEEPERS = 2;

/** Cầu thủ mà bộ dựng cần biết — vừa đủ, để không buộc phải kéo cả `SavePlayer`. */
export interface LineupPlayer {
  playerId: number;
  position: string;
  overall: number | null;
}

export interface LineupSlot {
  x: number;
  y: number;
  positionCode: number;
  playerId: number;
  /** Người này hợp ô tới mức nào — để giao diện nói thật khi ai đó đá trái vị trí. */
  fit: Fit;
}

export interface Lineup {
  formationName: string;
  slots: LineupSlot[];
  /** Cả đội trừ 11 người được xếp đá chính, xếp theo chỉ số giảm dần. */
  benchIds: number[];
  /** Toàn bộ cầu thủ của đội, đọc từ save. */
  squadIds: number[];
  /** Bao nhiêu trong 11 ô có người đúng sở trường — để người xem tự đánh giá. */
  exactCount: number;
}

/**
 * Chọn khối nào trong save là đội hình của người chơi.
 *
 * `findSquads` trả về mọi khối `[count][playerId…]` tự xác thực trong file, và
 * không phải khối nào cũng là một đội bóng. Đo trên ba save thật:
 *
 *     khối đội hình   n = 21-24, 2 thủ môn, đủ bốn tuyến
 *     khối còn lại    n = 11,    1 thủ môn, cầu thủ của BỐN câu lạc bộ khác nhau
 *
 * Khối 11 người kia là danh sách theo dõi chuyển nhượng, không phải đội hình.
 * Hai tiêu chí dưới đây mỗi cái đều tự loại được nó, nên dùng cả hai là cố ý:
 * một tiêu chí hỏng thì cái còn lại vẫn chặn.
 */
export function pickSquad(candidates: number[][], players: Map<number, LineupPlayer>): number[] | null {
  let best: number[] | null = null;
  for (const ids of candidates) {
    const known = ids.filter((id) => players.has(id));
    if (known.length < MIN_SQUAD_SIZE) continue;
    const keepers = known.filter((id) => players.get(id)!.position === "GK").length;
    if (keepers < MIN_KEEPERS) continue;
    if (!best || known.length > best.length) best = known;
  }
  return best;
}

/** Chỉ số dùng để xếp; thiếu thì coi như rất thấp chứ không loại hẳn khỏi đội. */
const rating = (p: LineupPlayer): number => p.overall ?? 1;

/**
 * Xếp người vào 11 ô của một sơ đồ, rồi trả về điểm của cách xếp đó.
 *
 * Tham lam theo ĐỘ KHAN HIẾM chứ không theo thứ tự ô: xét ô có ít người hợp
 * nhất trước. Xếp theo thứ tự ô sẽ tiêu hết người giỏi vào các ô đầu và để ô
 * thủ môn cho một tiền đạo — lỗi này thấy ngay trên sơ đồ nên không đáng đánh
 * đổi lấy sự đơn giản.
 *
 * Không dùng thuật toán ghép cặp tối ưu (Hungarian): 11 ô × ~24 người thì tham
 * lam theo khan hiếm cho kết quả giống hệt trong mọi đội hình đã thử, mà đọc
 * hiểu được.
 */
function assign(
  shape: FormationShape,
  squad: LineupPlayer[],
  positionName: (code: number) => string,
): { slots: LineupSlot[]; score: number } | null {
  if (squad.length < 11) return null;

  const taken = new Set<number>();
  const chosen = new Map<number, { player: LineupPlayer; fit: Fit }>();

  const order = shape.pos
    .map((code, i) => {
      const slotPos = positionName(code);
      const eligible = squad.filter((p) => fitOf(p.position, slotPos) !== "out").length;
      return { i, slotPos, eligible };
    })
    .sort((a, b) => a.eligible - b.eligible);

  for (const { i, slotPos } of order) {
    let bestPlayer: LineupPlayer | null = null;
    let bestFit: Fit = "out";
    let bestScore = -1;
    for (const p of squad) {
      if (taken.has(p.playerId)) continue;
      const fit = fitOf(p.position, slotPos);
      const score = rating(p) * FIT_WEIGHT[fit];
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = p;
        bestFit = fit;
      }
    }
    if (!bestPlayer) return null;
    taken.add(bestPlayer.playerId);
    chosen.set(i, { player: bestPlayer, fit: bestFit });
  }

  let score = 0;
  const slots: LineupSlot[] = shape.pos.map((code, i) => {
    const pick = chosen.get(i)!;
    score += rating(pick.player) * FIT_WEIGHT[pick.fit];
    return {
      x: shape.off[i]?.[0] ?? 0.5,
      y: shape.off[i]?.[1] ?? 0.5,
      positionCode: code,
      playerId: pick.player.playerId,
      fit: pick.fit,
    };
  });
  return { slots, score };
}

/**
 * Dựng đội hình gợi ý cho một đội.
 *
 * Thử mọi sơ đồ và giữ sơ đồ cho điểm cao nhất — tức là sơ đồ mà đội này xếp
 * được đội hình mạnh nhất với ít người đá trái vị trí nhất. Đó là lý do sơ đồ
 * đổi theo từng save: đội khác nhau thì sơ đồ hợp nhất cũng khác.
 */
export function buildLineup(
  squadIds: number[],
  players: Map<number, LineupPlayer>,
  shapes: FormationShape[],
  positionName: (code: number) => string,
): Lineup | null {
  const squad = squadIds
    .map((id) => players.get(id))
    .filter((p): p is LineupPlayer => !!p);
  if (squad.length < 11 || shapes.length === 0) return null;

  let best: { shape: FormationShape; slots: LineupSlot[]; score: number } | null = null;
  for (const shape of shapes) {
    if (shape.pos.length !== 11) continue;
    const got = assign(shape, squad, positionName);
    if (!got) continue;
    if (!best || got.score > best.score) best = { shape, ...got };
  }
  if (!best) return null;

  const starters = new Set(best.slots.map((s) => s.playerId));
  const benchIds = squad
    .filter((p) => !starters.has(p.playerId))
    .sort((a, b) => {
      // Thủ môn dự bị luôn đứng đầu băng ghế — đó là quy ước của mọi đội bóng,
      // và xếp thuần theo chỉ số sẽ đẩy anh ta xuống tận cuối.
      const ga = a.position === "GK" ? 1 : 0;
      const gb = b.position === "GK" ? 1 : 0;
      if (ga !== gb) return gb - ga;
      return rating(b) - rating(a);
    })
    .map((p) => p.playerId);

  return {
    formationName: best.shape.name,
    slots: best.slots,
    benchIds,
    squadIds: squad.map((p) => p.playerId),
    exactCount: best.slots.filter((s) => s.fit === "exact").length,
  };
}

/** Nhãn ngắn cho mức hợp, dùng ở chú giải trên sân. */
export const FIT_LABEL: Record<Fit, string> = {
  exact: "đúng sở trường",
  family: "hợp vị trí",
  group: "cùng tuyến",
  out: "trái vị trí",
};

export { groupOf };

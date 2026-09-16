/**
 * Vị trí bit của từng trường trong bản ghi cầu thủ 144 byte.
 *
 * Đây là DỮ LIỆU, không phải logic. Khi EA đổi layout ở bản patch sau, sửa file
 * này là đủ — không phải viết lại parser.
 *
 * Cách tìm ra: ghép bản ghi với dataset FC 26 công khai qua `playerId`, rồi với
 * mỗi vị trí bit và độ rộng, đếm tỉ lệ **trùng khít tuyệt đối** với cột tương
 * ứng. Chi tiết và số liệu kiểm chứng nằm trong
 * `docs/superpowers/specs/2026-08-05-career-player-list-design.md`.
 *
 * HAI CÁI BẪY đã trả giá để biết, đừng lặp lại:
 *
 * 1. **Không dùng tương quan để chốt trường.** Đọc sớm một bit cho
 *    `v = rác + 2×thật`, vẫn tương quan ~0,96 với giá trị thật. `potential` và
 *    `dob` đều từng bị chốt sai đúng một bit theo cách này. Chỉ trùng khít tuyệt
 *    đối mới bắt được.
 * 2. **Tương quan cao không có nghĩa là đúng trường.** bit 551 tương quan 0,87
 *    với overall nên bị nhận nhầm là overall; hoá ra nó là `reactions` — chỉ số
 *    này gần như tỉ lệ thuận với overall trong FC.
 */

/** Độ dài một bản ghi cầu thủ. Xác định bằng tự tương quan bit: chu kỳ 1152 bit. */
export const PLAYER_RECORD_BYTES = 144;

export interface BitField {
  /** Vị trí bit trong bản ghi, LSB-first. */
  bit: number;
  width: number;
  /** Cộng vào giá trị thô. Phần lớn trường lưu 0-based nên cần +1. */
  add: number;
}

const f = (bit: number, width: number, add = 0): BitField => ({ bit, width, add });

/** Trường định danh và tiểu sử. */
export const CORE_FIELDS = {
  /** Khoá cầu thủ của EA. Duy nhất trong bảng — dùng làm neo khi định vị bảng. */
  playerId: f(1126, 20),
  /** Số ngày kể từ 1941-08-25. Xem `DOB_EPOCH_DAYS`. */
  birthDate: f(718, 15, -10356),
  potential: f(520, 7, 1),
  heightCm: f(675, 7, 130),
  weightKg: f(812, 7, 30),
  /** Mã vị trí chuẩn của FIFA. Xem `POSITION_NAMES`. */
  position: f(738, 5),
  nationalityId: f(1089, 8),
  internationalReputation: f(906, 3, 1),
  skillMoves: f(929, 3, 1),
  weakFoot: f(1104, 3, 1),
} as const;

/**
 * Số ngày từ epoch Unix tới mốc gốc của trường ngày sinh.
 * `birthDate.add = -10356` đã quy đổi sẵn về ngày Unix, hằng số này chỉ để tài liệu.
 */
export const DOB_EPOCH = "1941-08-25";

/**
 * 31 chỉ số chi tiết. Tất cả rộng 7 bit và lưu 0-based (cộng 1).
 *
 * Thiếu ba chỉ số chưa dò ra: `volleys`, `defAwareness`, `gkPositioning`.
 * Chúng không chặn việc tính overall — mô hình vẫn đạt lệch ≤1 ở 99,7% — nhưng
 * là lý do nhóm thủ môn kém chính xác nhất.
 */
export const ATTRIBUTE_FIELDS = {
  crossing: f(513, 7, 1),
  finishing: f(601, 7, 1),
  headingAccuracy: f(984, 7, 1),
  shortPassing: f(915, 7, 1),
  dribbling: f(608, 7, 1),
  curve: f(360, 7, 1),
  fkAccuracy: f(922, 7, 1),
  longPassing: f(445, 7, 1),
  ballControl: f(758, 7, 1),
  acceleration: f(970, 7, 1),
  sprintSpeed: f(667, 7, 1),
  agility: f(368, 7, 1),
  reactions: f(551, 7, 1),
  balance: f(865, 7, 1),
  shotPower: f(772, 7, 1),
  jumping: f(1107, 7, 1),
  stamina: f(1119, 7, 1),
  strength: f(701, 7, 1),
  longShots: f(470, 7, 1),
  aggression: f(963, 7, 1),
  interceptions: f(501, 7, 1),
  positioning: f(397, 7, 1),
  vision: f(583, 7, 1),
  penalties: f(452, 7, 1),
  composure: f(558, 7, 1),
  standingTackle: f(432, 7, 1),
  slidingTackle: f(615, 7, 1),
  gkDiving: f(477, 7, 1),
  gkHandling: f(1019, 7, 1),
  gkKicking: f(892, 7, 1),
  gkReflexes: f(527, 7, 1),
} as const;

export type AttributeName = keyof typeof ATTRIBUTE_FIELDS;

/** Thứ tự này PHẢI khớp thứ tự biến của mô hình overall. Xem `ovr-model.ts`. */
export const ATTRIBUTE_ORDER = Object.keys(ATTRIBUTE_FIELDS) as AttributeName[];

/**
 * Nhãn tiếng Việt và nhóm hiển thị.
 *
 * Để cạnh `ATTRIBUTE_ORDER` thay vì trong component: hai danh sách này phải khớp
 * nhau, và tách ra hai file là cách chắc chắn để chúng lệch nhau về sau.
 */
export const ATTRIBUTE_GROUPS: Array<{ group: string; items: Array<[AttributeName, string]> }> = [
  {
    group: "Tấn công",
    items: [
      ["finishing", "Dứt điểm"],
      ["longShots", "Sút xa"],
      ["shotPower", "Lực sút"],
      ["positioning", "Chọn vị trí"],
      ["headingAccuracy", "Đánh đầu"],
      ["penalties", "Phạt đền"],
    ],
  },
  {
    group: "Chuyền bóng",
    items: [
      ["shortPassing", "Chuyền ngắn"],
      ["longPassing", "Chuyền dài"],
      ["vision", "Nhãn quan"],
      ["crossing", "Tạt bóng"],
      ["curve", "Xoáy"],
      ["fkAccuracy", "Đá phạt"],
    ],
  },
  {
    group: "Rê dắt",
    items: [
      ["dribbling", "Rê bóng"],
      ["ballControl", "Khống chế"],
      ["agility", "Nhanh nhẹn"],
      ["balance", "Thăng bằng"],
      ["reactions", "Phản xạ tình huống"],
      ["composure", "Điềm tĩnh"],
    ],
  },
  {
    group: "Phòng ngự",
    items: [
      ["standingTackle", "Tắc bóng đứng"],
      ["slidingTackle", "Xoạc bóng"],
      ["interceptions", "Cắt bóng"],
      ["aggression", "Quyết liệt"],
    ],
  },
  {
    group: "Thể lực & tốc độ",
    items: [
      ["acceleration", "Tăng tốc"],
      ["sprintSpeed", "Tốc độ tối đa"],
      ["stamina", "Thể lực"],
      ["strength", "Sức mạnh"],
      ["jumping", "Bật nhảy"],
    ],
  },
  {
    group: "Thủ môn",
    items: [
      ["gkDiving", "Bay người"],
      ["gkHandling", "Bắt dính"],
      ["gkKicking", "Phát bóng"],
      ["gkReflexes", "Phản xạ"],
    ],
  },
];

/**
 * Bảng mã vị trí chuẩn của FIFA/FC. Suy ra từ dữ liệu chứ không tra cứu: mã đọc
 * được từ save khớp vị trí trong dataset với độ thuần khiết 91,8%, và dãy mã ra
 * đúng bảng quen thuộc — đó là xác nhận, không phải trùng hợp.
 */
export const POSITION_NAMES: Record<number, string> = {
  0: "GK", 1: "SW", 2: "RWB", 3: "RB", 4: "RCB", 5: "CB", 6: "LCB", 7: "LB",
  8: "LWB", 9: "RDM", 10: "CDM", 11: "LDM", 12: "RM", 13: "RCM", 14: "CM",
  15: "LCM", 16: "LM", 17: "RAM", 18: "CAM", 19: "LAM", 20: "RF", 21: "CF",
  22: "LF", 23: "RW", 24: "RS", 25: "ST", 26: "LS", 27: "LW",
};

export function positionName(code: number | null): string {
  if (code === null) return "?";
  return POSITION_NAMES[code] ?? `#${code}`;
}

/**
 * Bảng tên cầu thủ do career sinh ra.
 *
 * Bố cục: `[4 ô × 45 byte NUL-pad][u32 playerId]` — khoá đứng **SAU** tên.
 * Chiều này phản trực giác và đã từng bị đọc ngược, khiến mọi tên lệch đúng một
 * bản ghi. Ground truth từ game mới phát hiện ra.
 */
export const NEWGEN_NAME_RECORD_BYTES = 184;
export const NEWGEN_NAME_SLOT_BYTES = 45;
export const NEWGEN_NAME_SLOTS = 4;

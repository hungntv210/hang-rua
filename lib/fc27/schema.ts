/**
 * Mã bảng / mã trường FIFA DB của FC27 và hằng số cộng.
 *
 * Đây là DỮ LIỆU. Title update đổi schema thì sửa file này, không sửa bộ đọc.
 *
 * Mã 4 ký tự ổn định giữa FC26 và FC27 (ánh xạ học trên cặp save + Live Editor
 * FC26, khớp 100%). HẰNG SỐ CỘNG thì KHÔNG ổn định: FC27 lưu playerid/teamid
 * dạng `id + 1` ở hầu hết bảng nhưng `career_youthplayers` lưu nguyên. Mỗi con
 * số ở đây đã được đo riêng trên save FC27 và neo vào ID công khai (Man Utd 11,
 * Newcastle 13) — đừng chép sang phiên bản khác mà không đo lại.
 *
 * Nguồn: docs/superpowers/specs/2026-09-30-save-reader-fc27-design.md §2.
 */

export interface FieldSpec {
  code: string;
  /** Cộng vào giá trị thô. */
  add: number;
}

const f = (code: string, add = 0): FieldSpec => ({ code, add });

export const FC27 = {
  players: {
    table: "CZUM",
    id: f("ykFq", -1),
    potential: f("mpuH", 1),
    overall: f("UERs", 1),
    position: f("wZQU"),
    birthDay: f("WVIU"),
    joinedDay: f("vTpl"),
    nationality: f("enmm"),
    firstNameId: f("tHlO"),
    lastNameId: f("QCfa"),
    commonNameId: f("HDYx"),
    /** 0 nam, 1 nữ. */
    gender: f("EveZ"),
  },
  links: { table: "RrqT", playerId: f("ykFq", -1), teamId: f("mCXg", -1), jersey: f("JFiY", 1) },
  teams: { table: "lyxL", teamId: f("mCXg", -1), name: f("AUsv") },
  formations: { table: "mDGw", name: f("LGsF"), fullNameId: f("nFPu") },
  teamsheets: {
    table: "zdMM",
    teamId: f("mCXg", -1),
    name: f("TrVp"),
    captain: f("FVzk", -1),
    /** playerid0..10 theo thứ tự ô; 0 thô = ô trống. */
    slots: ["MVLC", "zWHI", "SfCW", "Ncmk", "Povf", "wjrR", "RaOP", "OhyJ", "WCfU", "FJbC", "qhEx"].map((c) => f(c, -1)),
  },
  /** Team sheet kèm sơ đồ: cùng playerid0..10 với `teamsheets`, thêm vị trí + toạ độ từng ô. */
  sheetShape: {
    table: "emmj",
    teamId: f("mCXg", -1),
    /** Mã tên đầy đủ của sơ đồ — cùng mã ở bảng `formations`. */
    fullNameId: f("nFPu"),
    positions: ["ZzVx", "CEZz", "nNch", "cGsr", "aCho", "BBlW", "ksMI", "fvcy", "TMpL", "sPtx", "FuLD"].map((c) => f(c, -1)),
  },
  /** Toạ độ ô 0..10 — cùng mã ở bảng `formations` và `sheetShape`. */
  offsetX: ["XjPa", "yMyn", "pFxE", "wKsR", "TzCW", "usnj", "ZBMA", "gWJN", "DahS", "uBQf", "jIiE"],
  offsetY: ["Eozk", "NPOx", "mytG", "PJwT", "Iwmo", "RnDB", "CCIK", "fdNX", "MhRc", "lCgp", "cLmS"],
  youth: { table: "IOmq", playerId: f("ykFq", 0) },
  /**
   * Bản ghi có trong DB nhưng không phải cầu thủ dùng được trong career.
   *
   * Icon/hero (nội dung Ultimate Team) nằm trong các ĐỘI BIỂU DIỄN ("… XI",
   * "Soccer Aid"). Chỉ loại người KHÔNG gắn với CLB thật nào: đo trên save mẫu,
   * 19/189 người trong đội biểu diễn đang đá cho CLB thật (Courtois, Kane…) và
   * phải giữ. Danh sách ID Ultimate Team của FC26 KHÔNG dùng lại được: nó chứa
   * cả cầu thủ đang thi đấu.
   */
  exclusions: {
    exhibitionTeam: /(^| )XI$|^Soccer Aid$/,
    /** Đội không phải CLB: tên dạng khoá dịch "*…" và nhóm cầu thủ tự do. */
    notAClub: /^\*|^Free Agents$/,
    /** OVR ≤ mức này là bản ghi giữ chỗ, không phải cầu thủ. */
    junkMaxOverall: 1,
  },
  /** Khối career ngoài FIFA DB. */
  sections: { dbAnchorTag: "gsbd", loans: "msnl" },
};

export type Fc27Schema = typeof FC27;

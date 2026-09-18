/**
 * Hai tầng kiểu cho module Save Reader — cùng lối tổ chức với `Fd*` và kiểu nội
 * bộ trong `lib/types.ts`.
 *
 * 1. `Raw*` bám sát byte trong file: có offset, có kích thước, không format gì.
 * 2. `Save*` là kiểu UI dùng: đã có chuỗi hiển thị sẵn, đã gom thống kê.
 *
 * `lib/save/adapter.ts` là nơi duy nhất chuyển tầng 1 sang tầng 2. Khi hiểu thêm
 * về định dạng, sửa tầng 1 và adapter — component không phải đụng tới.
 */

// ────────────────────────────────────────────────────────────────────────────
// Tầng 1 — thô, bám byte
// ────────────────────────────────────────────────────────────────────────────

/**
 * Kiểu giá trị *suy đoán* của một field. Đây là phỏng đoán của `infer.ts` dựa
 * trên hình dạng byte, KHÔNG phải kiểu do file khai báo — file không nói cho ta
 * biết kiểu, đó chính là phần chưa giải mã được.
 *
 * `none` nghĩa là field nằm sát cuối file, không còn đủ 4 byte cho giá trị.
 */
export type RawValueKind = "string" | "int32" | "float32" | "none";

export interface RawField {
  /** Offset của uint32 độ dài tên — mốc để dò lại bằng hex editor. */
  nameOffset: number;
  /** Offset byte đầu tiên của giá trị. */
  valueOffset: number;
  name: string;
  kind: RawValueKind;
  /** Số byte parser cho là thuộc về giá trị này. */
  valueSize: number;
  int: number | null;
  float: number | null;
  text: string | null;
  /** Tối đa 8 byte đầu của giá trị, dạng hex — để UI diễn giải lại kiểu khác. */
  rawHex: string;
  /**
   * 4 byte đứng ngay TRƯỚC độ dài tên. Nghi là byte đánh dấu kiểu; ghi lại để
   * thống kê tần suất thay vì phỏng đoán.
   */
  markerHex: string;
}

/** Một dải byte không khớp mẫu field nào. */
export interface RawUnknownRun {
  offset: number;
  length: number;
}

/** Chuỗi ASCII nằm rời trong vùng chưa giải mã (tên đội thường rơi vào đây). */
export interface RawLooseString {
  offset: number;
  text: string;
}

/**
 * Chuỗi có tag và độ dài khai báo nhưng KHÔNG đóng vai tên field — thường là
 * tên vùng dữ liệu ("DataMananger", "deepsim"). Độ tin cậy cao hơn hẳn
 * `RawLooseString` vì chính file khai báo độ dài, không phải parser đoán.
 */
export interface RawStringToken {
  offset: number;
  text: string;
}

export interface RawScanResult {
  fields: RawField[];
  stringTokens: RawStringToken[];
  /**
   * CHỈ những vùng đủ lớn để đáng xem (xem `minRecordedUnknownRun`), đã được
   * tỉa để luôn giữ lại vùng lớn nhất. Không phải toàn bộ khe hở.
   */
  unknownRuns: RawUnknownRun[];
  /** Tổng số khe hở, kể cả khe vài byte không được ghi vào `unknownRuns`. */
  unknownRunCount: number;
  /** Tổng byte không thuộc field nào, kể cả khe nhỏ. */
  unknownBytes: number;
  looseStrings: RawLooseString[];
  bytesScanned: number;
  /** Bật khi chạm một trong các trần trong `SCAN_LIMITS` — quét dừng sớm. */
  truncated: boolean;
  /** Mô tả trần nào bị chạm, để hiển thị nguyên văn cho người dùng. */
  limitsHit: string[];
}

/** Kết quả đọc phần đầu container, trước khi quét TLV. */
export interface RawContainer {
  /** 8 byte đầu diễn giải sang ASCII (có thể là rác nếu không phải file save). */
  magic: string;
  hasFbchunksMagic: boolean;
  /** Vài uint32 ngay sau magic — version + metadata, nghĩa chưa xác định. */
  headerWords: number[];
  /** Offset của chuỗi `cmBNRY`, null nếu không tìm thấy. */
  cmBnryOffset: number | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Tầng 2 — chuẩn hoá cho UI
// ────────────────────────────────────────────────────────────────────────────

export type SaveValueType = RawValueKind;

export interface SaveField {
  /** Số thứ tự theo đúng trật tự xuất hiện trong file; dùng làm React key. */
  id: number;
  offset: number;
  valueOffset: number;
  name: string;
  type: SaveValueType;
  /** Chuỗi đã format sẵn để in ra bảng. */
  display: string;
  /** Giá trị số nếu có — để lọc và sắp xếp sau này. */
  numeric: number | null;
  text: string | null;
  rawHex: string;
  markerHex: string;
}

/** Một tên field và số lần xuất hiện — bảng này chính là công cụ khám phá. */
export interface SaveFieldStat {
  name: string;
  count: number;
  types: SaveValueType[];
  sample: string;
}

export interface SaveUnknownRegion {
  offset: number;
  length: number;
  /** Entropy Shannon (0–8 bit/byte) trên mẫu tối đa 4KB. >7.5 là nghi nén. */
  entropy: number;
  hexPreview: string;
  /** Tên thuật toán nén nếu magic khớp — null nghĩa là không nhận ra. */
  compressionGuess: string | null;
}

export interface SaveLooseString {
  offset: number;
  text: string;
}

/** Xem `RawStringToken`. */
export interface SaveStringToken {
  offset: number;
  text: string;
}

export interface SaveIssue {
  level: "info" | "warn" | "error";
  message: string;
}

export interface SaveMeta {
  fileName: string;
  fileSize: number;
  magic: string;
  isFbchunks: boolean;
  cmBnryOffset: number | null;
  headerWords: number[];
  parseMs: number;
  truncated: boolean;
}

export interface SaveCounters {
  fieldCount: number;
  distinctNameCount: number;
  stringTokenCount: number;
  unknownRegionCount: number;
  unknownBytes: number;
  looseStringCount: number;
  /** Tỷ lệ byte nằm trong field đã nhận dạng, 0–1. */
  coverage: number;
}

/**
 * Một cầu thủ đã bóc từ bảng nhị phân.
 *
 * `overall` là giá trị **tính** từ các chỉ số, không phải giá trị đọc — file
 * save không lưu nó. Kiểu dữ liệu giữ nguyên sự phân biệt này để UI không lỡ
 * trình bày nó như số lấy thẳng từ file.
 *
 * `name` chỉ có khi tra được: cầu thủ do career sinh ra lấy tên từ chính save,
 * cầu thủ có sẵn lấy từ DB nhúng. Không tra được thì để `null` chứ không bịa.
 */
export interface SavePlayer {
  playerId: number;
  name: string | null;
  /**
   * Nguồn của tên, để UI đánh dấu.
   *
   * `ultimateTeam` là nội dung Ultimate Team (icon, hero) — có trong roster của
   * game và vì thế có trong save, nhưng KHÔNG thuộc danh sách career. Phải phân
   * biệt được, nếu không một huyền thoại 45 tuổi chỉ số 91 sẽ nằm lẫn trong đội
   * hình mà không ai hiểu vì sao.
   */
  nameSource: "newgen" | "database" | "namePool" | "ultimateTeam" | null;
  /**
   * CLB **gốc** theo dataset công khai của EA đầu mùa — KHÔNG phải CLB hiện tại
   * trong career. Save chưa giải mã được trường CLB, nên `lib/save/*` luôn để
   * `null` ở đây và `SaveReaderClient` mới ghép từ DB nhúng vào.
   *
   * Hệ quả phải nói rõ ở mọi chỗ hiển thị: với cầu thủ đã chuyển nhượng trong
   * career, giá trị này SAI. Cột trên bảng vì thế đặt tên là "CLB gốc" chứ không
   * phải "CLB" — ô sai mà trông như đúng thì tệ hơn ô trống.
   */
  club: string | null;
  /** Giải của `club`. Cùng cảnh báo như trên. */
  league: string | null;
  nation: string | null;
  position: string;
  /** TÍNH từ chỉ số, sai số ±1. Xem `lib/save/career/ovr-model.ts`. */
  overall: number | null;
  potential: number | null;
  /** Ngày sinh dạng ISO `YYYY-MM-DD`. */
  birthDate: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  skillMoves: number | null;
  weakFoot: number | null;
  internationalReputation: number | null;
  /** Mã quốc gia; tên tra qua DB nhúng, dùng được cả khi không có tên cầu thủ. */
  nationalityId: number | null;
  /**
   * Chỉ số trỏ vào kho tên của game — đọc thẳng từ save, 100% chính xác.
   *
   * Đây là cách duy nhất lấy được tên cầu thủ do career sinh ra: save không lưu
   * chuỗi tên cho phần lớn nhóm này. Tra sang chữ ở `lib/fc26/names.ts`.
   */
  firstNameId: number | null;
  lastNameId: number | null;
  /** Khác 0 thì tên hiển thị là tên thường dùng, không phải "tên + họ". */
  commonNameId: number | null;
  /** 0 = nam, 1 = nữ. Đọc thẳng từ save (bit 872). */
  gender: number | null;
  /**
   * Năm hết hạn hợp đồng — ĐỌC THẲNG từ save, khớp 100% với dữ liệu game.
   *
   * Chỉ có năm chứ không có ngày: trường trong save rộng đúng 6 bit và chỉ chứa
   * năm. FC đặt hạn vào 30/06, nhưng đó là quy ước của game chứ không phải thứ
   * đọc được, nên tầng này không bịa ra ngày.
   */
  contractUntil: number | null;
  /** Ngày gia nhập CLB hiện tại, dạng ISO `YYYY-MM-DD`. Đọc thẳng từ save. */
  joinedDate: string | null;
  /**
   * Giá trị chuyển nhượng ƯỚC TÍNH, đơn vị euro.
   *
   * Khác mọi trường trên: đây không phải số đọc được. Game không lưu giá trị
   * chuyển nhượng ở bất kỳ bảng nào — nó dựng lúc chạy rồi vứt. Xem
   * `lib/fc26/value.ts`. Mọi chỗ hiển thị phải đánh dấu rõ là ước tính.
   */
  valueEstimate: number | null;
  /**
   * 31 chỉ số chi tiết, thứ tự theo `ATTRIBUTE_ORDER`.
   *
   * Mảng số chứ không phải object: 21.000 cầu thủ × 31 khoá lặp lại là hàng
   * triệu chuỗi thừa khi worker chuyển kết quả về main thread.
   */
  attributes: number[];
}

export interface SaveCareer {
  players: SavePlayer[];
  /**
   * Danh sách cầu thủ của từng CLB tìm được trong save.
   *
   * Tầng này KHÔNG biết đội nào là của người chơi — đó là việc của
   * `lib/fc26/formations.ts`, nơi đối chiếu với bảng đội hình đã biết.
   */
  squads: number[][];
  /** Số bản ghi trong bảng, kể cả ô trống. */
  tableCount: number;
  tableOffset: number;
  newgenCount: number;
  /** Bản ghi bị loại vì tuổi ngoài dải thi đấu — không phải cầu thủ. */
  droppedCount: number;
  /** Cầu thủ nữ đã bỏ qua. Báo số lượng chứ không im lặng cắt bớt. */
  womenCount: number;
  truncated: boolean;
}

export interface SaveDocument {
  meta: SaveMeta;
  counters: SaveCounters;
  fields: SaveField[];
  fieldStats: SaveFieldStat[];
  stringTokens: SaveStringToken[];
  unknownRegions: SaveUnknownRegion[];
  looseStrings: SaveLooseString[];
  /** `null` khi không định vị được bảng cầu thủ; lý do nằm trong `issues`. */
  career: SaveCareer | null;
  issues: SaveIssue[];
}

// ────────────────────────────────────────────────────────────────────────────
// Thông điệp giữa worker và UI
// ────────────────────────────────────────────────────────────────────────────

export type WorkerRequest = { kind: "parse"; file: File };

export type WorkerResponse =
  | { kind: "progress"; ratio: number }
  | { kind: "done"; doc: SaveDocument }
  | { kind: "error"; message: string };

/**
 * MỌI con số phỏng đoán của parser nằm ở đây, một chỗ duy nhất.
 *
 * Định dạng save của FC 26 chưa có đặc tả công khai; parser chạy bằng heuristic.
 * Khi bạn khám phá thêm về file, phần lớn việc tinh chỉnh sẽ là sửa các hằng số
 * trong file này chứ không phải viết lại logic — nên đừng rải chúng vào giữa
 * vòng lặp quét.
 *
 * Mỗi hằng số kèm lý do vì sao chọn giá trị đó, để lần sau còn biết đường nới.
 */

/**
 * Byte tag đã XÁC NHẬN trên file save thật (`CmMgrC20260730232114046`).
 *
 * Một field có tên nằm trong file dưới dạng:
 *
 *   01 01 | 0E 00 00 00 | "Purchase Value" | 40 78 7D 01
 *   tag     độ dài u32    tên, KHÔNG có NUL   giá trị int32 = 25.000.000
 *
 * Chuỗi đứng một mình (tên vùng dữ liệu) chỉ có một byte tag:
 *
 *   01 | 07 00 00 00 | "deepsim"
 *
 * Lưu ý cho ai chỉnh sau: độ dài KHÔNG tính byte NUL. "Sold Player Overall"
 * dài đúng 19 (0x13). Bản khảo sát ban đầu ghi 20 là đếm dư một.
 */
export const TAGS = {
  /** Mở đầu một chuỗi có khai báo độ dài. */
  string: 0x01,
  /** Byte đứng trước tag chuỗi khi chuỗi đó đóng vai TÊN của một field. */
  namedField: 0x01,
} as const;

export const NAME_HEURISTICS = {
  /** Tên ngắn hơn 2 ký tự gần như chắc chắn là trùng hợp ngẫu nhiên. */
  minLength: 2,
  /**
   * Tên dài nhất đã gặp là 22 ("Sold Player Pitch Area"). Đặt 64 cho rộng rãi
   * mà vẫn loại được uint32 rác.
   */
  maxLength: 64,
  /**
   * Tên field trong file thật đều bắt đầu bằng chữ cái. Ràng buộc này cắt rất
   * nhiều dương tính giả. Nới nếu thấy field bắt đầu bằng số bị bỏ sót.
   */
  requireLeadingLetter: true,
} as const;

export const VALUE_HEURISTICS = {
  /** Độ dài hợp lệ của chuỗi lồng bên trong giá trị. */
  minStringLength: 1,
  maxStringLength: 256,
  /**
   * Dưới ngưỡng này thì nhận int32 ngay, khỏi xét float.
   *
   * Không phải "int lớn hơn ngần này là sai" — giá trị chuyển nhượng 42,5 triệu
   * hoàn toàn hợp lệ. Ý nghĩa của ngưỡng là: một float32 "người đọc được" (7.4,
   * 0.85, 180.0) LUÔN có bit pattern đọc thành int rất lớn (7.4 → 1.088.841.421),
   * nên int nhỏ thì không thể là float đội lốt. Xem `inferValue` để hiểu vế còn
   * lại.
   */
  preferIntBelow: 16_777_216,
  /**
   * Với int lớn, chỉ chuyển sang float khi float ra con số "người đọc được".
   * 42.500.000 đọc theo float là 3,2e-38 — vô nghĩa, nên vẫn là int.
   */
  minPlausibleFloatAbs: 1e-3,
  maxPlausibleFloatAbs: 1e7,
  /** Số byte giá trị lưu lại dạng hex để UI diễn giải lại mà không parse lại. */
  rawHexBytes: 8,
} as const;

export const SCAN_LIMITS = {
  /**
   * Trần chống nổ bộ nhớ. Save 15MB ước tính vài chục nghìn field; 300k cho
   * biên rất rộng mà vẫn giữ kết quả dưới ~40MB RAM.
   */
  maxFields: 300_000,
  maxUnknownRuns: 20_000,
  /**
   * Khe hở nhỏ hơn ngần này không được ghi vào danh sách vùng chưa giải mã —
   * vẫn được tính vào tổng byte. Mỗi field để lại một khe 4 byte (chỗ byte đánh
   * dấu), nếu ghi hết thì danh sách toàn khe rác và trần bị chạm ngay đầu file,
   * làm mất đúng những blob lớn cần tìm.
   */
  minRecordedUnknownRun: 8,
  /** Chỉ vét chuỗi rời trong vùng đủ lớn — khe vài byte không chứa tên đội. */
  minLooseScanRun: 16,
  maxLooseStrings: 50_000,
  /** Chuỗi rời ngắn hơn ngần này chủ yếu là nhiễu. */
  minLooseStringLength: 4,
  /**
   * Chuỗi rời phải có ít nhất ngần này chữ cái. Nhiễu ngẫu nhiên thường lọt
   * lưới "ASCII in được" (`%}BL#`) nhưng hiếm khi có 3 chữ cái liền mạch trong
   * một chuỗi toàn ký tự an toàn.
   */
  minLooseStringLetters: 3,
  /**
   * Chuỗi rời phải kết thúc bằng byte NUL.
   *
   * Đây là lưới lọc hiệu quả nhất, và nó đến từ quan sát trên file thật: tên
   * đội nằm trong bảng bản ghi cố định nên luôn có phần đệm NUL phía sau
   * ("Fluminense" rồi một dãy 00). Rác ASCII lọt giữa vùng nhị phân thì gần như
   * không bao giờ dừng đúng ở một byte NUL.
   *
   * Tắt cờ này nếu nghi có bảng dùng đệm khác (khoảng trắng, độ dài cố định
   * không đệm) — sẽ nhiễu hơn nhiều nhưng không bỏ sót.
   */
  requireLooseStringNulTerminator: true,
  /** Cắt chuỗi rời quá dài khi hiển thị. */
  maxLooseStringLength: 200,
  /** Số byte hex xem trước cho mỗi vùng chưa giải mã. */
  unknownPreviewBytes: 32,
  /** Số vùng chưa giải mã giữ lại để hiển thị (đã sắp theo độ dài giảm dần). */
  maxUnknownRegionsKept: 5_000,
  /** Gọi onProgress mỗi ngần này byte. */
  progressStepBytes: 1024 * 1024,
} as const;

export const FILE_LIMITS = {
  /** Trên mức này thì từ chối — trình duyệt sẽ hết bộ nhớ trước parser. */
  maxBytes: 128 * 1024 * 1024,
  /** Trên mức này thì vẫn chạy nhưng cảnh báo trước cho người dùng. */
  warnBytes: 64 * 1024 * 1024,
} as const;

/**
 * Magic của các thuật toán nén phổ biến, dùng để đoán nội dung vùng chưa giải
 * mã. Khảo sát cho thấy zlib là dương tính giả — vẫn giữ trong danh sách vì
 * việc *nhận diện* magic khác với việc giải nén thành công, và biết "chỗ này có
 * 78 9C nhưng không bung được" cũng là một dữ kiện.
 */
export const COMPRESSION_MAGICS: ReadonlyArray<{
  name: string;
  bytes: readonly number[];
}> = [
  { name: "zstd", bytes: [0x28, 0xb5, 0x2f, 0xfd] },
  { name: "LZ4 frame", bytes: [0x04, 0x22, 0x4d, 0x18] },
  { name: "gzip", bytes: [0x1f, 0x8b] },
  { name: "zlib", bytes: [0x78, 0x01] },
  { name: "zlib", bytes: [0x78, 0x5e] },
  { name: "zlib", bytes: [0x78, 0x9c] },
  { name: "zlib", bytes: [0x78, 0xda] },
  { name: "bzip2", bytes: [0x42, 0x5a, 0x68] },
  { name: "LZMA/7z", bytes: [0x5d, 0x00, 0x00] },
];

/** Ngưỡng entropy coi là "gần như chắc chắn đã nén hoặc mã hoá". */
export const HIGH_ENTROPY_THRESHOLD = 7.5;

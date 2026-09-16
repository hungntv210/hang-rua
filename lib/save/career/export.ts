/**
 * Dựng nội dung các file xuất ra từ kết quả đọc save.
 *
 * VÌ SAO TÁCH KHỎI COMPONENT: bản trước nằm thẳng trong `ExportButtons` và nhận
 * mỗi `doc`. Nhưng tên cầu thủ được ghép ở `SaveReaderClient` SAU khi worker trả
 * kết quả, nên `doc.career.players` không bao giờ có tên — file xuất ra là một
 * danh sách 21.000 cầu thủ với `name: null`, đúng thứ người dùng cần nhất thì
 * lại thiếu. Tách ra buộc hàm phải nhận danh sách đã ghép làm tham số, và lỗi
 * kiểu đó không tái diễn được nữa.
 *
 * Không hàm nào ở đây đụng tới `document` hay `Blob`: chúng trả về chuỗi hoặc
 * object thuần, nên chạy được bằng Node để tự kiểm.
 */

import type { SaveDocument, SavePlayer } from "../types";
import { ATTRIBUTE_GROUPS, ATTRIBUTE_ORDER, type AttributeName } from "./schema";
import { OVR_ACCURACY } from "./ovr-model";

/**
 * Nhãn tiếng Việt cho từng chỉ số, phẳng hoá từ `ATTRIBUTE_GROUPS`.
 *
 * Tra ngược về chính tên khoá khi thiếu, chứ không bỏ cột: file xuất ra mà mất
 * cột thì người đọc không có cách nào biết; còn thấy `gkDiving` thay vì "Bay
 * người" thì vẫn dùng được và lộ ngay ra là hai danh sách đã lệch nhau.
 */
const ATTRIBUTE_LABELS = new Map<AttributeName, string>(
  ATTRIBUTE_GROUPS.flatMap((g) => g.items),
);

function attributeLabel(name: AttributeName): string {
  return ATTRIBUTE_LABELS.get(name) ?? name;
}

/**
 * Chú thích nguồn gốc, nhúng thẳng vào file xuất ra.
 *
 * File JSON rời khỏi trang là mất hết ngữ cảnh mà giao diện đang giải thích:
 * cột nào đọc thẳng từ save, cột nào tính ra, cột nào mượn từ dataset ngoài.
 * Ai mở file ba tháng sau — hoặc người bạn gửi file cho — không có cách nào
 * biết, nên phần này đi kèm dữ liệu chứ không nằm lại trên trang.
 */
export const PROVENANCE = {
  overall:
    `TÍNH từ 31 chỉ số thành phần, KHÔNG đọc từ save — file save không lưu chỉ ` +
    `số tổng. Sai số ±1 ở ${(OVR_ACCURACY.withinOne * 100).toFixed(1)}% trường hợp.`,
  potential: "Đọc thẳng từ save.",
  growth:
    "TN − CS. Ra −1 ở khoảng 3,6% cầu thủ đã chạm trần tiềm năng — đó là sai " +
    "số làm tròn của CS (xem `overall`), KHÔNG phải cầu thủ bị tụt chỉ số. " +
    "Bảng trên trang giấu số âm này đi, còn file xuất ra thì giữ nguyên để lọc được.",
  attributes:
    "Đọc thẳng từ save. Thiếu 3 chỉ số chưa giải mã: volleys, def_awareness, gk_positioning.",
  club:
    "CLB GỐC theo dataset công khai của EA đầu mùa — KHÔNG phải CLB hiện tại " +
    "trong career. Save chưa giải mã được CLB, nên cột này sẽ sai với bất kỳ " +
    "cầu thủ nào đã chuyển nhượng trong career.",
  league: "Giải của CLB gốc. Cùng cảnh báo như `club`.",
  name:
    "newgen = tên đọc từ chính save (cầu thủ do career sinh ra). " +
    "database = tra từ dataset công khai theo playerId. " +
    "null = không có ở cả hai nguồn.",
  nation: "Tra từ mã quốc gia đọc thẳng trong save — có cho cả cầu thủ chưa có tên.",
  birthDate: "Đọc thẳng từ save.",
  age: "Tính từ ngày sinh và mốc thời gian ước lượng của career.",
} as const;

// ────────────────────────────────────────────────────────────────────────────
// CSV
// ────────────────────────────────────────────────────────────────────────────

/** Bọc ô CSV theo RFC 4180: chỉ bọc khi cần, nhân đôi dấu nháy bên trong. */
function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CSV_HEADERS = [
  "ID",
  "Tên",
  "Nguồn tên",
  "CLB gốc",
  "Giải gốc",
  "Quốc tịch",
  "Vị trí",
  "Tuổi",
  "Ngày sinh",
  "CS (tính)",
  "TN",
  "Tăng trưởng",
  "Cao (cm)",
  "Nặng (kg)",
  "Kỹ năng",
  "Chân không thuận",
  "Danh tiếng",
  ...ATTRIBUTE_ORDER.map(attributeLabel),
];

/**
 * Bảng cầu thủ dạng CSV — định dạng người dùng thật sự mở được bằng Excel hoặc
 * Google Sheets, khác với JSON là thứ để máy đọc.
 *
 * Có BOM UTF-8 ở đầu. Không có nó thì Excel trên Windows đọc file bằng bảng mã
 * ANSI của hệ thống và mọi tên tiếng Việt lẫn tên cầu thủ có dấu đều thành rác.
 * Đây không phải chi tiết làm đẹp: thiếu ba byte đó là file hỏng với phần lớn
 * người dùng của trang này.
 */
export function playersToCsv(players: SavePlayer[]): string {
  const lines = [CSV_HEADERS.join(",")];

  for (const p of players) {
    const grow = p.overall !== null && p.potential !== null ? p.potential - p.overall : null;
    const row = [
      p.playerId,
      p.name,
      p.nameSource,
      p.club,
      p.league,
      p.nation,
      p.position,
      p.age,
      p.birthDate,
      p.overall,
      p.potential,
      grow,
      p.heightCm,
      p.weightKg,
      p.skillMoves,
      p.weakFoot,
      p.internationalReputation,
      // `?? null` chứ không `?? 0`: ô trống nói "không đọc được", số 0 nói "chỉ
      // số bằng 0". Hai chuyện khác nhau, và người đọc file không phân biệt được
      // nếu ta gộp chúng lại.
      ...ATTRIBUTE_ORDER.map((_, i) => p.attributes[i] ?? null),
    ];
    lines.push(row.map(csvCell).join(","));
  }

  // CRLF theo RFC 4180 — Excel chấp nhận cả hai, nhưng vài công cụ Windows cũ thì không.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

// ────────────────────────────────────────────────────────────────────────────
// JSON
// ────────────────────────────────────────────────────────────────────────────

/**
 * Trải mảng 31 số thành object có tên khoá.
 *
 * Trong app thì mảng là đúng: nó đi qua ranh giới worker 21.000 lần, và lặp lại
 * 31 tên khoá mỗi lần là hàng triệu chuỗi thừa. Nhưng file rời khỏi app thì
 * ngược lại — một mảng 31 số trần không tự mô tả được, người nhận phải có đúng
 * bản `schema.ts` này mới giải nghĩa nổi.
 */
function namedAttributes(values: number[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  ATTRIBUTE_ORDER.forEach((name, i) => {
    out[name] = values[i] ?? null;
  });
  return out;
}

/** Thống kê bảng cầu thủ, KHÔNG kèm danh sách — dùng chung cho cả hai bản xuất. */
function careerSummary(doc: SaveDocument) {
  if (!doc.career) return null;
  const { tableCount, tableOffset, newgenCount, droppedCount, truncated } = doc.career;
  return { tableCount, tableOffset, newgenCount, droppedCount, truncated };
}

/** Danh sách cầu thủ dạng JSON, kèm chú thích nguồn gốc. */
export function playersToJson(doc: SaveDocument, players: SavePlayer[]) {
  return {
    meta: doc.meta,
    career: careerSummary(doc),
    playerCount: players.length,
    ghiChuNguonGoc: PROVENANCE,
    players: players.map((p) => ({
      ...p,
      attributes: namedAttributes(p.attributes),
    })),
  };
}

/**
 * Mọi thứ TRỪ danh sách cầu thủ — để báo lỗi định dạng mà không phải gửi kèm
 * vài chục MB.
 *
 * Trước đây nút này tên là "tóm tắt", và đó là lời hứa sai: nó bỏ hẳn phần
 * chính của kết quả mà không nói gì. Tên mới mô tả đúng thứ bên trong.
 */
export function diagnosticsToJson(doc: SaveDocument) {
  return {
    meta: doc.meta,
    counters: doc.counters,
    issues: doc.issues,
    career: careerSummary(doc),
    fields: doc.fields,
    fieldStats: doc.fieldStats,
    stringTokens: doc.stringTokens,
    unknownRegions: doc.unknownRegions,
    looseStrings: doc.looseStrings,
  };
}

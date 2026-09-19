/**
 * Đọc bản export career do `scripts/fc26-dump-career.lua` sinh ra.
 *
 * ─── VÌ SAO KHÔNG NƯỚNG VÀO ASSET ───────────────────────────────────────────
 *
 * Bản trước nướng bảng team sheet vào `formations.json` lúc build và trang phát
 * lại nó. Đó là ảnh chụp MỘT career tại MỘT thời điểm: người chơi xếp lại đội
 * hình thì trang vẫn hiện trạng thái cũ, và save từ trước ngày chụp thì không
 * khớp đội nào nên không hiện gì.
 *
 * Nên bản export ở đây do người dùng TẢI LÊN cùng file save, không đi kèm ứng
 * dụng. Nó vẫn là ảnh chụp — nhưng là ảnh chụp của chính họ, và quan trọng hơn:
 *
 * ─── CỔNG CHẶN THỜI ĐIỂM ────────────────────────────────────────────────────
 *
 * Export và save phải mô tả CÙNG một trạng thái. Người dùng rất dễ chạy export,
 * chơi thêm nửa mùa, rồi tải lên save mới với export cũ — và khi đó trang sẽ
 * hiển thị đội hình của một thời điểm với chỉ số của một thời điểm khác, trộn
 * vào nhau mà không có dấu hiệu gì.
 *
 * `validate` chặn đúng chuyện đó: mọi cầu thủ trong team sheet phải có mặt
 * trong đội hình đọc từ save. Lệch quá ngưỡng thì TỪ CHỐI dùng export, và trang
 * lùi về đội hình gợi ý — thà mất tính năng còn hơn hiển thị số liệu trộn.
 *
 * Cùng nguyên tắc với cổng chặn thời điểm trong `probe-fields.ts`, và cũng cùng
 * lý do: hai nguồn dữ liệu lệch thời điểm cho ra kết quả trông hoàn toàn bình
 * thường.
 */

// ────────────────────────────────────────────────────────────────────────────
// CSV
// ────────────────────────────────────────────────────────────────────────────

/** Bọc ô theo RFC 4180 — tên đội hình có dấu phẩy là chuyện bình thường. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') cur += c;
      else if (line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const head = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    head.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

const num = (v: string | undefined): number => {
  if (v === undefined || v === "") return -1;
  const n = Number(v);
  return Number.isFinite(n) ? n : -1;
};

// ────────────────────────────────────────────────────────────────────────────
// Kiểu
// ────────────────────────────────────────────────────────────────────────────

/** Số suất trong một team sheet: 11 đá chính + dự bị + dự phòng. */
export const SHEET_SLOTS = 49;
/** Bao nhiêu suất đầu là đội hình xuất phát. */
export const STARTING_SLOTS = 11;

export interface TeamSheet {
  teamId: number;
  name: string;
  captainId: number;
  /** Dài đúng `SHEET_SLOTS`; suất trống là -1. */
  slots: number[];
}

export interface CareerExport {
  /** Đội của người chơi, đọc thẳng từ `career_users` — không phải suy đoán. */
  clubTeamId: number;
  nationalTeamId: number;
  sheets: TeamSheet[];
  /** playerId → số áo, chỉ trong phạm vi đội của người chơi. */
  jerseyOf: Map<number, number>;
  /** playerId → mã vị trí trong đội (0-27 đá chính, 28 dự bị, 29 dự phòng). */
  slotCodeOf: Map<number, number>;
  /** playerId → lương mỗi tuần. Rỗng nếu không nạp `career_playercontract`. */
  wageOf: Map<number, number>;
}

/** Tên file mà `fc26-dump-career.lua` sinh ra. Khớp theo tên, không theo thứ tự. */
export const EXPORT_FILES = {
  users: "fc26_career_users.csv",
  sheets: "fc26_cm_teamsheets.csv",
  links: "fc26_teamplayerlinks.csv",
  contracts: "fc26_career_playercontract.csv",
} as const;

/** File bắt buộc — thiếu một trong ba thì không dựng được đội hình thật. */
export const REQUIRED_FILES = [EXPORT_FILES.users, EXPORT_FILES.sheets, EXPORT_FILES.links];

// ────────────────────────────────────────────────────────────────────────────
// Đọc
// ────────────────────────────────────────────────────────────────────────────

export type ParseResult =
  | { ok: true; data: CareerExport }
  | { ok: false; reason: string; missing?: string[] };

/**
 * Dựng `CareerExport` từ nội dung các file, khớp theo TÊN FILE.
 *
 * Khớp theo tên chứ không theo thứ tự người dùng chọn: không ai nhớ được thứ tự
 * đúng, và chọn nhầm thứ tự sẽ cho ra dữ liệu sai chứ không phải lỗi.
 */
export function parseCareerExport(files: Map<string, string>): ParseResult {
  const pick = (name: string) => files.get(name.toLowerCase());

  const missing = REQUIRED_FILES.filter((f) => !pick(f));
  if (missing.length > 0) {
    return { ok: false, reason: "thiếu file", missing };
  }

  const users = parseCsv(pick(EXPORT_FILES.users)!);
  if (users.length === 0) {
    return { ok: false, reason: `${EXPORT_FILES.users} rỗng — bản export này chạy ngoài career mode` };
  }
  const clubTeamId = num(users[0].clubteamid);
  const nationalTeamId = num(users[0].nationalteamid);
  if (clubTeamId <= 0) {
    return { ok: false, reason: "không đọc được mã câu lạc bộ của người chơi" };
  }

  const myTeams = new Set([clubTeamId, nationalTeamId].filter((t) => t > 0));

  const sheets: TeamSheet[] = [];
  for (const row of parseCsv(pick(EXPORT_FILES.sheets)!)) {
    const teamId = num(row.teamid);
    if (!myTeams.has(teamId)) continue;
    const slots: number[] = [];
    for (let i = 0; i < SHEET_SLOTS; i += 1) slots.push(num(row[`playerid${i}`]));
    sheets.push({
      teamId,
      name: row.teamsheetname ?? "",
      captainId: num(row.captainid),
      slots,
    });
  }
  if (sheets.length === 0) {
    return { ok: false, reason: "bản export không có đội hình nào của đội bạn cầm" };
  }

  const jerseyOf = new Map<number, number>();
  const slotCodeOf = new Map<number, number>();
  for (const row of parseCsv(pick(EXPORT_FILES.links)!)) {
    if (!myTeams.has(num(row.teamid))) continue;
    const pid = num(row.playerid);
    if (pid <= 0) continue;
    const jersey = num(row.jerseynumber);
    if (jersey > 0) jerseyOf.set(pid, jersey);
    const code = num(row.position);
    if (code >= 0) slotCodeOf.set(pid, code);
  }
  if (jerseyOf.size === 0 && slotCodeOf.size === 0) {
    return {
      ok: false,
      reason: `${EXPORT_FILES.links} không chứa cầu thủ nào của đội bạn — bản export này chạy ngoài career mode`,
    };
  }

  const wageOf = new Map<number, number>();
  const contracts = pick(EXPORT_FILES.contracts);
  if (contracts) {
    for (const row of parseCsv(contracts)) {
      const pid = num(row.playerid);
      const wage = num(row.wage);
      if (pid > 0 && wage > 0) wageOf.set(pid, wage);
    }
  }

  return { ok: true, data: { clubTeamId, nationalTeamId, sheets, jerseyOf, slotCodeOf, wageOf } };
}

// ────────────────────────────────────────────────────────────────────────────
// Cổng chặn thời điểm
// ────────────────────────────────────────────────────────────────────────────

/** Dưới tỉ lệ này thì export và save mô tả hai thời điểm khác nhau. */
const MIN_OVERLAP = 0.9;

export interface GateResult {
  ok: boolean;
  /** Bao nhiêu cầu thủ của team sheet có mặt trong đội hình đọc từ save. */
  matched: number;
  total: number;
  message: string;
}

/**
 * Export và save có mô tả cùng một thời điểm không?
 *
 * Trả về kết quả mô tả được, không phải một boolean trần: người dùng cần biết
 * lệch bao nhiêu để đoán ra mình quên bước nào.
 */
export function validateAgainstSave(sheet: TeamSheet, saveSquad: Set<number>): GateResult {
  const filled = sheet.slots.filter((p) => p > 0);
  const matched = filled.filter((p) => saveSquad.has(p)).length;
  const ratio = filled.length === 0 ? 0 : matched / filled.length;

  if (filled.length === 0) {
    return { ok: false, matched: 0, total: 0, message: "đội hình trong bản export rỗng" };
  }
  if (ratio >= MIN_OVERLAP) {
    return {
      ok: true,
      matched,
      total: filled.length,
      message: `khớp ${matched}/${filled.length} cầu thủ với file save`,
    };
  }
  return {
    ok: false,
    matched,
    total: filled.length,
    message:
      `chỉ khớp ${matched}/${filled.length} cầu thủ với file save. Bản export và file save ` +
      `là hai thời điểm khác nhau — chạy lại script Lua rồi lưu game ngay sau đó.`,
  };
}

/**
 * Những team sheet qua được cổng chặn, nhiều khớp nhất trước.
 *
 * Trả về DANH SÁCH chứ không phải một sheet, và đó là chỗ bản đầu làm sai. Nó
 * chọn sheet khớp nhiều cầu thủ nhất, rồi dừng — nên với career này nó chọn
 * "ACA" (24/24) thay vì "NEW GALAXY FC Default" (20/20).
 *
 * "ACA" là đội hình đội trẻ. Mã vị trí của 11 người trong đó là 28/29 (dự bị,
 * dự phòng) chứ không phải 0-27, vì `teamplayerlinks.position` chỉ mô tả MỘT
 * cách xếp cho mỗi cặp (cầu thủ, đội) — cách xếp của sheet chính. Nên không sơ
 * đồ nào khớp và cả tính năng im lặng không chạy.
 *
 * Tiêu chí đúng không phải "khớp nhiều nhất" mà là "dựng được sơ đồ" — thứ chỉ
 * biết được sau khi thử. Nên tầng này trả về ứng viên, còn tầng dựng đội hình
 * thử từng cái và giữ cái chạy được.
 */
export function gateSheets(
  data: CareerExport,
  saveSquad: Set<number>,
): Array<{ sheet: TeamSheet; gate: GateResult }> {
  return data.sheets
    .map((sheet) => ({ sheet, gate: validateAgainstSave(sheet, saveSquad) }))
    .filter((x) => x.gate.ok)
    .sort((a, b) => b.gate.matched - a.gate.matched);
}

/** Kết quả cổng chặn tốt nhất, kể cả khi trượt — để báo lý do cho người dùng. */
export function bestGate(data: CareerExport, saveSquad: Set<number>): GateResult | null {
  let best: GateResult | null = null;
  for (const sheet of data.sheets) {
    const gate = validateAgainstSave(sheet, saveSquad);
    if (!best || gate.matched > best.matched) best = gate;
  }
  return best;
}

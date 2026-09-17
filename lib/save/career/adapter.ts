/**
 * `RawPlayer` (bám sát bit) → `SavePlayer` (chuẩn hoá cho UI).
 *
 * Cùng vai trò với `lib/save/adapter.ts` và `lib/football-data.ts`: giữ tầng
 * bám-byte tách khỏi tầng trình bày, để đổi một bên không kéo theo bên kia.
 *
 * Tầng này KHÔNG tra DB nhúng — nó chỉ ghép được tên cầu thủ do career sinh ra,
 * thứ nằm sẵn trong file. Tên cầu thủ có sẵn do client ghép sau khi tải DB, nhờ
 * vậy `lib/save/*` không cần biết tới `fetch` và vẫn chạy được bằng Node.
 */

import type { SaveCareer, SavePlayer } from "../types";
import type { CareerPlayers } from "./index";
import type { NewgenName } from "./newgen-names";
import type { RawPlayer } from "./players";
import { ATTRIBUTE_ORDER, positionName } from "./schema";

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.2425;

/** Ngoài dải này thì bản ghi không phải cầu thủ đang thi đấu. */
const MIN_AGE = 14;
const MAX_AGE = 45;

/**
 * Tuổi ứng với phân vị 99,9% ngày sinh của toàn bảng.
 *
 * ĐO ĐƯỢC, không phải đoán. Xem chú thích của `estimateCurrentDay`.
 */
const AGE_AT_P999 = 16.47;

/** Phân vị dùng làm mốc. */
const ANCHOR_PERCENTILE = 0.999;

/**
 * Ước lượng ngày hiện tại trong game từ chính dữ liệu.
 *
 * Lịch career chưa giải mã được, nên phải suy ra. Lấy ngày thật thì tuổi sai dần
 * theo số mùa đã chơi — sau năm mùa là lệch năm tuổi.
 *
 * ─── VÌ SAO BỎ NHÁNH "NEO THEO LỨA HỌC VIỆN" ────────────────────────────────
 *
 * Bản trước ưu tiên neo vào lứa học viện với hằng số 15,5 năm. Nó SAI 1,4 NĂM,
 * và hệ quả là cột Tuổi cao hơn thực tế một tuổi với gần như toàn bộ cầu thủ.
 *
 * Đo được bằng export Live Editor cùng thời điểm với save (career ở mùa 1, đã
 * đá 12 trận, trận gần nhất 28-10-2025, có sự kiện tương lai 13-12-2025 và
 * 01-01-2026 — nên "hôm nay" trong career là đầu tháng 11 năm 2025):
 *
 *   mốc lứa học viện  →  13-03-2027   lệch +511 ngày
 *   ngày thật         →  ~05-11-2025
 *
 * Hai lý do nhánh đó hỏng:
 *
 *   1. Hằng số sai. Cầu thủ học viện trẻ nhất trong save này 14,15 tuổi chứ
 *      không phải 15,5 — học viện nhận từ 14.
 *   2. Cỡ mẫu quá nhỏ. Career mùa 1 mới có 20 newgen, nên `max(...)` của nhóm
 *      đó là một ước lượng rất nhiễu. Phân vị của 21.608 cầu thủ thì không.
 *
 * Nên giờ chỉ còn một đường: phân vị 99,9% ngày sinh toàn bảng. Neo này tự
 * chỉnh theo thời gian vì game liên tục sinh cầu thủ 16 tuổi mới, nên đuôi trẻ
 * của phân bố luôn bám sát "hiện tại" bất kể career đã chạy bao nhiêu mùa.
 * Dùng phân vị chứ không dùng giá trị lớn nhất vì bản ghi rác tồn tại thật —
 * giá trị lớn nhất trong save này ứng với một "cầu thủ" 6 tuổi.
 *
 * ─── ĐỘ CHÍNH XÁC ───────────────────────────────────────────────────────────
 *
 * Hằng số 16,47 hiệu chuẩn trên MỘT career ở mùa 1, và ngày thật chỉ biết trong
 * khoảng ba tuần. Nên tuổi có thể lệch 1 với những cầu thủ có sinh nhật rơi
 * đúng khoảng đó — cỡ vài phần trăm, thay vì gần như toàn bộ như trước.
 */
function estimateCurrentDay(allBirthDays: number[]): number {
  if (allBirthDays.length === 0) return Math.floor(Date.now() / DAY_MS);
  const sorted = [...allBirthDays].sort((a, b) => a - b);
  const anchor =
    sorted[Math.floor(sorted.length * ANCHOR_PERCENTILE)] ?? sorted[sorted.length - 1];
  return anchor + AGE_AT_P999 * YEAR_DAYS;
}

function ageFrom(birthDay: number, referenceDay: number): number | null {
  const years = (referenceDay - birthDay) / YEAR_DAYS;
  if (!Number.isFinite(years)) return null;
  return Math.floor(years);
}

export function toSavePlayer(
  raw: RawPlayer,
  newgen: NewgenName | undefined,
  referenceDay: number,
): SavePlayer {
  const birthDate =
    raw.birthDay === null ? null : new Date(raw.birthDay * DAY_MS).toISOString().slice(0, 10);

  return {
    playerId: raw.playerId,
    name: newgen ? newgen.full : null,
    nameSource: newgen ? "newgen" : null,
    club: null,
    league: null,
    nation: null,
    position: positionName(raw.positionCode),
    overall: raw.overall,
    potential: raw.potential,
    birthDate,
    age: raw.birthDay === null ? null : ageFrom(raw.birthDay, referenceDay),
    heightCm: raw.heightCm,
    weightKg: raw.weightKg,
    skillMoves: raw.skillMoves,
    weakFoot: raw.weakFoot,
    internationalReputation: raw.internationalReputation,
    nationalityId: raw.nationalityId,
    // Trường khuyết thành 0 để mảng luôn đúng độ dài; UI hiểu 0 là chưa đọc được.
    attributes: ATTRIBUTE_ORDER.map((name) => raw.attributes[name] ?? 0),
  };
}

export function buildCareer(result: CareerPlayers): SaveCareer | null {
  if (!result.table) return null;

  const birthDays = result.players
    .map((p) => p.birthDay)
    .filter((d): d is number => d !== null);
  const referenceDay = estimateCurrentDay(birthDays);

  const all = result.players.map((p) =>
    toSavePlayer(p, result.newgenNames.get(p.playerId), referenceDay),
  );

  // Bản ghi ngoài dải tuổi thi đấu không phải cầu thủ — đã thấy "cầu thủ" 65
  // tuổi chỉ số 94 lọt vào. Loại hẳn thay vì hiển thị: một dòng vô lý làm hỏng
  // lòng tin vào cả bảng.
  const players = all.filter((p) => p.age !== null && p.age >= MIN_AGE && p.age <= MAX_AGE);

  return {
    players,
    squads: result.squads,
    tableCount: result.table.count,
    tableOffset: result.table.base,
    newgenCount: result.newgenNames.size,
    droppedCount: all.length - players.length,
    truncated: result.truncated,
  };
}

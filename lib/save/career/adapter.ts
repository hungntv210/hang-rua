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

/** Cầu thủ trẻ nhất của một lứa học viện. */
const YOUNGEST_NEWGEN_AGE = 15.5;
/** Cầu thủ trẻ nhất trong toàn bảng khi không có lứa học viện để neo. */
const YOUNGEST_ANY_AGE = 15;

/**
 * Ước lượng ngày hiện tại trong game từ chính dữ liệu.
 *
 * Lịch career chưa giải mã được, nên phải suy ra. Lấy ngày thật thì tuổi sai dần
 * theo số mùa đã chơi — sau năm mùa là lệch năm tuổi.
 *
 * Neo tốt nhất là **lứa học viện**: nhóm này luôn 15–18 tuổi bất kể career đã
 * chạy bao lâu, nên ngày sinh muộn nhất của họ cộng ~15,5 năm cho ra mốc hiện
 * tại khá sát.
 *
 * Không có lứa học viện thì lùi về phân vị 99,9% của toàn bảng. Kém tin cậy hơn
 * vì cầu thủ trẻ nhất của game gốc có thể tới 16–17 tuổi, nhưng vẫn tốt hơn ngày
 * thật. Dùng phân vị chứ không dùng giá trị lớn nhất để một bản ghi rác không
 * kéo lệch cả mốc.
 */
function estimateCurrentDay(allBirthDays: number[], newgenBirthDays: number[]): number {
  if (newgenBirthDays.length >= 5) {
    return Math.max(...newgenBirthDays) + YOUNGEST_NEWGEN_AGE * YEAR_DAYS;
  }
  if (allBirthDays.length === 0) return Math.floor(Date.now() / DAY_MS);
  const sorted = [...allBirthDays].sort((a, b) => a - b);
  const p = sorted[Math.floor(sorted.length * 0.999)] ?? sorted[sorted.length - 1];
  return p + YOUNGEST_ANY_AGE * YEAR_DAYS;
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
  const newgenBirthDays = result.players
    .filter((p) => result.newgenNames.has(p.playerId))
    .map((p) => p.birthDay)
    .filter((d): d is number => d !== null);
  const referenceDay = estimateCurrentDay(birthDays, newgenBirthDays);

  const all = result.players.map((p) =>
    toSavePlayer(p, result.newgenNames.get(p.playerId), referenceDay),
  );

  // Bản ghi ngoài dải tuổi thi đấu không phải cầu thủ — đã thấy "cầu thủ" 65
  // tuổi chỉ số 94 lọt vào. Loại hẳn thay vì hiển thị: một dòng vô lý làm hỏng
  // lòng tin vào cả bảng.
  const players = all.filter((p) => p.age !== null && p.age >= MIN_AGE && p.age <= MAX_AGE);

  return {
    players,
    tableCount: result.table.count,
    tableOffset: result.table.base,
    newgenCount: result.newgenNames.size,
    droppedCount: all.length - players.length,
    truncated: result.truncated,
  };
}

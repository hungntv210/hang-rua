/**
 * Bộ lọc cho tab Scout.
 *
 * ─── VÌ SAO TÁCH KHỎI COMPONENT ─────────────────────────────────────────────
 *
 * Lọc sai mà kết quả vẫn trông hợp lý là loại lỗi không ai phát hiện bằng mắt.
 * Để trong `PlayerTable` thì không có cách nào kiểm tự động; tách ra thì
 * `scripts/check-scout.ts` chạy nó trên save thật ở mỗi lượt `check:fc26`.
 *
 * ─── Ô TRỐNG BỊ LOẠI, KHÔNG ĐƯỢC CHO QUA ────────────────────────────────────
 *
 * Cầu thủ thiếu tuổi hoặc thiếu chỉ số thì KHÔNG thoả một điều kiện "tối
 * thiểu". "Không biết thì cho qua" nghe có vẻ rộng lượng nhưng nó đưa vào kết
 * quả đúng những dòng mà người dùng vừa bảo là không muốn thấy.
 */

import type { SavePlayer } from "../save/types";
import { groupOf, type PositionGroup } from "./positions";

export interface ScoutCriteria {
  /** Khớp tên, CLB gốc, quốc tịch, vị trí chính xác, hoặc playerId. */
  query: string;
  minAge: number | null;
  maxAge: number | null;
  /** Rỗng nghĩa là mọi tuyến, không phải "không tuyến nào". */
  groups: PositionGroup[];
  minOverall: number | null;
  minPotential: number | null;
  /** Tiềm năng trừ chỉ số hiện tại. */
  minGrowth: number | null;
  onlyNewgen: boolean;
  /** Đội của người chơi — họ đã có ở tab Đội hình rồi. `null` là không loại ai. */
  excludeIds: Set<number> | null;
}

export const EMPTY_CRITERIA: ScoutCriteria = {
  query: "",
  minAge: null,
  maxAge: null,
  groups: [],
  minOverall: null,
  minPotential: null,
  minGrowth: null,
  onlyNewgen: false,
  excludeIds: null,
};

/** `null` không bao giờ thoả một ngưỡng tối thiểu. Xem chú thích đầu file. */
const atLeast = (value: number | null, min: number | null): boolean =>
  min === null || (value !== null && value >= min);

export function filterPlayers(players: SavePlayer[], c: ScoutCriteria): SavePlayer[] {
  const needle = c.query.trim().toLowerCase();
  const groups = c.groups.length > 0 ? new Set(c.groups) : null;

  return players.filter((p) => {
    if (c.excludeIds?.has(p.playerId)) return false;
    if (c.onlyNewgen && p.nameSource !== "newgen") return false;

    if (c.minAge !== null && (p.age === null || p.age < c.minAge)) return false;
    if (c.maxAge !== null && (p.age === null || p.age > c.maxAge)) return false;

    if (!atLeast(p.overall, c.minOverall)) return false;
    if (!atLeast(p.potential, c.minPotential)) return false;
    if (c.minGrowth !== null) {
      if (p.overall === null || p.potential === null) return false;
      if (p.potential - p.overall < c.minGrowth) return false;
    }

    if (groups && !groups.has(groupOf(p.position))) return false;

    if (!needle) return true;
    return (
      (p.name?.toLowerCase().includes(needle) ?? false) ||
      (p.club?.toLowerCase().includes(needle) ?? false) ||
      (p.nation?.toLowerCase().includes(needle) ?? false) ||
      p.position.toLowerCase() === needle ||
      String(p.playerId) === needle
    );
  });
}

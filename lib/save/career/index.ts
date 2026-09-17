/**
 * Cửa vào tầng career: từ byte thô ra danh sách cầu thủ.
 *
 * Không chạm DOM, không fetch. Tên cầu thủ thật đến từ DB nhúng và được ghép ở
 * tầng trên (`lib/fc26/db.ts`) — tầng này chỉ đọc những gì có trong file.
 */

import { BitRecordReader } from "../bitreader";
import { isValidRecordAt, locatePlayerTable } from "./locate";
import { readNewgenNames, type NewgenName } from "./newgen-names";
import { decodeAllPlayers, type RawPlayer } from "./players";
import { findSquads } from "./squad";

/** Trần bản ghi. Vượt thì cắt và bật cờ `truncated` — không im lặng bỏ qua. */
export const MAX_PLAYERS = 100_000;

export interface CareerPlayers {
  players: RawPlayer[];
  newgenNames: Map<number, NewgenName>;
  table: { base: number; count: number; keyQuality: number } | null;
  /**
   * Danh sách cầu thủ của từng CLB, đọc từ khối `[u32 count][u32 playerId]`.
   *
   * Đọc ở ĐÂY chứ không ở tầng UI vì nó cần byte thô, mà `SaveDocument` trả về
   * cho main thread thì cố ý không giữ tham chiếu tới buffer vài chục MB.
   */
  squads: number[][];
  truncated: boolean;
  issues: string[];
}

export function readCareerPlayers(buffer: ArrayBuffer): CareerPlayers {
  const bytes = new Uint8Array(buffer);
  const issues: string[] = [];

  const table = locatePlayerTable(bytes);
  if (!table) {
    return {
      players: [],
      newgenNames: new Map(),
      table: null,
      squads: [],
      truncated: false,
      issues: [
        "Không định vị được bảng cầu thủ. File có thể thuộc phiên bản FC khác " +
        "hoặc không phải save Career Mode.",
      ],
    };
  }

  // Chất lượng khoá thấp nghĩa là dò trúng nhầm vùng: thà báo còn hơn hiển thị số vô nghĩa.
  if (table.keyQuality < 0.95) {
    issues.push(
      `Khoá cầu thủ chỉ đạt ${(table.keyQuality * 100).toFixed(1)}% duy nhất — ` +
      "số liệu bên dưới có thể không đáng tin.",
    );
  }

  const truncated = table.count > MAX_PLAYERS;
  if (truncated) {
    issues.push(`Bảng có ${table.count} bản ghi, chỉ đọc ${MAX_PLAYERS} bản ghi đầu.`);
  }

  const reader = new BitRecordReader(bytes, table.base, table.recordBytes, table.count);
  // Bỏ ô trống và ô dành sẵn nằm xen trong bảng: chúng giải mã ra số vô nghĩa.
  const players = decodeAllPlayers(reader, MAX_PLAYERS, (i) =>
    isValidRecordAt(bytes, table.base + i * table.recordBytes),
  );
  const newgenNames = readNewgenNames(bytes);

  const validIds = new Set<number>();
  for (const p of players) if (p.playerId > 0) validIds.add(p.playerId);
  const squads = findSquads(bytes, validIds).map((s) => s.playerIds);

  return {
    players,
    newgenNames,
    squads,
    table: { base: table.base, count: table.count, keyQuality: table.keyQuality },
    truncated,
    issues,
  };
}

export { locatePlayerTable } from "./locate";
export { readNewgenNames } from "./newgen-names";
export { decodePlayer, decodeAllPlayers } from "./players";
export type { RawPlayer } from "./players";
export type { NewgenName } from "./newgen-names";
export * from "./schema";

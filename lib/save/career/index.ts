/**
 * Cửa vào tầng career: từ byte thô ra danh sách cầu thủ.
 *
 * Không chạm DOM, không fetch. Tên cầu thủ thật đến từ DB nhúng và được ghép ở
 * tầng trên (`lib/fc26/world.ts`) — tầng này chỉ đọc những gì có trong file.
 */

import { BitRecordReader } from "../bitreader";
import { isValidRecordAt, locatePlayerTable } from "./locate";
import { readNewgenNames, type NewgenName } from "./newgen-names";
import { decodeAllPlayers, type RawPlayer } from "./players";
import { findFormationCoords } from "./formation";
import { findSquads } from "./squad";
import { findYouthTable } from "./youth-table";

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
  /**
   * Cầu thủ trong HỌC VIỆN của đội người chơi, đọc từ bảng riêng trong save.
   *
   * Rỗng khi không truyền `shippedIds`, hoặc khi career chưa có lứa nào —
   * cả hai đều là trạng thái hợp lệ, không phải lỗi.
   *
   * Khác hẳn với việc lọc "do career sinh ra + tuổi học viện": cách lọc đó
   * gom học viện của MỌI câu lạc bộ trong save. Đo trên một save thật: 45 so
   * với 25.
   */
  academyIds: number[];
  /**
   * 22 toạ độ sơ đồ của team sheet đang dùng, đọc thẳng từ save.
   *
   * Thứ tự ở đây KHÔNG phải thứ tự ô — `lib/fc26/formations.ts` đối chiếu bằng
   * tập giá trị rồi lấy toạ độ có thứ tự từ bảng. Xem `./formation.ts`.
   */
  formationCoords: number[] | null;
  truncated: boolean;
  issues: string[];
}


export function readCareerPlayers(
  buffer: ArrayBuffer,
  shippedIds?: Set<number>,
): CareerPlayers {
  const bytes = new Uint8Array(buffer);
  const issues: string[] = [];

  const table = locatePlayerTable(bytes);
  if (!table) {
    return {
      players: [],
      newgenNames: new Map(),
      table: null,
      squads: [],
      academyIds: [],
      formationCoords: null,
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

  /*
   * Bảng học viện chỉ định vị được khi biết ai do career sinh ra, mà điều đó
   * đến từ `shippedIds` ở tầng trên. Không có thì bỏ qua — mọi thứ khác vẫn
   * đọc bình thường, và giao diện rơi về cách suy luận cũ.
   */
  let academyIds: number[] = [];
  if (shippedIds) {
    /*
     * Chi loc theo "do career sinh ra", KHONG loc theo tuoi.
     *
     * Tuoi tinh tu `birthDay` cong mot moc tham chieu, va viec do nam o tang
     * adapter. Nhan ban no xuong day de duoc mot bo loc chat hon la doi mot
     * ban sao logic ngay — thu se lech im lang khi mot ben doi.
     *
     * Khong can thiet that: `findYouthTable` tu xac thuc bang chinh cau truc
     * (ban ghi 16 byte lien tiep, id phan biet, phan lon la nguoi da biet),
     * va cong kiem doi chieu tuoi o phia ngoai.
     */
    const careerBorn = new Set<number>();
    for (const p of players) {
      if (p.playerId > 0 && !shippedIds.has(p.playerId)) careerBorn.add(p.playerId);
    }
    academyIds = findYouthTable(bytes, careerBorn)?.playerIds ?? [];
  }

  return {
    players,
    newgenNames,
    squads,
    academyIds,
    formationCoords: findFormationCoords(bytes)?.coords ?? null,
    table: { base: table.base, count: table.count, keyQuality: table.keyQuality },
    truncated,
    issues,
  };
}

export { findFormationCoords } from "./formation";
export { locatePlayerTable } from "./locate";
export { readNewgenNames } from "./newgen-names";
export { decodePlayer, decodeAllPlayers } from "./players";
export type { RawPlayer } from "./players";
export type { NewgenName } from "./newgen-names";
export * from "./schema";

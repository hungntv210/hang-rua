/**
 * Tên cầu thủ FC27.
 *
 * Save chỉ lưu nameid; kho tên FC27 nằm trong bản cài game và đã đánh số lại so
 * với FC26. Hai nguồn, theo độ tin cậy:
 *
 *  - `exact`: playerId có trong roster FC26 VÀ ngày sinh trùng khít → tên FC26.
 *  - `bridge`: nameid FC27 → chữ, học từ chính các cầu thủ `exact` (cùng nameid
 *    FC27 ở cầu thủ khác thì cùng chữ). Hiển thị kèm "≈".
 *
 * Không ra gì thì `#playerId` — không đoán.
 */

import type { Fc26Names } from "../fc26/names";
import type { RawPlayer } from "./read-tables";

export interface Fc27Ref {
  builtAt: string;
  nations: Record<string, string>;
  /** Phẳng: [Δ playerId, birthDay, firstNameId, lastNameId, commonNameId, …]. */
  players: number[];
}

export type NameSource = "exact" | "newgen" | "bridge" | null;

interface RefPlayer {
  birthDay: number;
  fn: number;
  ln: number;
  cn: number;
}

export class Fc27Names {
  private constructor(
    private readonly exact: Map<number, string>,
    private readonly bridge: Map<number, string>,
    /** Tên thật đọc từ chữ trong save; thắng cầu nối nhưng thua tên FC26 trùng ngày sinh. */
    private readonly plain: Map<number, string> = new Map(),
  ) {}

  /** Thiếu asset (tải hỏng) vẫn dựng được: mọi tên thành `#id`, trang không kẹt. */
  static fromRef(
    ref: Fc27Ref | null, fc26: Fc26Names | null, players: RawPlayer[], plain: Map<number, string> = new Map(),
  ): Fc27Names {
    if (!ref || !fc26) return new Fc27Names(new Map(), new Map(), plain);
    const refMap = new Map<number, RefPlayer>();
    let id = 0;
    for (let i = 0; i + 4 < ref.players.length; i += 5) {
      id += ref.players[i];
      refMap.set(id, { birthDay: ref.players[i + 1], fn: ref.players[i + 2], ln: ref.players[i + 3], cn: ref.players[i + 4] });
    }

    // `resolve(x, x, null)` trả chữ của riêng nameid x — Fc26Names không có hàm tra lẻ.
    const word = (nameId: number): string | null => (nameId > 0 ? fc26.resolve(nameId, nameId, null) : null);

    const exact = new Map<number, string>();
    const bridge = new Map<number, string>();
    for (const p of players) {
      const r = refMap.get(p.id);
      if (!r || r.birthDay !== p.birthDay) continue;
      const full = fc26.resolve(r.fn, r.ln, r.cn || null);
      if (full) exact.set(p.id, full);
      const pairs: [number, number][] = [[p.firstNameId ?? 0, r.fn], [p.lastNameId ?? 0, r.ln]];
      for (const [id27, id26] of pairs) {
        const w = word(id26);
        if (id27 > 0 && w && !bridge.has(id27)) bridge.set(id27, w);
      }
      if ((p.commonNameId ?? 0) > 0 && r.cn > 0) {
        const c = fc26.resolve(null, null, r.cn);
        if (c && !bridge.has(p.commonNameId!)) bridge.set(p.commonNameId!, c);
      }
    }
    return new Fc27Names(exact, bridge, plain);
  }

  nameOf(p: RawPlayer): { name: string; source: NameSource } {
    const e = this.exact.get(p.id);
    if (e) return { name: e, source: "exact" };
    const t = this.plain.get(p.id);
    if (t) return { name: t, source: "newgen" };
    if ((p.commonNameId ?? 0) > 0) {
      const c = this.bridge.get(p.commonNameId!);
      if (c) return { name: c, source: "bridge" };
    }
    const f = this.bridge.get(p.firstNameId ?? 0);
    const l = this.bridge.get(p.lastNameId ?? 0);
    if (!f && !l) return { name: `#${p.id}`, source: null };
    const name = f && l ? (f === l ? f : `${f} ${l}`) : `${f ?? "?"} ${l ?? "?"}`;
    return { name, source: "bridge" };
  }
}

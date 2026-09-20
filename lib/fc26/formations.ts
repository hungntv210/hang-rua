/**
 * Hình học sơ đồ chiến thuật của FC 26.
 *
 * ─── CHỈ CÒN HÌNH HỌC, KHÔNG CÒN TEAM SHEET ─────────────────────────────────
 *
 * File này từng làm hai việc: giữ toạ độ các ô trên sân, VÀ giữ đội hình xuất
 * phát của 815 đội rồi đối chiếu với save để chọn ra một dòng phát lại. Việc
 * thứ hai đã bị bỏ.
 *
 * Lý do: bảng team sheet nướng sẵn là ảnh chụp một career tại một thời điểm.
 * Người dùng xếp lại đội hình thì trang vẫn hiện trạng thái cũ, và save từ
 * trước ngày chụp thì không khớp đội nào nên không hiện gì. Đo được trên ba
 * save của cùng một người: 0/11, 11/11, 11/11. Nó vi phạm đúng nguyên tắc mà
 * chính chú thích cũ của file này viện ra để tự cho phép mình.
 *
 * Toạ độ sơ đồ thì KHÁC: 871 hình dạng sân là hằng số theo phiên bản game,
 * không phải trạng thái career. Chúng ở lại.
 *
 * Đội hình giờ dựng từ chính save — xem `lib/fc26/lineup.ts`.
 */

import { shapeKey, type FormationShape } from "./lineup";

interface Payload {
  builtAt: string;
  formations: FormationShape[];
  /**
   * Bảng team sheet cũ. Không còn đọc tới.
   *
   * Vẫn khai báo ở đây để một `formations.json` cũ vẫn nạp được thay vì ném lỗi
   * — người dùng có thể đang mở trang với bản asset đã cache.
   */
  sheets?: unknown[];
}

export class Fc26Formations {
  readonly shapes: FormationShape[];
  readonly builtAt: string;
  private readonly byShape: Map<string, FormationShape>;

  private constructor(data: Payload) {
    this.shapes = (data.formations ?? []).filter(
      (f) => Array.isArray(f.pos) && f.pos.length === 11,
    );
    this.builtAt = data.builtAt ?? "";
    this.byShape = new Map(this.shapes.map((f) => [shapeKey(f.off.flat()), f]));
  }

  /**
   * Nhận ra sơ đồ từ 22 toạ độ đọc thẳng trong save.
   *
   * Trả `null` khi không khớp hình dạng nào — asset cũ hơn game, hoặc khối đọc
   * được không phải team sheet. Đó là lưới an toàn cuối của cả đường đi: bộ dò
   * trong `lib/save` chỉ kiểm dải giá trị, còn phép đối chiếu này mới là thứ
   * phân biệt được sơ đồ thật với 22 số bất kỳ.
   *
   * Toạ độ CÓ THỨ TỰ thì lấy từ bảng, không lấy từ save: thứ tự trong save
   * không phải thứ tự ô, nhưng mọi dòng cùng hình dạng đều có cùng toạ độ và
   * cùng mã vị trí, nên bảng trả lời được đầy đủ.
   */
  matchByCoords(coords: number[] | null | undefined): FormationShape | null {
    if (!coords || coords.length !== 22) return null;
    return this.byShape.get(shapeKey(coords)) ?? null;
  }

  static fromPayload(data: Payload): Fc26Formations {
    return new Fc26Formations(data);
  }
}

let pending: Promise<Fc26Formations | null> | null = null;

/**
 * Tải bảng sơ đồ. Hỏng thì trả `null` chứ không ném: mất sơ đồ làm trang nghèo
 * đi nhưng bảng cầu thủ vẫn đọc được đầy đủ từ save.
 */
export function loadFc26Formations(
  url = "/fc26/formations.json",
): Promise<Fc26Formations | null> {
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: Payload) => Fc26Formations.fromPayload(json))
      .catch(() => null);
  }
  return pending;
}

export type { FormationShape };
export type { Lineup, LineupSlot } from "./lineup";

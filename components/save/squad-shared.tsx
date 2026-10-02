"use client";

import { groupOf, type PositionGroup } from "@/lib/fc26/positions";
import type { SavePlayer } from "@/lib/save/types";

/**
 * Mảnh dùng chung giữa sơ đồ sân và bảng cầu thủ.
 *
 * Để chung một file vì chúng phải thống nhất tuyệt đối: một cầu thủ 84 điểm
 * phải ra đúng một màu ở cả hai chỗ. Tách ra hai file là cách chắc chắn để về
 * sau ngưỡng ở hai nơi lệch nhau mà không ai biết.
 *
 * Bảng vị trí thì KHÔNG ở đây mà ở `lib/fc26/positions.ts`: bộ dựng đội hình
 * cũng cần nó, và một bảng vị trí nằm trong component thì tầng `lib` không dùng
 * lại được.
 */

export {
  GROUP_LABEL,
  GROUP_ORDER,
  familyOf,
  groupOf,
  type PositionGroup,
} from "@/lib/fc26/positions";

// ────────────────────────────────────────────────────────────────────────────
// Thang màu chỉ số
// ────────────────────────────────────────────────────────────────────────────

/**
 * Ngưỡng theo thang của FC, không phải theo phân vị của đội.
 *
 * Phân vị nghe có vẻ thông minh hơn — nó tự co giãn theo chất lượng đội. Nhưng
 * nó phá đúng thứ khiến bảng này đọc được: một đội hạng dưới sẽ có cầu thủ 68
 * điểm hiện màu xanh lá, và người xem so hai đội với nhau thì thấy vô lý. Thang
 * tuyệt đối giữ được nghĩa khi so ngoài phạm vi một đội.
 */
const HIGH = 80;
const GOOD = 72;
const FAIR = 64;

export type StatTone = "high" | "good" | "fair" | "low";

export function toneOf(value: number | null): StatTone {
  if (value === null) return "low";
  if (value >= HIGH) return "high";
  if (value >= GOOD) return "good";
  if (value >= FAIR) return "fair";
  return "low";
}

const TONE_CLASS: Record<StatTone, string> = {
  high: "bg-win-wash text-win",
  good: "bg-royal-100 text-royal",
  fair: "bg-warn-wash text-warn",
  low: "bg-lose-wash text-lose",
};

/**
 * Ô chỉ số.
 *
 * `tabular-nums` không phải chi tiết làm đẹp: không có nó thì cột chỉ số nhảy
 * ngang khi chữ số đổi, và mắt mất chỗ neo khi dò xuống một danh sách dài.
 */
export function StatBadge({
  value,
  tone,
  title,
}: {
  value: number | null;
  tone?: StatTone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex min-w-[2.15rem] justify-center rounded-md border-2 border-ink px-1.5 py-0.5 text-[11px] font-bold tabular-nums leading-none ${
        TONE_CLASS[tone ?? toneOf(value)]
      }`}
    >
      {value ?? "—"}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Ảnh đại diện
// ────────────────────────────────────────────────────────────────────────────

/** Màu avatar theo tuyến; chữ sáng/tối chọn theo tương phản đo ở `check:design`. */
const POSITION_CLASS: Record<PositionGroup, string> = {
  GK: "bg-pos-gk text-ink",
  DF: "bg-pos-df text-ice",
  MF: "bg-pos-mf text-ink",
  FW: "bg-pos-fw text-ice",
};

/**
 * Avatar cầu thủ = huy hiệu tròn mang VỊ TRÍ, tô màu theo tuyến: thủ môn vàng,
 * hậu vệ xanh dương, tiền vệ xanh lá, tiền đạo đỏ.
 *
 * Trang không có ảnh mặt cầu thủ (save không chứa ảnh, kéo ảnh ngoài thì sai bản
 * quyền), nên vòng tròn dành cho thông tin đọc được ngay: đứng ở đâu. Trên sân là
 * vị trí của Ô; trong danh sách là vị trí sở trường. `null` = ô trống.
 */
export function PlayerAvatar({ position, size = 28 }: { position: string | null; size?: number }) {
  const tone = position ? POSITION_CLASS[groupOf(position)] : "bg-ink/10 text-ink-mute";
  const label = position ?? "—";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink font-display font-extrabold leading-none ${tone}`}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * (label.length >= 3 ? 0.3 : 0.38))) }}
      aria-hidden
    >
      {label}
    </span>
  );
}

/** Số áo cạnh tên — chỉ có khi người dùng nạp bản export career. */
export function JerseyTag({ jersey }: { jersey: number | null | undefined }) {
  if (!jersey || jersey <= 0) return null;
  return <span className="mr-1 font-display font-extrabold text-royal">#{jersey}</span>;
}

// ────────────────────────────────────────────────────────────────────────────
// Trình bày
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tên hiển thị gọn trên sân.
 *
 * Ô tên rộng đúng 96px và chữ in hoa đậm 11px, tức khoảng 12-14 ký tự. Đo trên
 * đội hình thật: ngưỡng cũ (viết tắt khi dài quá 14) vẫn để lọt 4/11 cái tên bị
 * cắt mất đuôi — "AYYOUB BOUADDI" cần 103px, "M. LEWIS-SKELLY" cần 102px.
 *
 * Nên rút gọn theo BA BẬC, mỗi bậc chỉ dùng khi bậc trước vẫn còn dài:
 *
 *   Yan Diomande          → YAN DIOMANDE      (vừa, giữ nguyên)
 *   Ayyoub Bouaddi        → A. BOUADDI        (viết tắt tên)
 *   Francesco Pio Esposito → F. P. ESPOSITO   (viết tắt mọi phần trước họ)
 *   Myles Lewis-Skelly    → LEWIS-SKELLY      (chỉ còn họ)
 *
 * Cắt bằng dấu ba chấm là lựa chọn cuối: "ROONY BARD…" không nói được người
 * nào, còn "R. BARDGHJI" thì nói được.
 */
const PITCH_NAME_MAX = 12;
const PITCH_NAME_HARD_MAX = 14;

export function shortName(name: string | null, fallback: string): string {
  if (!name) return fallback;
  const trimmed = name.trim();
  if (trimmed.length <= PITCH_NAME_MAX) return trimmed;

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return trimmed;

  const last = parts[parts.length - 1];
  const initials = `${parts
    .slice(0, -1)
    .map((p) => `${p[0]}.`)
    .join(" ")} ${last}`;
  return initials.length <= PITCH_NAME_HARD_MAX ? initials : last;
}

/**
 * Chỉ họ — bản dùng cho màn hình hẹp.
 *
 * Trên điện thoại sân chỉ rộng 343px, ô tên còn khoảng 78px, và đo được 8/11 tên
 * bị cắt đuôi kể cả sau khi đã viết tắt. Họ thì gần như luôn vừa, và trong một
 * sơ đồ 11 người thì họ đủ để nhận ra ai — bảng ngay dưới có tên đầy đủ.
 *
 * Đổi bằng CSS chứ không bằng đo bề rộng trong JS: đo bề rộng nghĩa là lần vẽ
 * đầu tiên luôn sai rồi mới sửa, và người dùng thấy cú nhảy đó.
 */
export function surnameOf(name: string | null, fallback: string): string {
  if (!name) return fallback;
  // Dấu "≈" (tên suy ra, chỉ FC27) phải sống sót qua việc rút gọn.
  const approx = name.startsWith("≈ ");
  const parts = (approx ? name.slice(2) : name).trim().split(/\s+/);
  return (approx ? "≈" : "") + parts[parts.length - 1];
}

/** Nhãn hợp đồng. Save chỉ cho biết NĂM, nên không bịa ra ngày. */
export const contractLabel = (year: number | null): string => (year === null ? "—" : `hè ${year}`);

export const displayName = (p: SavePlayer): string => p.name ?? `#${p.playerId}`;

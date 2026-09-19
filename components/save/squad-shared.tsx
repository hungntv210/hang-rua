"use client";

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
  high: "bg-jade-wash text-jade",
  good: "bg-electric-wash text-electric-bright",
  fair: "bg-amber-wash text-amber",
  low: "bg-crimson-wash text-crimson",
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
      className={`inline-flex min-w-[2.15rem] justify-center rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums leading-none ${
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

/**
 * Hai chữ cái đầu của tên. `null` khi không có tên — KHÔNG bịa ra chữ từ ID.
 */
export function initialsOf(name: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Ảnh đại diện cầu thủ.
 *
 * Trang KHÔNG có ảnh mặt cầu thủ và sẽ không có: save không chứa ảnh, còn kéo
 * ảnh từ nguồn ngoài thì vừa sai bản quyền vừa hỏng ngay khi nguồn đổi đường
 * dẫn. Nên đây là bóng người kèm chữ cái đầu tên.
 *
 * SỐ ÁO chỉ hiện khi người dùng nạp bản export career, vì nó không đọc được từ
 * save — nó thuộc về cặp (cầu thủ, đội) chứ không thuộc về cầu thủ, và dò trong
 * bản ghi 144 byte với 24 mẫu ở cổng 100% không ra trường nào. Không có export
 * thì hiện chữ cái đầu tên, chứ KHÔNG lấy số áo từ một bảng nướng sẵn: bảng đó
 * chỉ đúng với một career tại một thời điểm.
 *
 * Thủ môn đổi màu theo đúng quy ước của mọi sơ đồ đội hình.
 */
export function PlayerAvatar({
  initials,
  jersey = null,
  gk = false,
  size = 28,
}: {
  initials: string | null;
  /** Số áo nếu có bản export career. Ưu tiên hơn chữ cái đầu tên. */
  jersey?: number | null;
  gk?: boolean;
  size?: number;
}) {
  // Số áo thắng chữ cái đầu khi có: nó là thứ người chơi dùng để nhận ra cầu
  // thủ trong game, và nó ngắn hơn nên đọc được ở cỡ nhỏ hơn.
  const label = jersey && jersey > 0 ? String(jersey) : initials;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ${
        gk ? "bg-abyss-400 ring-ghost/30" : "bg-abyss-300 ring-grid-bright"
      }`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full opacity-25">
        <circle cx="12" cy="8.5" r="4" className="fill-mist" />
        <path d="M3.5 24c0-5 3.8-8.5 8.5-8.5s8.5 3.5 8.5 8.5z" className="fill-mist" />
      </svg>
      {label ? (
        <span
          className={`relative font-mono font-bold leading-none tracking-tight ${
            gk ? "text-ghost" : "text-white"
          }`}
          style={{ fontSize: Math.max(8, Math.round(size * (jersey ? 0.42 : 0.36))) }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
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
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

/** Nhãn hợp đồng. Save chỉ cho biết NĂM, nên không bịa ra ngày. */
export const contractLabel = (year: number | null): string => (year === null ? "—" : `hè ${year}`);

export const displayName = (p: SavePlayer): string => p.name ?? `#${p.playerId}`;

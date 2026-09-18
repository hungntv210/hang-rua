"use client";

import type { SavePlayer } from "@/lib/save/types";

/**
 * Mảnh dùng chung giữa sơ đồ sân và bảng cầu thủ.
 *
 * Để chung một file vì chúng phải thống nhất tuyệt đối: một cầu thủ 84 điểm
 * phải ra đúng một màu ở cả hai chỗ. Tách ra hai file là cách chắc chắn để về
 * sau ngưỡng ở hai nơi lệch nhau mà không ai biết.
 */

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
 * Ảnh đại diện cầu thủ.
 *
 * Trang KHÔNG có ảnh mặt cầu thủ và sẽ không có: save không chứa ảnh, còn kéo
 * ảnh từ nguồn ngoài thì vừa sai bản quyền vừa hỏng ngay khi nguồn đổi đường
 * dẫn. Nên đây là bóng người kèm số áo — cùng thứ mà chính ảnh mẫu hiển thị cho
 * phần lớn cầu thủ, và số áo còn nói được nhiều hơn một khuôn mặt chung chung.
 *
 * Thủ môn đổi màu theo đúng quy ước của mọi sơ đồ đội hình.
 */
export function PlayerAvatar({
  jersey,
  gk = false,
  size = 28,
}: {
  jersey: number | null;
  gk?: boolean;
  size?: number;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ${
        gk ? "bg-abyss-400 ring-ghost/30" : "bg-abyss-300 ring-grid-bright"
      }`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full opacity-30">
        <circle cx="12" cy="8.5" r="4" className="fill-mist" />
        <path d="M3.5 24c0-5 3.8-8.5 8.5-8.5s8.5 3.5 8.5 8.5z" className="fill-mist" />
      </svg>
      {jersey && jersey > 0 ? (
        <span
          className={`relative font-mono font-bold leading-none ${gk ? "text-ghost" : "text-white"}`}
          style={{ fontSize: Math.max(9, Math.round(size * 0.4)) }}
        >
          {jersey}
        </span>
      ) : null}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Nhóm vị trí
// ────────────────────────────────────────────────────────────────────────────

export type PositionGroup = "GK" | "DF" | "MF" | "FW";

const GROUP_OF: Record<string, PositionGroup> = {
  GK: "GK",
  SW: "DF", RB: "DF", RWB: "DF", CB: "DF", RCB: "DF", LCB: "DF", LB: "DF", LWB: "DF",
  CDM: "MF", RDM: "MF", LDM: "MF", CM: "MF", RCM: "MF", LCM: "MF",
  RM: "MF", LM: "MF", CAM: "MF", RAM: "MF", LAM: "MF",
  RW: "FW", LW: "FW", RF: "FW", CF: "FW", LF: "FW", ST: "FW", RS: "FW", LS: "FW",
};

/** Vị trí lạ rơi vào tiền vệ — nhóm rộng nhất, sai ở đó ít gây hiểu nhầm nhất. */
export const groupOf = (position: string): PositionGroup => GROUP_OF[position] ?? "MF";

export const GROUP_LABEL: Record<PositionGroup, { vi: string; en: string }> = {
  GK: { vi: "Thủ môn", en: "Goalkeepers" },
  DF: { vi: "Hậu vệ", en: "Defenders" },
  MF: { vi: "Tiền vệ", en: "Midfielders" },
  FW: { vi: "Tiền đạo", en: "Attackers" },
};

export const GROUP_ORDER: PositionGroup[] = ["GK", "DF", "MF", "FW"];

/**
 * Cầu thủ dự bị nào thay được cho một ô trên sân.
 *
 * Bảng này nói về VỊ TRÍ SỞ TRƯỜNG đọc từ save, không phải về ô trên sơ đồ: một
 * ô `RCB` cần người sở trường CB, không cần người có đúng chữ "RCB".
 */
const SLOT_FAMILY: Record<string, string[]> = {
  GK: ["GK"],
  SW: ["CB", "SW", "RCB", "LCB"],
  RWB: ["RB", "RWB"], RB: ["RB", "RWB"],
  RCB: ["CB", "RCB", "LCB", "SW"], CB: ["CB", "RCB", "LCB", "SW"], LCB: ["CB", "RCB", "LCB", "SW"],
  LB: ["LB", "LWB"], LWB: ["LB", "LWB"],
  RDM: ["CDM", "RDM", "LDM", "CM"], CDM: ["CDM", "RDM", "LDM", "CM"], LDM: ["CDM", "RDM", "LDM", "CM"],
  RM: ["RM", "RW"], LM: ["LM", "LW"],
  RCM: ["CM", "RCM", "LCM", "CDM", "CAM"], CM: ["CM", "RCM", "LCM", "CDM", "CAM"],
  LCM: ["CM", "RCM", "LCM", "CDM", "CAM"],
  RAM: ["CAM", "RAM", "LAM"], CAM: ["CAM", "RAM", "LAM", "CM"], LAM: ["CAM", "RAM", "LAM"],
  RF: ["RF", "RW", "ST"], CF: ["CF", "ST"], LF: ["LF", "LW", "ST"],
  RW: ["RW", "RM", "RF"], LW: ["LW", "LM", "LF"],
  RS: ["ST", "CF", "RS", "LS"], ST: ["ST", "CF", "RS", "LS"], LS: ["ST", "CF", "RS", "LS"],
};

export const familyOf = (slotPosition: string): string[] =>
  SLOT_FAMILY[slotPosition] ?? [slotPosition];

// ────────────────────────────────────────────────────────────────────────────
// Trình bày
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tên hiển thị gọn trên sân.
 *
 * Ô tên rộng đúng 88px và chữ in hoa đậm 11px, tức khoảng 12-14 ký tự. Đo trên
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

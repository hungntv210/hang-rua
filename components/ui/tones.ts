/**
 * Bảng tông dùng chung cho Badge/Sticker/Card. Chuỗi lớp viết đầy đủ (không ghép
 * động) để Tailwind quét được. Cặp chữ/nền đều đã đo ở `npm run check:design`.
 */
export type Tone =
  | "navy"
  | "royal"
  | "aqua"
  | "sky"
  | "salmon"
  | "win"
  | "warn"
  | "lose";

export const TONE_CLASS: Record<Tone, string> = {
  navy: "bg-navy text-ice",
  royal: "bg-royal text-ice",
  aqua: "bg-aqua text-ink",
  sky: "bg-sky text-ink",
  salmon: "bg-salmon text-ink",
  win: "bg-win-wash text-win",
  warn: "bg-warn-wash text-warn",
  lose: "bg-lose-wash text-lose",
};

/** Đầu thẻ pastel: bản nhạt của bốn màu chủ đạo. */
export type CardTone = "sky" | "aqua" | "royal" | "salmon";

export const CARD_TOP_CLASS: Record<CardTone, string> = {
  sky: "bg-sky-100",
  aqua: "bg-aqua-100",
  royal: "bg-royal-100",
  salmon: "bg-salmon-100",
};

import { TONE_CLASS, type Tone } from "./tones";

export type Tilt = -3 | -2 | -1 | 1 | 2 | 3;

const TILT_CLASS: Record<Tilt, string> = {
  [-3]: "-rotate-3",
  [-2]: "-rotate-2",
  [-1]: "-rotate-1",
  1: "rotate-1",
  2: "rotate-2",
  3: "rotate-3",
};

/** Nhãn dán xoay nghiêng (NEW, SẮP CÓ…). Xoay có chủ đích 1–3°, không hơn. */
export function Sticker({
  tone = "salmon",
  tilt = 2,
  children,
}: {
  tone?: Tone;
  tilt?: Tilt;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-md border-2 border-ink px-2 py-0.5 font-display text-xs font-extrabold uppercase tracking-wide shadow-pop-sm ${TILT_CLASS[tilt]} ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

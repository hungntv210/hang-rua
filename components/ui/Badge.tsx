import { TONE_CLASS, type Tone } from "./tones";

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-2 border-ink px-2.5 py-0.5 font-display text-xs font-extrabold leading-5 ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

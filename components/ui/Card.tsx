import Link from "next/link";

import { CARD_TOP_CLASS, type CardTone } from "./tones";

interface CardProps {
  tone: CardTone;
  title: string;
  href?: string;
  size?: "sm" | "lg";
  children?: React.ReactNode;
  /** Nhãn đặt góc trên phải của đầu thẻ (vd. Sticker NEW). */
  corner?: React.ReactNode;
}

/**
 * Thẻ hai tầng: đầu pastel đơn sắc có chấm bi + tiêu đề đậm, thân trắng. Có
 * `href` thì cả thẻ là một link và có phản hồi nhấn như nút.
 */
export function Card({ tone, title, href, size = "sm", children, corner }: CardProps) {
  const base =
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-pop";
  const body = (
    <>
      <div
        className={`pop-halftone relative flex items-end p-4 ${children ? "" : "flex-1"} ${CARD_TOP_CLASS[tone]} ${
          size === "lg" ? "min-h-[9rem]" : "min-h-[6rem]"
        }`}
      >
        <h3 data-audit-label className="font-display text-xl font-extrabold leading-tight text-ink sm:text-2xl">
          {title}
        </h3>
        {corner ? <span className="absolute right-3 top-3">{corner}</span> : null}
      </div>
      {children ? (
        <div className="flex-1 border-t-2 border-ink p-4 text-sm leading-relaxed text-ink-soft">
          {children}
        </div>
      ) : null}
    </>
  );

  if (!href) return <div data-audit-box className={base}>{body}</div>;
  return (
    <Link
      data-audit-box
      href={href}
      className={`${base} focus-ring transition-transform duration-150 hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-pop-press`}
    >
      {body}
    </Link>
  );
}

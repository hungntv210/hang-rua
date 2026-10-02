"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { buttonClass } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import { stepIndex } from "@/lib/slider";

export interface HeroSlide {
  id: string;
  kicker: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  tone: "navy" | "royal" | "aqua";
  /** Hình minh hoạ bên phải: viên capsule, quả bóng, hoặc mascot. */
  art: "capsule" | "ball" | "mascot";
}

const TONE_CLASS: Record<HeroSlide["tone"], string> = {
  navy: "bg-navy text-ice",
  royal: "bg-royal text-ice",
  aqua: "bg-aqua text-ink",
};

const AUTOPLAY_MS = 6000;

/** Viên capsule gacha: nửa trên salmon, nửa dưới trắng, vạch ghép đen. */
function Capsule() {
  return (
    <span aria-hidden className="relative block h-28 w-28 rotate-12 sm:h-52 sm:w-52">
      <span className="absolute inset-0 overflow-hidden rounded-full border-4 border-ink shadow-pop">
        <span className="pop-halftone absolute inset-x-0 top-0 h-1/2 bg-salmon" />
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-white" />
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-ink" />
      </span>
      <span className="absolute left-[22%] top-[18%] h-5 w-8 -rotate-12 rounded-full bg-white/80" />
    </span>
  );
}

/** Quả bóng vẽ tay: tròn trắng, ngũ giác đen ở giữa, năm nét toả ra. */
function Ball() {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="h-28 w-28 -rotate-6 drop-shadow-[4px_4px_0_#0A1428] sm:h-52 sm:w-52">
      <circle cx="50" cy="50" r="46" fill="#fff" stroke="#0A1428" strokeWidth="4" />
      <polygon points="50,33 66,45 60,64 40,64 34,45" fill="#0A1428" />
      <g stroke="#0A1428" strokeWidth="4" strokeLinecap="round">
        <path d="M50 33 L50 8" />
        <path d="M66 45 L89 37" />
        <path d="M60 64 L74 85" />
        <path d="M40 64 L26 85" />
        <path d="M34 45 L11 37" />
      </g>
    </svg>
  );
}

function Mascot() {
  return (
    <span className="block h-28 w-28 rotate-3 overflow-hidden rounded-full border-4 border-ink bg-sky shadow-pop sm:h-52 sm:w-52">
      <Image src="/brand/kame-mascot.webp" alt="Kame, linh vật rùa của Hang Rùa" width={416} height={416} sizes="208px" className="h-full w-full object-cover" />
    </span>
  );
}

const ART = { capsule: Capsule, ball: Ball, mascot: Mascot } as const;

/**
 * Banner trang chủ: track CSS scroll-snap (vuốt được trên điện thoại mà không
 * cần thư viện), chấm điều hướng, tự chạy 6 giây.
 *
 * Tự chạy DỪNG khi: rê chuột hoặc focus vào banner, người dùng bấm Tạm dừng,
 * hoặc máy bật giảm chuyển động. Điều kiện cuối đọc `matchMedia` trong effect
 * (chỉ đổi state, không đổi cây DOM) để server và client render giống nhau.
 */
export function HeroSlider({ slides }: { slides: readonly HeroSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track) return;
      // Đặt chỉ số ngay, không chờ sự kiện `scroll`: sự kiện đó gắn với khung
      // hình, và đo được là không tới khi trang không được vẽ — chấm điều
      // hướng khi ấy kẹt ở slide cũ dù track đã cuộn.
      setIndex(i);
      track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
    },
    [reduce],
  );

  // Chỉ số lấy từ vị trí cuộn thật, nên vuốt tay cũng cập nhật chấm.
  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const running = !hovered && !focused && !paused && !reduce && slides.length > 1;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => goTo(stepIndex(index, slides.length, 1)), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [running, index, slides.length, goTo]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") goTo(stepIndex(index, slides.length, 1));
    else if (e.key === "ArrowLeft") goTo(stepIndex(index, slides.length, -1));
    else return;
    e.preventDefault();
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Nổi bật trong hang"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={onKeyDown}
      className="relative"
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl border-4 border-ink shadow-pop [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => {
          const Art = ART[slide.art];
          return (
            <article
              key={slide.id}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}`}
              aria-hidden={i !== index}
              className={`pop-halftone relative grid w-full shrink-0 snap-start grid-cols-1 items-center gap-6 px-6 py-8 sm:grid-cols-[1fr_auto] sm:px-12 sm:py-12 ${TONE_CLASS[slide.tone]}`}
            >
              <div className="max-w-xl">
                <Sticker tone="salmon" tilt={-2}>
                  {slide.kicker}
                </Sticker>
                <h2 className="mt-4 font-display text-3xl font-extrabold leading-[1.1] sm:text-5xl" data-audit-label>
                  {slide.title}
                </h2>
                <p className="mt-3 max-w-md text-base leading-relaxed sm:text-lg">{slide.body}</p>
                <Link href={slide.href} tabIndex={i === index ? 0 : -1} className={`mt-6 ${buttonClass("salmon")}`}>
                  {slide.cta}
                </Link>
              </div>
              <div className="flex justify-center sm:justify-end">
                <Art />
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Slide ${i + 1}: ${slide.title}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => goTo(i)}
              className={`focus-ring h-4 w-4 rounded-full border-2 border-ink transition-transform duration-200 ${
                i === index ? "scale-125 bg-royal" : "bg-white hover:bg-sky"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
          className="focus-ring rounded-full border-2 border-ink bg-white px-3 py-1 font-display text-xs font-extrabold text-ink shadow-pop-sm"
        >
          {paused ? "Chạy tiếp" : "Tạm dừng"}
        </button>
      </div>
    </section>
  );
}

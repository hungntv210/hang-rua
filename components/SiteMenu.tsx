"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NAV_ITEMS, isActive, type NavTone } from "@/lib/nav";

/**
 * Màu chữ và viền focus theo từng khối. Chữ sáng chỉ trên navy/royal (7.28 và
 * 5.44), chữ tối trên aqua/sky/salmon (8.87, 11.50, 8.13) — số đo từ
 * `npm run check:design`, không phải cảm giác. Viền focus đổi theo để luôn tách
 * khỏi nền khối.
 */
const TONE_CLASS: Record<NavTone, string> = {
  navy: "bg-navy text-ice outline-ice",
  royal: "bg-royal text-ice outline-ice",
  aqua: "bg-aqua text-ink outline-ink",
  sky: "bg-sky text-ink outline-ink",
  salmon: "bg-salmon text-ink outline-ink",
};

/** Dải đen ở chân khối: hover = mỏng, đang ở trang này = dày. */
const BLOCK_BASE =
  "relative flex h-14 items-center justify-center gap-2 px-3 text-center font-display text-base font-extrabold leading-tight outline-offset-[-6px] focus-visible:outline focus-visible:outline-4 transition-shadow duration-150 hover:shadow-[inset_0_-4px_0_#0A1428]";
const BLOCK_ACTIVE = "shadow-[inset_0_-8px_0_#0A1428]";

function LogoMark() {
  return (
    <span className="inline-block h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-sky">
      <Image src="/brand/logo.webp" alt="" width={64} height={64} priority className="h-full w-full object-cover" />
    </span>
  );
}

export function SiteMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Đóng bảng menu khi đổi trang: nếu không nó che mất nội dung vừa mở.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Khoá cuộn nền và nghe Esc chỉ khi bảng đang mở.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b-4 border-ink bg-ice">
      {/* Desktop: 5 khối ngang bằng nhau, ngăn nhau bằng vạch đen. */}
      <nav aria-label="Điều hướng chính" className="hidden md:block">
        <ul className="grid grid-cols-5 divide-x-4 divide-ink">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${BLOCK_BASE} ${TONE_CLASS[item.tone]} ${active ? BLOCK_ACTIVE : ""}`}
                >
                  {item.id === "home" ? <LogoMark /> : null}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile: logo + nút Menu; bảng 5 khối xếp dọc mở bên dưới. */}
      <div className="flex h-14 items-stretch md:hidden">
        <Link href="/" className="focus-ring flex flex-1 items-center gap-2 px-4">
          <LogoMark />
          <span className="font-display text-xl font-extrabold text-ink">Hang Rùa</span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="site-menu-panel"
          onClick={() => setOpen((v) => !v)}
          className={`${BLOCK_BASE} w-28 border-l-4 border-ink ${TONE_CLASS.salmon}`}
        >
          {open ? "Đóng" : "Menu"}
        </button>
      </div>

      {open ? (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-14 cursor-default bg-ink/60"
          />
          <nav
            id="site-menu-panel"
            aria-label="Điều hướng chính"
            className="animate-pop-in absolute inset-x-0 top-full border-b-4 border-ink"
          >
            <ul className="divide-y-4 divide-ink">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`${BLOCK_BASE} ${TONE_CLASS[item.tone]} ${active ? BLOCK_ACTIVE : ""}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

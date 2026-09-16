"use client";

import { m, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Điều hướng trong module Football. Mọi đường dẫn đều có tiền tố /football. */
const LINKS = [
  { href: "/football", label: "Lịch thi đấu", jp: "日程" },
  { href: "/football/standings", label: "Bảng xếp hạng", jp: "順位" },
  { href: "/football/bracket", label: "Sơ đồ cúp", jp: "杯" },
];

export function FootballNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav className="flex gap-2 overflow-x-auto">
      {LINKS.map((link) => {
        // "/football" là trang lịch thi đấu, đồng thời là gốc của module — phải
        // so khớp chính xác, nếu không nó sẽ sáng cả khi đang ở
        // /football/standings.
        const active =
          link.href === "/football"
            ? pathname === "/football" || pathname.startsWith("/football/league")
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`tab relative ${active ? "tab-active" : ""}`}
          >
            {/* Thanh nav này nằm trong layout của module nên KHÔNG bị unmount
                khi đổi route con — nhờ vậy `layoutId` trượt được giữa các mục,
                điều mà chuyển route ở cấp cao hơn không làm được. */}
            {/* Luôn render, chỉ đổi thời lượng — đổi cây DOM theo
                `useReducedMotion()` gây hydration mismatch, vì server luôn
                thấy `false`. */}
            {active ? (
              <m.span
                layoutId="football-nav-indicator"
                className="absolute inset-0 -z-10 rounded-sm bg-electric-wash"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            ) : null}
            <span className="relative">{link.label}</span>
            <span className="brand-jp relative ml-2 text-[9px] text-mist-dim">
              {link.jp}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

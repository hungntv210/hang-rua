import Link from "next/link";

import type { Competition } from "@/lib/config";

interface Props {
  competitions: Competition[];
  /** slug đang được chọn; bỏ trống khi đang ở tab đặc biệt (ví dụ Arsenal). */
  activeSlug?: string;
  /** Tiền tố đường dẫn, ví dụ "/football/standings". */
  basePath: string;
  /** Tab đầu tiên tuỳ chọn, ví dụ tab Arsenal trên trang lịch thi đấu. */
  leadingTab?: { href: string; label: string; active: boolean };
}

export function CompetitionTabs({
  competitions,
  activeSlug,
  basePath,
  leadingTab,
}: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {leadingTab ? (
        <Link
          href={leadingTab.href}
          aria-current={leadingTab.active ? "page" : undefined}
          className={`tab ${leadingTab.active ? "tab-active" : ""}`}
        >
          {leadingTab.label}
        </Link>
      ) : null}

      {competitions.map((competition) => {
        const active = competition.slug === activeSlug;
        return (
          <Link
            key={competition.slug}
            href={`${basePath}/${competition.slug}`}
            aria-current={active ? "page" : undefined}
            className={`tab ${active ? "tab-active" : ""}`}
          >
            {competition.name}
          </Link>
        );
      })}
    </div>
  );
}

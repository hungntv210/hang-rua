import Link from "next/link";

import { ModuleIcon } from "@/components/ModuleIcon";
import type { AppModule } from "@/lib/modules";

/**
 * Thẻ mục trên dashboard. Ô chưa phát triển dùng viền nét đứt cùng ngôn ngữ với
 * đốt vảy rỗng của vòng đấu chưa diễn ra — cả hai đều mang nghĩa "chỗ này còn
 * trống", nên dùng chung một quy ước hình.
 */
export function ModuleCard({ module: mod }: { module: AppModule }) {
  if (mod.status === "soon" || !mod.href) {
    return (
      <div
        aria-disabled
        className="flex min-h-[10.5rem] flex-col justify-between rounded-sm border border-dashed border-grid p-5 text-mist-dim"
      >
        <ModuleIcon icon={mod.icon} className="h-7 w-7" />
        <div>
          <p className="font-display text-xl font-semibold tracking-tight">
            {mod.name}
          </p>
          <p className="mt-1 text-sm leading-snug">{mod.description}</p>
        </div>
        <span className="sr-only">Chưa phát triển</span>
      </div>
    );
  }

  return (
    <Link
      href={mod.href}
      className="focus-ring plate plate-interactive neon-edge group relative flex min-h-[10.5rem] flex-col justify-between overflow-hidden p-5"
    >
      {/* Vệt sáng chạy dọc cạnh trên khi rê chuột — cùng ngôn ngữ với vệt quét
          lúc chuyển trang, nên thẻ báo "bấm vào đây là đi tiếp". */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px -translate-x-full bg-gradient-to-r from-transparent via-electric-bright to-transparent transition-transform duration-500 group-hover:translate-x-full"
      />

      <span className="flex items-start justify-between">
        <span className="text-electric">
          <ModuleIcon icon={mod.icon} className="h-7 w-7" />
        </span>
        <span className="rounded-sm border border-sakura/30 bg-sakura-wash px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-sakura">
          Đang chạy
        </span>
      </span>

      <span>
        <span className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-ghost">
            {mod.name}
          </span>
          {mod.nameJp ? (
            <span className="brand-jp text-[10px] text-electric/70">
              {mod.nameJp}
            </span>
          ) : null}
        </span>
        <span className="mt-1.5 block text-sm leading-snug text-mist">
          {mod.description}
        </span>
        <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.1em] text-electric-bright">
          Vào mục
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden
          >
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </Link>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { ModuleIcon } from "@/components/ModuleIcon";
import { MODULES } from "@/lib/modules";

/**
 * public/brand/logo.webp là ảnh vuông nền đen (không có kênh alpha). Bọc trong
 * khung tròn overflow-hidden để CSS cắt bỏ 4 góc đen, chỉ để lại huy hiệu tròn
 * bên trong — không cần sửa file gốc.
 *
 * File chỉ 128px vì nơi dùng lớn nhất là 36px. Bản PNG 1254px trước đây nặng
 * 1 MB cho một huy hiệu bé xíu; xem `scripts/optimize-brand-images.ts`.
 */
function LogoMark({ size }: { size: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-electric/40"
    >
      <Image
        src="/brand/logo.webp"
        alt=""
        width={size}
        height={size}
        priority
        className="h-full w-full object-cover"
      />
    </span>
  );
}

function BrandMark({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="focus-ring flex items-center gap-3 rounded px-2 py-2"
    >
      <LogoMark size={36} />
      <span className="min-w-0">
        <span className="block font-display text-xl font-semibold leading-none tracking-tight text-ghost">
          Hang Rùa
        </span>
        <span className="brand-jp mt-1.5 block text-[10px] leading-none text-electric/80">
          カメの巣穴
        </span>
      </span>
    </Link>
  );
}

function ModuleLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {MODULES.map((mod) => {
        if (mod.status === "soon" || !mod.href) {
          return (
            <div
              key={mod.id}
              aria-disabled
              title="Mục này chưa được phát triển"
              className="flex cursor-not-allowed items-center gap-3 rounded-sm border border-dashed border-grid px-3 py-2.5 text-sm text-mist-dim"
            >
              <ModuleIcon icon={mod.icon} />
              <span>{mod.name}</span>
            </div>
          );
        }

        const active = pathname.startsWith(mod.href);
        return (
          <Link
            key={mod.id}
            href={mod.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`focus-ring group relative flex items-center gap-3 overflow-hidden rounded-sm border px-3 py-2.5 text-sm transition-all duration-200 ${
              active
                ? "border-electric/60 bg-electric-wash font-semibold text-ghost"
                : "border-transparent text-mist hover:border-grid hover:bg-abyss-200 hover:text-ghost"
            }`}
          >
            {/* Vạch sáng bên trái đánh dấu kênh đang chọn — cùng ngôn ngữ với
                đèn báo trên bảng điều khiển, đọc được ngay cả khi liếc nhanh. */}
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 w-0.5 transition-all duration-200 ${
                active ? "bg-electric-bright" : "bg-transparent group-hover:bg-electric/40"
              }`}
            />
            <ModuleIcon icon={mod.icon} />
            <span>{mod.name}</span>
            {mod.nameJp ? (
              <span className="brand-jp ml-auto text-[9px] text-mist-dim">
                {mod.nameJp}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <BrandMark onNavigate={onNavigate} />

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3">
          <p className="eyebrow">Các mục</p>
          <span aria-hidden className="rule-ticks flex-1" />
        </div>
        <ModuleLinks onNavigate={onNavigate} />
      </div>

      <p className="mt-auto px-3 font-mono text-[10px] leading-relaxed text-mist-dim">
        football-data.org · mùa hiện tại
      </p>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Đóng drawer khi đổi trang: nếu không, bấm một mục xong drawer vẫn che mất
  // nội dung vừa mở.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Khoá cuộn nền khi drawer đang mở, tránh cuộn xuyên qua lớp phủ.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Thanh trên cùng chỉ hiện ở mobile — chứa nút mở drawer.
          Chiều cao cố định h-16 phải khớp biến --topbar-h trong globals.css:
          thanh điều hướng của module dính ngay bên dưới thanh này. */}
      <div className="glass sticky top-0 z-40 flex h-16 items-center gap-3 border-x-0 border-t-0 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mở menu"
          aria-expanded={open}
          className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-sm border border-grid text-mist transition-colors hover:border-electric/50 hover:bg-abyss-200 hover:text-ghost"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-sm">
          <LogoMark size={26} />
          <span className="font-display text-lg font-semibold tracking-tight text-ghost">
            Hang Rùa
          </span>
        </Link>
      </div>

      {/* Sidebar cố định trên desktop. */}
      <aside className="glass-strong fixed inset-y-0 left-0 z-30 hidden w-64 border-y-0 border-l-0 border-r lg:block">
        <SidebarBody />
      </aside>

      {/* Drawer mobile. */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-void/80 backdrop-blur-sm"
          />
          <div className="animate-slide-in-left glass-strong absolute inset-y-0 left-0 w-72 border-y-0 border-l-0 border-r shadow-panel-lift">
            <SidebarBody onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { MODULES } from "@/lib/modules";

/**
 * Khung HUD bám viewport — chi tiết ký danh của bộ nhận diện.
 *
 * Lấy nguyên từ `public/brand/tokyo-night.webp`: ngoặc góc mảnh, nhãn tiếng Nhật
 * xếp dọc ở lề phải, dải mã vạch ở góc dưới. Trong banner chúng là trang trí của
 * một tấm poster; ở đây chúng phải mang nghĩa, nếu không thì chỉ là dán hình.
 *
 * Nên: nhãn dọc đọc ra module đang mở, còn dải mã vạch là **tổng kiểm của đường
 * dẫn hiện tại** — cùng một trang luôn cho cùng một vạch, trang khác thì khác.
 * Đó là thông tin thật về vị trí, không phải hoạ tiết ngẫu nhiên.
 *
 * Toàn bộ khung `pointer-events-none` và `aria-hidden`: nó là lớp trang trí phủ
 * lên trên, tuyệt đối không được chặn thao tác hay lọt vào trình đọc màn hình.
 */

/** Chuỗi → dãy chiều cao vạch. Cùng chuỗi luôn cho cùng dãy. */
function barsFor(path: string): number[] {
  const bars: number[] = [];
  let hash = 0x811c9dc5;
  for (let i = 0; i < path.length; i += 1) {
    hash ^= path.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
    bars.push(4 + ((hash >>> (i % 16)) % 12));
  }
  // Luôn đủ 22 vạch để dải không co giãn theo độ dài đường dẫn.
  while (bars.length < 22) bars.push(4 + ((hash >>> bars.length) % 12));
  return bars.slice(0, 22);
}

export function HudFrame() {
  const pathname = usePathname();

  const label = useMemo(() => {
    const mod = MODULES.find((m) => m.href && pathname.startsWith(m.href));
    return mod?.nameJp ?? "カメの巣穴";
  }, [pathname]);

  const bars = useMemo(() => barsFor(pathname), [pathname]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-20 hidden lg:block">
      {/* Bốn ngoặc góc, tự vẽ khi vào trang. Lệch pha nhau để mắt đọc được
          thứ tự vẽ thay vì thấy cả bốn bật cùng lúc. */}
      <span className="hud-corner animate-draw-corner left-3 top-3 border-l border-t" />
      <span
        className="hud-corner animate-draw-corner right-3 top-3 border-r border-t"
        style={{ animationDelay: "80ms" }}
      />
      <span
        className="hud-corner animate-draw-corner bottom-3 left-3 border-b border-l"
        style={{ animationDelay: "160ms" }}
      />
      <span
        className="hud-corner animate-draw-corner bottom-3 right-3 border-b border-r"
        style={{ animationDelay: "240ms" }}
      />

      {/* Lề phải: nhãn tiếng Nhật của module đang mở. */}
      <div className="absolute right-5 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
        <span className="h-10 w-px bg-gradient-to-b from-transparent to-electric/40" />
        <span className="brand-jp-vertical text-[11px] text-electric/70">{label}</span>
        <span className="h-10 w-px bg-gradient-to-t from-transparent to-electric/40" />
      </div>

      {/* Góc dưới phải: tổng kiểm của đường dẫn hiện tại. */}
      <div className="absolute bottom-6 right-8 flex items-end gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}px` }}
            className={`w-[2px] ${i % 4 === 0 ? "bg-electric/60" : "bg-electric/25"}`}
          />
        ))}
      </div>
    </div>
  );
}

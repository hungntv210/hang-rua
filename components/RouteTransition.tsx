"use client";

import { usePathname } from "next/navigation";

/**
 * Chuyển cảnh giữa các trang: nội dung mới nảy lên nhẹ (dịch 8px + phóng
 * 0.99→1, easing có overshoot, 240ms). Chỉ `transform`/`opacity`.
 *
 * Đổi `key` theo đường dẫn là đủ để React dựng lại nút và chạy lại animation
 * CSS — không cần thư viện. `children` truyền vào dưới dạng prop nên vẫn là
 * server component.
 *
 * Fill-mode là `backwards` chứ không phải `both`: animation xong thì KHÔNG giữ
 * lại `transform`, vì một `transform` còn sót tạo ra stacking context cho cả
 * trang và có thể làm hỏng phần tử `fixed`/`sticky` bên trong. Người bật giảm
 * chuyển động nhận thời lượng ~0 từ quy tắc toàn cục trong globals.css.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-pop-in">
      {children}
    </div>
  );
}

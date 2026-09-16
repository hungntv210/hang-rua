"use client";

import { usePathname } from "next/navigation";

/**
 * Chuyển cảnh giữa các trang: một vệt quét chạy dọc màn hình, nội dung mới nổi
 * lên theo sau.
 *
 * Hình ảnh lấy từ chính banner — những vệt scanline cắt ngang mặt trăng. Ở đây
 * nó còn đúng về nghĩa: trang này đọc file nhị phân và quét bảng số liệu, nên
 * chuyển cảnh kiểu "quét" nói đúng việc trang đang làm.
 *
 * KHÔNG dùng thư viện animation. Đổi `key` theo đường dẫn là đủ để React dựng
 * lại nút và chạy lại animation CSS — thêm framer-motion cho một hiệu ứng là
 * đánh đổi sai, dự án đang zero-dependency.
 *
 * `children` được truyền vào dưới dạng prop nên vẫn là server component: bọc
 * client component quanh chúng KHÔNG kéo cả cây sang phía client.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      {/* Vệt quét. `key` khiến nó chạy lại mỗi lần đổi đường dẫn. */}
      <span
        key={`sweep-${pathname}`}
        aria-hidden
        className="animate-sweep pointer-events-none fixed inset-x-0 top-0 z-30 h-px bg-gradient-to-r from-transparent via-electric-bright to-transparent shadow-glow"
      />
      <div key={pathname} className="animate-fade-in-up">
        {children}
      </div>
    </>
  );
}

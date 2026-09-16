"use client";

import { LazyMotion, domMax } from "framer-motion";

/**
 * Nạp Framer Motion theo kiểu tách nhỏ.
 *
 * Import `motion` thẳng sẽ kéo cả gói (~50kB gzip) vào bundle dùng chung. Dự án
 * này vốn chỉ có 87kB First Load JS nên cách đó làm tăng hơn một nửa — quá đắt
 * cho phần hiệu ứng.
 *
 * `LazyMotion` + `domMax` xuống còn ~25kB và vẫn đủ tính năng cần dùng:
 * `domAnimation` rẻ hơn nhưng KHÔNG có layout animation, mà `layoutId` chính là
 * lý do chọn thư viện này (thanh chỉ báo tab trượt giữa các tab). Bỏ nó đi thì
 * không còn lý do gì để không dùng CSS thuần.
 *
 * Kèm theo: mọi component phải dùng `m.div` thay cho `motion.div`. Dùng nhầm
 * `motion` ở bất kỳ đâu sẽ kéo lại cả gói và vô hiệu hoá toàn bộ việc tách nhỏ.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      {children}
    </LazyMotion>
  );
}

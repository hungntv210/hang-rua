import type { Metadata } from "next";

import { FootballNav } from "@/components/FootballNav";

export const metadata: Metadata = {
  // Phải là object có `template`, không thể để chuỗi thường: một layout đặt
  // title dạng chuỗi sẽ chặn template của root không lan tới các trang con,
  // khiến /football/standings ra tiêu đề trơ "Bảng xếp hạng" không có tên
  // thương hiệu. `default` là tiêu đề cho chính /football.
  title: {
    default: "Football",
    template: "%s | Hang Rùa",
  },
  description:
    "Lịch thi đấu, bảng xếp hạng và sơ đồ cúp — tổng hợp nhiều giải, ưu tiên Arsenal.",
};

/**
 * Khung của module Football.
 *
 * Thanh điều hướng dính DƯỚI thanh hamburger (`top-[var(--topbar-h)]`), không
 * phải top-0: dưới breakpoint lg cả hai cùng dính nên nếu đều đặt top-0 thì
 * thanh này chui xuống dưới và bị che khuất.
 *
 * Chiều cao cố định `h-16` (không dùng padding tự giãn) để biến --nav-h trong
 * globals.css luôn đúng mà không phải đo lại khi đổi nội dung.
 */
export default function FootballLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16">
      {/* Nền đục hoàn toàn: bảng xếp hạng cuộn phía sau sẽ lộ qua lớp bán trong
          suốt thành một vệt mờ, nhìn rất nhiễu. */}
      <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 flex h-16 items-center border-b border-grid bg-void px-4">
        <FootballNav />
      </div>

      <div className="pt-8">{children}</div>
    </div>
  );
}

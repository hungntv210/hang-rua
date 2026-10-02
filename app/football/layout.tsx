import type { Metadata } from "next";

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
 * Khung của module Football. Điều hướng giữa lịch / xếp hạng / cúp nay nằm ở
 * menu trên cùng của cả site (`SiteMenu`), nên layout này chỉ giữ bề ngang.
 */
export default function FootballLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">{children}</div>;
}

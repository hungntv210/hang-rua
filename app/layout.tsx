import type { Metadata } from "next";
import {
  Baloo_2,
  Be_Vietnam_Pro,
} from "next/font/google";

import "./globals.css";
import { MotionProvider } from "@/components/MotionProvider";
import { RouteTransition } from "@/components/RouteTransition";
import { SiteMenu } from "@/components/SiteMenu";

/**
 * Tiêu đề, nút, menu: Baloo 2 — nét tròn thân thiện, có subset vietnamese. Dấu
 * tiếng Việt phải được đo thật trên trình duyệt chứ không tin API (xem Task 1
 * của kế hoạch redesign).
 */
const baloo2 = Baloo_2({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "800"],
  variable: "--font-baloo",
  display: "swap",
});

/**
 * Thân và số liệu. Chọn Be Vietnam Pro vì nó được thiết kế riêng cho dấu tiếng
 * Việt — toàn bộ giao diện là tiếng Việt có dấu nên đây là quyết định về nội
 * dung, không chỉ về thẩm mỹ. Giữ nguyên khi đổi hướng thiết kế vì lý do đó
 * không đổi theo bảng màu.
 */
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Hang Rùa",
    template: "%s | Hang Rùa",
  },
  description:
    "Hang Rùa — nơi tập hợp các mục quan tâm. Bắt đầu với Football: lịch thi đấu, bảng xếp hạng và sơ đồ cúp.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`${baloo2.variable} ${beVietnamPro.variable}`}
    >
      <body>
        {/* MotionProvider bọc ngoài cùng nhưng KHÔNG biến `children` thành client
            component — chúng được truyền vào dưới dạng prop nên vẫn render ở
            server. Bốn view bóng đá fetch dữ liệu vẫn là server component. */}
        <MotionProvider>
          <SiteMenu />
          <RouteTransition>{children}</RouteTransition>
        </MotionProvider>
      </body>
    </html>
  );
}

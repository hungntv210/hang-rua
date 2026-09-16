import type { Metadata } from "next";
import {
  Be_Vietnam_Pro,
  Chakra_Petch,
  Charmonman,
  JetBrains_Mono,
} from "next/font/google";

import "./globals.css";
import { HudFrame } from "@/components/HudFrame";
import { MotionProvider } from "@/components/MotionProvider";
import { RouteTransition } from "@/components/RouteTransition";
import { Sidebar } from "@/components/Sidebar";

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

/**
 * Tiêu đề. Chakra Petch có nét cắt vát và bụng chữ phẳng của kiểu chữ bảng điều
 * khiển — hợp với hướng HUD mà không rơi vào mấy mặt chữ sci-fi hình học quen
 * thuộc. Quan trọng hơn: nó hỗ trợ đầy đủ dấu tiếng Việt, thứ mà phần lớn font
 * "techno" không có. Dùng tiết chế: tên thương hiệu, tiêu đề mục, số lớn.
 */
const chakraPetch = Chakra_Petch({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

/**
 * Chữ thư pháp cho tên thương hiệu. CHỈ dùng ở wordmark trang chủ.
 *
 * Chọn Charmonman sau khi loại hết font bút lông Trung/Nhật: `Ma Shan Zheng`,
 * `Zhi Mang Xing`, `Liu Jian Mao Cao` đều **không có glyph dấu tiếng Việt** —
 * đã đo bằng cách so bề rộng chữ "ù" với fallback, không tin API. Google Fonts
 * vẫn trả về khối unicode-range vietnamese cho chúng, nên chỉ nhìn API là mắc bẫy.
 *
 * Trong các font còn lại có dấu Việt, Charmonman là font duy nhất có nét bút
 * thật: đầu nét thon và độ dày biến thiên. Dancing Script, Pacifico, Lobster
 * đều là chữ viết tay monoline — mềm nhưng không phải bút lông.
 */
const charmonman = Charmonman({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "700"],
  variable: "--font-brush",
  display: "swap",
});

/** Nhãn HUD, toạ độ và số liệu dạng bảng — chữ của thiết bị đo. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Hang Rùa — カメの巣穴",
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
      className={`${beVietnamPro.variable} ${chakraPetch.variable} ${jetbrainsMono.variable} ${charmonman.variable}`}
    >
      <body>
        {/* MotionProvider bọc ngoài cùng nhưng KHÔNG biến `children` thành client
            component — chúng được truyền vào dưới dạng prop nên vẫn render ở
            server. Bốn view bóng đá fetch dữ liệu vẫn là server component. */}
        <MotionProvider>
          <Sidebar />
          <HudFrame />

          {/* Chừa sẵn lề trái bằng bề rộng sidebar từ breakpoint lg trở lên. */}
          <div className="min-h-screen lg:pl-64">
            <RouteTransition>{children}</RouteTransition>
          </div>
        </MotionProvider>
      </body>
    </html>
  );
}

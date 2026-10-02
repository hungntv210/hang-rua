import type { Config } from "tailwindcss";

/**
 * Hướng thiết kế: pop-art kawaii Nhật, giao diện SÁNG, dựa trên các sắc xanh
 * lấy mẫu từ logo huy hiệu (navy, royal, aqua, sky) cộng một màu ấm duy nhất:
 * hồng salmon (màu miệng rùa) cho NEW, sticker và khối menu Save Reader.
 *
 * Viền đen dày + bóng cứng lệch (không blur) thay cho bóng mềm. Phía sau bảng
 * số liệu luôn là mặt phẳng trắng đặc: không họa tiết, không `backdrop-filter`
 * (vẽ lại mỗi khung hình sau một bảng 21.000 dòng đang cuộn).
 *
 * Mọi cặp chữ/nền đều được đo ở `npm run check:design` (>= 4.5:1); thêm màu
 * mới thì thêm cặp tương ứng vào `TOKEN_PAIRS` ở script đó.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0A1428", soft: "#3A4A6B", mute: "#51607F" },
        navy: "#36538B",
        royal: { DEFAULT: "#2563C9", 100: "#DCE6F8" },
        aqua: { DEFAULT: "#4FC3D9", 100: "#D3F1F7" },
        sky: { DEFAULT: "#A6D4E3", 100: "#DCEFF6" },
        /** Màu ấm duy nhất: NEW, sticker, khối menu Save Reader. */
        salmon: { DEFAULT: "#E89796", 100: "#FBE3E2" },
        ice: "#F6FBFE",
        /** Màu chức năng: CHỈ cho thang chỉ số cầu thủ và vùng xếp hạng. */
        win: { DEFAULT: "#17794B", wash: "#D9F2E4" },
        warn: { DEFAULT: "#8A5B00", wash: "#FBEBC4" },
        lose: { DEFAULT: "#B4361E", wash: "#FADBD3" },
        /** Màu theo tuyến trong avatar: thủ môn vàng, hậu vệ xanh dương, tiền vệ xanh lá, tiền đạo đỏ. */
        pos: { gk: "#F7C948", df: "#2563C9", mf: "#34B36B", fw: "#C62F2F" },
      },
      fontFamily: {
        /** Thân và số liệu: font thiết kế riêng cho dấu tiếng Việt. */
        sans: [
          "var(--font-body)",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
        /** Tiêu đề, nút, menu: Baloo 2 (có subset vietnamese). */
        display: ["var(--font-baloo)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        /** Bóng cứng lệch kiểu pop-art: không blur. */
        pop: "4px 4px 0 #0A1428",
        "pop-sm": "2px 2px 0 #0A1428",
        "pop-press": "0 0 0 #0A1428",
      },
      keyframes: {
        /** Nhịp cho trận đang diễn ra. Đổi độ mờ, không đổi kích thước. */
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        /**
         * Bảng dự bị hiện ra trên sơ đồ đội hình.
         *
         * Mờ + nở nhẹ, gốc biến đổi đặt ở phía ô cầu thủ, nên bảng trông như bung
         * ra TỪ ô vừa trỏ vào chứ không phải rơi xuống từ đâu đó. 4px là đủ để
         * mắt bắt được hướng mà không thành một cú trượt.
         */
        "tooltip-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        /** Mascot lắc nhẹ khi đang chờ. */
        wobble: {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
        /** Chuyển trang kiểu nảy: dịch nhẹ + phóng nhỏ, có overshoot ở easing. */
        "pop-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.99)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "pulse-live": "pulse-live 1.8s ease-in-out infinite",
        "tooltip-in": "tooltip-in 150ms cubic-bezier(0.16, 1, 0.3, 1) both",
        wobble: "wobble 1.6s ease-in-out infinite",
        "pop-in": "pop-in 240ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards",
      },
    },
  },
  plugins: [],
};

export default config;

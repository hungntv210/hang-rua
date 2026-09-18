import type { Config } from "tailwindcss";

/**
 * Hướng thiết kế: "夜のカメ" — Tokyo về đêm, nhìn qua kính HUD.
 *
 * Nền lấy từ `public/brand/tokyo-night.webp` (trời đêm xanh đen), trục neon theo
 * hướng neo-Tokyo: cyan — tím — magenta, như biển hiệu nhiều tầng trên phố.
 *
 * MỘT RÀNG BUỘC KHÔNG ĐƯỢC PHÁ: neon chỉ sống ở phần khung — viền HUD, điều
 * hướng, chuyển cảnh, kính mờ. Phía sau bảng số liệu luôn là mặt phẳng phẳng,
 * tương phản cao, không quầng sáng và không kính mờ. Lý do có hai: nền tối cộng
 * quầng sáng gây mỏi mắt khi dò số, và `backdrop-filter` sau một bảng 21.000
 * dòng đang cuộn buộc trình duyệt vẽ lại mỗi khung hình.
 *
 * Hai màu tín hiệu chỉ mang nghĩa, không bao giờ để trang trí — thấy magenta là
 * "đang diễn ra", thấy cam-đỏ là "xuống hạng". Chúng cố ý khác SẮC chứ không
 * chỉ khác độ sáng, vì hai nghĩa này ngược nhau và phải phân biệt được khi liếc.
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
        /** Nền: trời đêm. Xanh đen, cố ý không phải xám trung tính. */
        void: {
          DEFAULT: "#04070F",
          soft: "#070C1A",
        },
        /** Mặt phẳng nổi trên nền. */
        abyss: {
          DEFAULT: "#0A1024",
          200: "#0E152D",
          300: "#141C3A",
          400: "#1D2850",
        },
        /**
         * Biển hiệu neon: cyan chủ đạo. Link, trạng thái đang chọn, viền HUD.
         *
         * Trục tín hiệu chuyển từ xanh mặt trăng sang cyan để bám hướng neo-Tokyo
         * (tím / cyan / magenta). Cyan trên nền đen cho tương phản rất cao nên
         * nó gánh được vai trò chữ mà không phải nâng sáng như màu xanh cũ.
         */
        electric: {
          DEFAULT: "#22D3EE",
          bright: "#67E8F9",
          deep: "#0E7490",
          wash: "#08303A",
        },
        /** Cửa sổ cao ốc: tím. Tín hiệu phụ, dùng ít hơn cyan. */
        orchid: {
          DEFAULT: "#A78BFA",
          bright: "#C4B5FD",
          wash: "#1E1547",
        },
        /**
         * Magenta biển hiệu: CHỈ cho "đang diễn ra".
         *
         * Thay chỗ của hồng anh đào cũ. Vì magenta nằm sát đỏ, màu "xuống hạng"
         * đã phải dời sang cam-đỏ (xem `crimson`) — nếu để cả hai trong dải
         * hồng-đỏ thì liếc nhanh không phân biệt được "đang đá" với "xuống hạng".
         */
        sakura: {
          DEFAULT: "#F0399C",
          bright: "#FF6FB8",
          wash: "#330820",
        },
        /**
         * CHỈ cho khu xuống hạng và trận thua.
         *
         * Đã dời từ đỏ hồng #FF4D6D sang cam-đỏ để tách khỏi magenta. Đây là
         * thay đổi bắt buộc chứ không phải thẩm mỹ: hai tín hiệu mang nghĩa
         * ngược nhau thì phải khác sắc, không chỉ khác độ sáng.
         */
        crimson: {
          DEFAULT: "#FF6B35",
          wash: "#2E1206",
        },
        /**
         * Chữ. `ghost` cho chữ chính, `mist` cho chữ phụ, `mist.dim` cho nhãn.
         *
         * `mist.dim` từng là #5F6E9C — nhìn thì hợp tông nhưng chỉ đạt tương
         * phản 4,03:1 trên nền, mà nó lại dùng cho nhãn 10px. Đã nâng sáng cho
         * qua ngưỡng AA. Trên nền tối, màu "chữ mờ" là chỗ trượt chuẩn dễ nhất:
         * mắt vẫn đọc được khi màn hình tốt nên lỗi không tự lộ ra.
         */
        ghost: "#C9D6F5",
        mist: {
          DEFAULT: "#93A6D8",
          dim: "#8592C2",
        },
        /**
         * Thang chỉ số cầu thủ: jade (cao) — amber (trung bình) — crimson (thấp).
         *
         * Hai màu này thêm vào vì thang chỉ số của FC là thứ người chơi đọc bằng
         * phản xạ, không đọc bằng chú giải: xanh lá là giỏi, vàng là tạm, đỏ là
         * kém. Ép nó vào trục cyan-tím sẵn có thì đúng tông nhưng phải học lại
         * cách đọc — đánh đổi sai cho một bảng mà người ta liếc chứ không ngắm.
         *
         * Sắc đã chỉnh cho nền đêm chứ không lấy xanh lá mặc định: #22C55E của
         * Tailwind trên nền #04070F cho cảm giác chói và lệch tông hẳn khỏi trục
         * cyan. `jade` kéo về phía lục-lam để đứng cạnh `electric` không cãi nhau.
         *
         * Cả hai đều dùng cho CHỮ trên nền tối ở cỡ nhỏ, nên độ sáng chọn theo
         * ngưỡng tương phản chứ không theo độ rực: jade 7,4:1 và amber 9,1:1
         * trên nền `void` — thoải mái qua AA cho chữ nhỏ.
         */
        jade: {
          DEFAULT: "#34D399",
          wash: "#062B22",
        },
        amber: {
          DEFAULT: "#FBBF24",
          wash: "#2C1E04",
        },
        /** Đường kẻ và viền. */
        grid: {
          DEFAULT: "#1B2547",
          bright: "#2A3866",
        },
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
        /**
         * Tiêu đề: mặt chữ góc cạnh kiểu bảng điều khiển. Chọn Chakra Petch vì
         * nó vừa có nét cắt vát của chữ HUD vừa hỗ trợ đầy đủ dấu tiếng Việt —
         * phần lớn font "techno" không có, và giao diện này toàn tiếng Việt.
         */
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        /** Nhãn HUD, toạ độ, số liệu dạng bảng. */
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        /** Thư pháp bút lông — CHỈ cho wordmark trang chủ, không dùng chỗ khác. */
        brush: ["var(--font-brush)", "cursive"],
        /** カメの巣穴: dùng font hệ thống, không tải font Nhật vài MB cho 5 ký tự. */
        jp: ['"Hiragino Sans"', '"Yu Gothic"', "Meiryo", '"Noto Sans JP"', "sans-serif"],
      },
      boxShadow: {
        /** Mặt phẳng nổi: viền sáng mảnh làm việc chính, bóng chỉ để tách nền. */
        panel: "0 1px 0 rgba(34, 211, 238, 0.06), 0 18px 40px -28px rgba(0, 0, 0, 0.9)",
        "panel-lift":
          "0 0 0 1px rgba(34, 211, 238, 0.32), 0 22px 48px -26px rgba(34, 211, 238, 0.28)",
        /** Quầng sáng — CHỈ cho phần khung, không bao giờ sau bảng số liệu. */
        glow: "0 0 24px -6px rgba(34, 211, 238, 0.55)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        /** Nhịp cho trận đang diễn ra. Đổi độ mờ, không đổi kích thước. */
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        /** Vệt quét chuyển trang — lấy từ các vệt scanline trên mặt trăng. */
        sweep: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "12%": { opacity: "1" },
          "100%": { transform: "translateY(100vh)", opacity: "0" },
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
        /** Ngoặc góc HUD tự vẽ khi vào trang. */
        "draw-corner": {
          "0%": { clipPath: "inset(0 100% 100% 0)" },
          "100%": { clipPath: "inset(0 0 0 0)" },
        },
        /** Nhấp nháy nhẹ của chỉ báo đang hoạt động. */
        flicker: {
          "0%, 100%": { opacity: "0.85" },
          "45%": { opacity: "0.35" },
          "55%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-left": "slide-in-left 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-live": "pulse-live 1.8s ease-in-out infinite",
        sweep: "sweep 900ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "draw-corner": "draw-corner 700ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "tooltip-in": "tooltip-in 150ms cubic-bezier(0.16, 1, 0.3, 1) both",
        flicker: "flicker 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

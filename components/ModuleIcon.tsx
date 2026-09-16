import type { AppModule } from "@/lib/modules";

/**
 * Icon SVG nội tuyến cho từng module — không dùng thư viện icon ngoài để giữ
 * bundle nhẹ, đúng tinh thần của dự án.
 */
export function ModuleIcon({
  icon,
  className = "h-5 w-5",
}: {
  icon: AppModule["icon"];
  className?: string;
}) {
  if (icon === "football") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7.5l3.2 2.3-1.2 3.8h-4l-1.2-3.8L12 7.5Z" fill="currentColor" />
        <path
          d="M12 3v4.5M4.2 9.6l4 .7M19.8 9.6l-4 .7M7.2 19.4l2.6-5.8M16.8 19.4l-2.6-5.8"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Save Reader: đĩa lưu kiểu cũ. Cùng ngôn ngữ hình học với icon bóng — nét
  // mảnh, không tô đặc, một chi tiết đặc duy nhất làm điểm nhấn.
  if (icon === "save") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path
          d="M4.5 3.5h11.3L20.5 8.2v12.3H4.5V3.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M8 3.5h7v5H8v-5Z" fill="currentColor" />
        <path
          d="M7.5 13h9v7.5h-9V13Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Ô "sắp có": lục giác nét đứt — cùng hình đốt vảy dùng cho vòng đấu, gợi ý
  // một ô trên mai còn để trống.
  return (
    <svg viewBox="0 0 24 26" fill="none" className={className} aria-hidden>
      <polygon
        points="12,1.5 21.5,7 21.5,19 12,24.5 2.5,19 2.5,7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

export type ScuteState = "played" | "current" | "upcoming";

/**
 * Đốt vảy trên mai rùa — dấu mốc của một vòng đấu trên sống mai.
 *
 * Hình lấy từ chủ thể (vảy mai rùa là hình lục giác) nhưng mã hoá thông tin
 * thật: nhìn dọc sống mai là đọc được tiến độ mùa giải.
 *
 *   tô đặc        -> vòng đã đá xong
 *   viền anh đào  -> vòng hiện tại (màu này chỉ mang nghĩa "đang diễn ra")
 *   để rỗng       -> vòng phía trước
 */
export function Scute({ state }: { state: ScuteState }) {
  const points = "12,1 22,7 22,19 12,25 2,19 2,7";

  if (state === "played") {
    return (
      <svg viewBox="0 0 24 26" className="h-[18px] w-[17px]" aria-hidden>
        <polygon points={points} className="fill-electric" />
      </svg>
    );
  }

  if (state === "current") {
    return (
      <svg viewBox="0 0 24 26" className="h-[18px] w-[17px]" aria-hidden>
        <polygon
          points={points}
          className="fill-void stroke-sakura"
          strokeWidth="3"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 26" className="h-[18px] w-[17px]" aria-hidden>
      <polygon
        points={points}
        className="fill-none stroke-grid-bright"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/**
 * Lưới thẻ trang chủ. Thay cho `lib/modules.ts` cũ: thay vì ba "mục" chung
 * chung, mỗi thẻ trỏ thẳng vào một thứ dùng được.
 *
 * Tone xen kẽ để không có hai thẻ liền kề cùng màu (kiểm ở `npm run check:ui`);
 * `size: "lg"` chiếm hai cột trên desktop — nhịp to/nhỏ có chủ đích.
 */
export type HomeCardTone = "sky" | "aqua" | "royal" | "salmon";

export interface HomeCard {
  id: string;
  title: string;
  blurb: string;
  href?: string;
  tone: HomeCardTone;
  size: "sm" | "lg";
  isNew?: boolean;
}

export const HOME_CARDS: readonly HomeCard[] = [
  {
    id: "fc27",
    title: "Save Reader FC 27",
    blurb: "Thả file save vào, xem đội hình thật, sơ đồ, lò trẻ, cầu thủ cho mượn. Không byte nào rời khỏi máy bạn.",
    href: "/save-reader/fc27",
    tone: "salmon",
    size: "lg",
    isNew: true,
  },
  {
    id: "arsenal",
    title: "Lịch Arsenal",
    blurb: "Pháo thủ đá ngày nào, gặp ai.",
    href: "/football",
    tone: "sky",
    size: "sm",
  },
  {
    id: "standings",
    title: "Bảng xếp hạng",
    blurb: "Sáu giải, ai đang leo, ai đang tụt.",
    href: "/football/standings",
    tone: "aqua",
    size: "sm",
  },
  {
    id: "league",
    title: "Lịch theo giải",
    blurb: "Từng vòng đấu, lọc theo câu lạc bộ.",
    href: "/football/league/premier-league",
    tone: "royal",
    size: "sm",
  },
  {
    id: "cup",
    title: "Sơ đồ cúp",
    blurb: "Nhánh đấu loại trực tiếp.",
    href: "/football/bracket",
    tone: "sky",
    size: "sm",
  },
  {
    id: "fc26",
    title: "Save Reader FC 26",
    blurb: "Đội hình gợi ý, cầu thủ trẻ và scout từ save FC 26.",
    href: "/save-reader/fc26",
    tone: "aqua",
    size: "lg",
  },
  {
    id: "soon",
    title: "Sắp có",
    blurb: "Rùa đang đào thêm một ngách mới.",
    tone: "royal",
    size: "sm",
  },
];

/**
 * Danh sách các mục của Hang Rùa.
 *
 * Football là mục đầu tiên và duy nhất đang hoạt động. Các ô "sắp có" chỉ là
 * chỗ trống có sẵn để sau này đặt tên — không phải link, không bấm được.
 * Khi thêm mục mới: đổi status sang "live", điền href và mô tả.
 */

export type ModuleStatus = "live" | "soon";

export interface AppModule {
  id: string;
  name: string;
  /** Tên phụ tiếng Nhật, hiện nhỏ bên dưới tên chính. */
  nameJp?: string;
  description: string;
  href?: string;
  status: ModuleStatus;
  /** Tên icon từ bộ icon nội bộ trong components/ModuleIcon.tsx. */
  icon: "football" | "save" | "placeholder";
}

export const MODULES: AppModule[] = [
  {
    id: "football",
    name: "Football",
    nameJp: "サッカー",
    description:
      "Lịch thi đấu, bảng xếp hạng và sơ đồ cúp của sáu giải lớn châu Âu.",
    href: "/football",
    status: "live",
    icon: "football",
  },
  {
    id: "save-reader",
    name: "Save Reader",
    nameJp: "セーブ",
    description:
      "Bóc cấu trúc file save Career Mode của EA Sports FC 26 ngay trên trình duyệt.",
    href: "/save-reader",
    status: "live",
    icon: "save",
  },
  {
    id: "slot-3",
    name: "Sắp có",
    description: "Chỗ trống cho mục tiếp theo.",
    status: "soon",
    icon: "placeholder",
  },
];

/**
 * Menu trên cùng của Hang Rùa: 5 khối ngang bằng nhau, mỗi khối một màu.
 *
 * Tông chỉ chọn trong năm màu đặc của bảng màu; màu chữ trên từng khối do
 * `components/SiteMenu.tsx` quyết theo bảng tương phản (`npm run check:design`).
 */
export type NavTone = "navy" | "royal" | "aqua" | "sky" | "salmon";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  tone: NavTone;
  /** Đường dẫn khớp chính xác và/hoặc theo tiền tố thì mục này sáng. */
  match: { exact?: readonly string[]; prefix?: readonly string[] };
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", label: "Trang chủ", href: "/", tone: "navy", match: { exact: ["/"] } },
  {
    id: "schedule",
    label: "Lịch đấu",
    href: "/football",
    tone: "royal",
    // "/football" là trang lịch Arsenal và cũng là gốc của module: phải khớp
    // chính xác, nếu không nó sáng cả khi đang ở /football/standings.
    match: { exact: ["/football"], prefix: ["/football/league"] },
  },
  {
    id: "standings",
    label: "Xếp hạng",
    href: "/football/standings",
    tone: "aqua",
    match: { prefix: ["/football/standings"] },
  },
  {
    id: "cup",
    label: "Cúp",
    href: "/football/bracket",
    tone: "sky",
    match: { prefix: ["/football/bracket"] },
  },
  {
    id: "save-reader",
    label: "Save Reader",
    href: "/save-reader",
    tone: "salmon",
    match: { prefix: ["/save-reader"] },
  },
];

export function isActive(pathname: string, item: NavItem): boolean {
  const { exact = [], prefix = [] } = item.match;
  return exact.includes(pathname) || prefix.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

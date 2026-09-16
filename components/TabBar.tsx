"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";

/**
 * Thanh tab dùng chung, có chỉ báo trượt giữa các tab.
 *
 * Đây là lý do chính để thêm Framer Motion vào dự án: `layoutId` cho phép một
 * phần tử DUY NHẤT trượt từ tab cũ sang tab mới, kèm spring, mà không phải tự
 * đo toạ độ từng nút. Làm bằng CSS thuần thì phải đo `getBoundingClientRect`
 * mỗi lần đổi tab và mỗi lần cửa sổ đổi kích thước — nhiều code hơn, dễ lệch hơn.
 *
 * `TabPanel` đi kèm để nội dung tab vào/ra có nhịp khớp với chỉ báo.
 */

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Nhãn tiếng Nhật nhỏ bên cạnh — bỏ trống thì không hiện. */
  labelJp?: string;
}

interface TabBarProps<T extends string> {
  tabs: ReadonlyArray<TabItem<T>>;
  active: T;
  onChange: (id: T) => void;
  /** Nhóm `layoutId` phải khác nhau giữa các thanh tab cùng hiện trên một trang. */
  group: string;
  ariaLabel: string;
}

/**
 * KHÔNG được đổi cây DOM theo `useReducedMotion()`.
 *
 * Trên server hook này luôn trả `false` (không có media query), nên nếu nhánh
 * render phụ thuộc vào nó thì máy có bật giảm chuyển động sẽ hydrate ra cấu
 * trúc khác với HTML từ server — React báo hydration mismatch và dựng lại toàn
 * bộ cây. Lỗi này chỉ lộ ra khi chạy thật trên máy có bật tuỳ chọn đó.
 *
 * Cách đúng: luôn render cùng một cây, chỉ đổi THỜI LƯỢNG chuyển động. Markup
 * giống hệt nhau nên hydrate sạch, mà người bật giảm chuyển động vẫn không thấy
 * gì nhúc nhích.
 */
const springFor = (reduce: boolean | null) =>
  reduce
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 420, damping: 34 } as const);

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  group,
  ariaLabel,
}: TabBarProps<T>) {
  const reduce = useReducedMotion();

  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`tab relative ${selected ? "tab-active" : ""}`}
          >
            {/* Nền trượt nằm DƯỚI chữ. Cùng `layoutId` ở mọi nút nên Framer
                hiểu đây là một phần tử di chuyển, không phải nhiều phần tử
                xuất hiện rồi biến mất. */}
            {selected ? (
              <m.span
                layoutId={`tab-indicator-${group}`}
                className="absolute inset-0 -z-10 rounded-sm bg-electric-wash"
                transition={springFor(reduce)}
              />
            ) : null}
            <span className="relative">{tab.label}</span>
            {tab.labelJp ? (
              <span className="brand-jp relative ml-2 text-[9px] text-mist-dim">
                {tab.labelJp}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Vùng nội dung của tab. Đổi `tabKey` là nội dung cũ mờ đi rồi nội dung mới
 * trượt vào.
 *
 * `mode="wait"` để hai nội dung không chồng lên nhau giữa chừng — với bảng dữ
 * liệu cao vài nghìn pixel, chồng lấp làm trang giật chiều cao rất khó chịu.
 */
export function TabPanel({
  tabKey,
  children,
}: {
  tabKey: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  // Luôn render cùng một cây — xem ghi chú ở `springFor`. Người bật giảm chuyển
  // động nhận thời lượng 0 và độ dịch 0, tức đổi tab tức thì.
  const shift = reduce ? 0 : 12;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={tabKey}
        initial={{ opacity: reduce ? 1 : 0, x: shift }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: reduce ? 1 : 0, x: reduce ? 0 : -8 }}
        transition={{ duration: reduce ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

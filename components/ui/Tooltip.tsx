/**
 * Bảng nổi. KHÔNG tự quản trạng thái: chủ sở hữu giữ `open`.
 *
 * Khi đóng thì trả `null` — gỡ hẳn khỏi DOM. Bản cũ từng để lại phần tử
 * `opacity:0` sau hoạt ảnh thoát; chúng vô hình nhưng vẫn nhận chuột (chặn ô
 * kế bên) và vẫn được trình đọc màn hình đọc. Hiện bằng animation CSS (vào
 * thôi), ẩn thì biến ngay.
 */
export function Tooltip({
  id,
  open,
  className = "",
  children,
}: {
  id: string;
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      id={id}
      role="tooltip"
      className={`animate-tooltip-in rounded-xl border-2 border-ink bg-white p-2 text-ink shadow-pop-sm ${className}`}
    >
      {children}
    </div>
  );
}

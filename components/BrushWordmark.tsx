/**
 * Tên thương hiệu viết bằng nét bút thư pháp.
 *
 * VÌ SAO KHÔNG CÒN GLITCH: bản trước dùng hiệu ứng nhiễu tách kênh màu. Nét bút
 * và nhiễu số hoá đánh nhau về ngôn ngữ — một bên là mực và tay người, một bên
 * là tín hiệu hỏng. Giữ cả hai thì không cái nào ra cái nào.
 *
 * Cách xử lý màu lấy thẳng từ banner: chữ カメ ở đó là nét bút **xanh phát sáng**
 * trên nền đêm, không phải mực đen. Nên wordmark cũng là mực sáng — chuyển sắc
 * từ trắng-xanh sang cyan, kèm quầng sáng mảnh. Đây là mô tả lại thứ đã có trong
 * bộ nhận diện, không phải thêm một ý tưởng thứ hai.
 *
 * Gạch nhấn bên dưới là SVG chứ không phải border: nó có đầu thon và bụng dày
 * như một nét quét bút, thứ mà đường kẻ CSS không làm được. Nét tự vẽ khi vào
 * trang bằng `stroke-dasharray`, nên chữ đọc như đang được viết ra.
 */
export function BrushWordmark({ text }: { text: string }) {
  return (
    <span className="relative inline-block">
      <span
        className="brush-ink font-brush block leading-[1.15] tracking-wide"
        // Nghiêng rất nhẹ theo hướng bút chạy. Chữ thư pháp dựng đứng hoàn toàn
        // trông như font, nghiêng quá thì thành italic giả.
        style={{ transform: "rotate(-1.5deg)" }}
      >
        {text}
      </span>

      {/* Nét quét bút bên dưới. `viewBox` dẹt để nét kéo dài hết bề ngang chữ. */}
      <svg
        aria-hidden
        viewBox="0 0 300 24"
        preserveAspectRatio="none"
        className="absolute -bottom-1 left-0 h-3 w-full overflow-visible sm:-bottom-2 sm:h-5"
      >
        <path
          className="brush-stroke"
          d="M4 15 C 60 6, 110 20, 168 11 S 258 4, 296 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

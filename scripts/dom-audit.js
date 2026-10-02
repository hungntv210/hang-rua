/*
 * Đo những lỗi giao diện mà ảnh chụp màn hình không thấy. Dán vào console
 * (hoặc javascript_tool) trên trang đang mở; trả về một object.
 *
 *   overflowX : số pixel trang tràn ngang (phải = 0)
 *   clipped   : nhãn [data-audit-label] bị cắt chữ (scrollWidth > clientWidth)
 *   overlaps  : cặp [data-audit-box] có hình chữ nhật giao nhau
 *   tooltips  : số [role=tooltip] đang có trong DOM (đóng hết phải = 0)
 *   counted   : số phần tử đã đo — 0 nghĩa là trang chưa gắn thuộc tính đo,
 *               KHÔNG phải "không có lỗi"
 */
(() => {
  const name = (el) => (el.getAttribute("data-audit-label") || el.textContent || "").trim().slice(0, 40);
  const labels = [...document.querySelectorAll("[data-audit-label]")].filter((el) => el.offsetParent !== null);
  const clipped = labels.filter((el) => el.scrollWidth > el.clientWidth + 1).map(name);
  const boxes = [...document.querySelectorAll("[data-audit-box]")]
    .filter((el) => el.offsetParent !== null)
    .map((el) => ({ el, r: el.getBoundingClientRect() }));
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r;
      const b = boxes[j].r;
      // Giao nhau thật (trên 1px theo cả hai trục), không tính chạm cạnh.
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 1 && h > 1) overlaps.push([name(boxes[i].el), name(boxes[j].el)]);
    }
  }
  return {
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    clipped,
    overlaps,
    tooltips: document.querySelectorAll("[role=tooltip]").length,
    counted: { labels: labels.length, boxes: boxes.length },
  };
})();

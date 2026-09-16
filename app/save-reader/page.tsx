import type { Metadata } from "next";

import { SaveReaderClient } from "@/components/save/SaveReaderClient";

export const metadata: Metadata = {
  title: "Save Reader",
  description:
    "Bóc cấu trúc file save Career Mode của EA Sports FC 26 ngay trên trình duyệt — không tải file lên server.",
};

/**
 * Vỏ server component: chỉ lo tiêu đề và phần dẫn nhập.
 *
 * Toàn bộ việc đọc file nằm trong client component bên dưới. Trang này KHÔNG
 * fetch gì nên tĩnh hoàn toàn, không ISR, không quota — khác hẳn các trang của
 * module Football.
 */
export default function SaveReaderPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-16 pt-10">
      <header className="space-y-3">
        <p className="eyebrow">Hang Rùa · công cụ</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ghost sm:text-4xl">
          Save Reader
        </h1>
        <p className="max-w-3xl text-mist">
          Đọc file save Career Mode của EA Sports FC 26 ngay trên máy bạn: danh
          sách hơn 20.000 cầu thủ kèm chỉ số và tiềm năng, cộng toàn bộ cấu trúc
          tự mô tả tìm thấy bên trong file.
        </p>
        <p className="max-w-3xl text-sm text-mist">
          <strong>Chỉ số, tiềm năng, ngày sinh, thể hình đọc thẳng từ save.</strong>{" "}
          Chỉ số tổng là ngoại lệ: file không lưu nó, nên trang tính lại từ 31 chỉ
          số thành phần và có sai số ±1. Tên cầu thủ có sẵn lấy từ một cơ sở dữ
          liệu FC 26 nhúng theo <code>playerId</code>; tên cầu thủ do career sinh
          ra thì nằm ngay trong save. Cầu thủ không tra được tên hiển thị theo ID
          và được đánh dấu rõ.
        </p>
        <p className="max-w-3xl text-sm text-mist">
          Bấm vào một dòng để mở đủ <strong>31 chỉ số chi tiết</strong> theo nhóm,
          cùng số sao kỹ năng, chân không thuận và danh tiếng.
        </p>
        <p className="max-w-3xl text-sm text-mist">
          Chưa đọc được: <em>CLB hiện tại trong career</em>, giá trị chuyển nhượng
          và hợp đồng. Cột CLB hiện là CLB gốc từ cơ sở dữ liệu nên chưa phản ánh
          chuyển nhượng đã diễn ra trong career. Khoảng một phần năm cầu thủ chưa
          có tên — chủ yếu là đội trẻ và đội dự bị, nhóm không trang thống kê nào
          liệt kê vì họ không thi đấu ở giải nào; chỉ số của họ vẫn đọc được đầy đủ
          và họ được nhận dạng qua quốc tịch, vị trí và tuổi. Các tab còn lại bày
          lớp field tự mô tả — phần sự kiện Career Mode — cùng những vùng byte chưa
          giải mã.
        </p>
      </header>

      <SaveReaderClient />
    </div>
  );
}

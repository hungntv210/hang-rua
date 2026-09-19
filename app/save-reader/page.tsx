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
          <strong>
            Chỉ số, tiềm năng, ngày sinh, thể hình, hạn hợp đồng và ngày gia nhập
            đọc thẳng từ save.
          </strong>{" "}
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
          <strong>Chỉ cần một file save.</strong> Trang tự nhận ra câu lạc bộ, gắn{" "}
          <strong>số áo</strong> từ roster gốc của game, dựng sơ đồ đội hình, và lọc
          ra <strong>cầu thủ trẻ do career sinh ra</strong> ở tab riêng. Không phải
          chạy công cụ nào kèm theo.
        </p>
        <p className="max-w-3xl text-sm text-mist">
          Hai thứ save KHÔNG lưu được: <em>đội hình bạn đã xếp</em> và{" "}
          <em>lương</em>. Đội hình xuất phát đã dò sáu hướng và đóng — mức khớp cao
          nhất đúng bằng mức ngẫu nhiên — nên sơ đồ trên trang là đội hình gợi ý,
          suy từ vị trí sở trường và chỉ số. Lương chỉ nằm trong một bảng 45 dòng
          của riêng đội bạn cầm, quá nhỏ để định vị trong file 15MB. Muốn hai thứ
          đó thì nạp thêm bản export Live Editor ở mục tuỳ chọn trên tab Đội hình.{" "}
          <em>Giá trị chuyển nhượng</em> là trường hợp khác hẳn: game không lưu nó
          ở bất kỳ đâu — nó dựng lúc chạy rồi vứt — nên trang ước tính từ chỉ số,
          tiềm năng và tuổi, và đánh dấu rõ là ước tính. Gần như mọi cầu thủ đều có tên: kho tên
          lấy thẳng từ bảng gốc của game (41.189 mục), nên cả cầu thủ do career
          sinh ra cũng tra được. Đo trên save thật còn 1–2 người trong hơn 19.000
          chưa tra ra, và chỉ số của họ vẫn đọc được đầy đủ. Các tab còn lại bày
          lớp field tự mô tả — phần sự kiện Career Mode — cùng những vùng byte chưa
          giải mã.
        </p>
      </header>

      <SaveReaderClient />
    </div>
  );
}

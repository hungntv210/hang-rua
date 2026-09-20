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
          số thành phần và có sai số ±1. Tên cầu thủ tra từ kho tên lấy thẳng
          hai bảng gốc của game, theo đúng chỉ số tên mà file save mang theo —
          nên cầu thủ có sẵn và cầu thủ do career sinh ra đều ra tên như nhau.
          Cầu thủ không tra được tên hiển thị theo ID và được đánh dấu rõ. Cột{" "}
          <strong>CLB</strong> và <strong>số áo</strong> là ngoại lệ thứ hai: chúng
          lấy từ roster <em>lúc game xuất xưởng</em>, nên với người vừa chuyển đến
          trong career, đó là CLB cũ chứ không phải đội hiện tại.
        </p>
        <p className="max-w-3xl text-sm text-mist">
          Bấm vào một dòng để mở đủ <strong>31 chỉ số chi tiết</strong> theo nhóm,
          cùng số sao kỹ năng, chân không thuận và danh tiếng.
        </p>
        <p className="max-w-3xl text-sm text-mist">
          <strong>Chỉ cần một file save.</strong> Trang tự nhận ra câu lạc bộ, gắn{" "}
          <strong>số áo</strong> từ roster gốc của game, dựng sơ đồ đội hình, và lọc
          ra <strong>cầu thủ trẻ do career sinh ra</strong> ở tab riêng. Không phải
          chạy công cụ nào kèm theo, và trang không tải kèm cơ sở dữ liệu cầu thủ
          bên thứ ba nào — mọi thứ nó biết đều đến từ bảng gốc của chính game.
        </p>
        <p className="max-w-3xl text-sm text-mist">
          <strong>Sơ đồ chiến thuật giờ đọc thẳng từ save.</strong> Trang tìm khối
          22 toạ độ của team sheet bạn đang dùng rồi đối chiếu với bảng hình dạng
          sân của game, nên đổi sơ đồ trong game và tải save mới lên thì hình vẽ
          đổi theo. Đo trên sáu file save của hai career: sáu lần định vị đúng, và
          hai cặp save trước/sau khi đổi sơ đồ cho ra đúng hai sơ đồ khác nhau.{" "}
          <em>
            Nhưng ai đá ô nào thì vẫn là gợi ý
          </em>{" "}
          — chỗ đó save không lưu, nên trang xếp người vào các ô theo vị trí sở
          trường và chỉ số. Đã dò tới tầng bit trong bản ghi cầu thủ 144 byte với
          phép thử dương tính đạt 100%, và không có trường nào ghi ô đá.{" "}
          <em>Lương</em> thì vẫn chưa tìm được: nó nằm trong một bảng 45 dòng của
          riêng đội bạn cầm, quá nhỏ để định vị trong file 15MB. Muốn đội hình thật
          và lương ngay bây giờ thì nạp thêm bản export Live Editor ở mục tuỳ chọn
          trên tab Đội hình — đó là đường duy nhất đang chạy được.{" "}
          <em>Giá trị chuyển nhượng</em> là trường hợp khác hẳn: game không lưu nó
          ở bất kỳ đâu — nó dựng lúc chạy rồi vứt — nên trang ước tính từ chỉ số,
          tiềm năng và tuổi, và đánh dấu rõ là ước tính. Mọi cầu thủ đều có tên: kho tên gộp hai
          bảng gốc của game (46.813 mục). Đo trên bốn file save thật, ba save ra
          đủ 100%, save còn lại thiếu đúng một người mà chính game đánh dấu là
          không có tên. Các tab còn lại bày
          lớp field tự mô tả — phần sự kiện Career Mode — cùng những vùng byte chưa
          giải mã.
        </p>
      </header>

      <SaveReaderClient />
    </div>
  );
}

import type { Metadata } from "next";

import { Card } from "@/components/ui/Card";
import { Sticker } from "@/components/ui/Sticker";

export const metadata: Metadata = {
  title: "Save Reader",
  description:
    "Đọc file save Career Mode của EA Sports FC ngay trên trình duyệt — chọn phiên bản FC 26 hoặc FC 27. Không tải file lên server.",
};

const VERSIONS = [
  {
    href: "/save-reader/fc27",
    name: "FC 27",
    tone: "salmon",
    isNew: true,
    note: "Đội hình thật, sơ đồ, cầu thủ trẻ, cho mượn, scout. Đọc thẳng cơ sở dữ liệu trong save.",
  },
  {
    href: "/save-reader/fc26",
    name: "FC 26",
    tone: "sky",
    isNew: false,
    note: "Đội hình gợi ý, cầu thủ trẻ, scout. Dò cấu trúc file save FC 26.",
  },
] as const;

/** Trang chọn phiên bản: tĩnh hoàn toàn, mỗi phiên bản có trình đọc riêng. */
export default function SaveReaderChooserPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10">
      <header className="max-w-3xl">
        <Sticker tone="salmon" tilt={-2}>
          Save Reader
        </Sticker>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] text-ink sm:text-5xl">
          File save của bạn là game nào?
        </h1>
        <p className="mt-3 text-ink-soft">
          Mỗi phiên bản có một trình đọc riêng. Chọn đúng bản để đọc được đội hình, tiềm năng và hợp đồng.
        </p>
      </header>

      {/* Cam kết về dữ liệu: đặt ngay đầu trang, không giấu dưới chân. */}
      <p className="mt-6 inline-flex -rotate-1 items-center gap-2 rounded-xl border-2 border-ink bg-win-wash px-4 py-2 text-sm font-bold text-win shadow-pop-sm">
        <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="currentColor">
          <path d="M10 1.5 3 4.5v5c0 4.2 2.9 8 7 9 4.1-1 7-4.8 7-9v-5l-7-3Zm-1 12.2L5.8 10.5l1.4-1.4L9 10.9l3.8-3.8 1.4 1.4L9 13.7Z" />
        </svg>
        Chạy hoàn toàn trên máy bạn — không byte nào gửi lên server.
      </p>

      <ul className="mt-8 grid gap-5 sm:grid-cols-[1.3fr_1fr]">
        {VERSIONS.map((v) => (
          <li key={v.href}>
            <Card
              tone={v.tone}
              title={v.name}
              href={v.href}
              size="lg"
              corner={v.isNew ? <Sticker>NEW!</Sticker> : undefined}
            >
              <span className="block">{v.note}</span>
              <span className="mt-4 block font-display text-sm font-extrabold text-royal">Mở trình đọc →</span>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

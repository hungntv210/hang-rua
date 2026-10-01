import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Save Reader",
  description:
    "Đọc file save Career Mode của EA Sports FC ngay trên trình duyệt — chọn phiên bản FC 26 hoặc FC 27. Không tải file lên server.",
};

const VERSIONS = [
  {
    href: "/save-reader/fc26",
    name: "FC 26",
    note: "Đội hình gợi ý, cầu thủ trẻ, scout. Dò cấu trúc file save FC 26.",
  },
  {
    href: "/save-reader/fc27",
    name: "FC 27",
    note: "Đội hình thật, sơ đồ, cầu thủ trẻ, cho mượn, scout. Đọc thẳng cơ sở dữ liệu trong save.",
  },
] as const;

/** Trang chọn phiên bản: tĩnh hoàn toàn, mỗi phiên bản có trình đọc riêng. */
export default function SaveReaderChooserPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-16 pt-10">
      <header className="space-y-3">
        <p className="eyebrow">Hang Rùa · công cụ</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ghost sm:text-4xl">Save Reader</h1>
        <p className="max-w-3xl text-mist">
          Chọn phiên bản game của file save Career Mode. Mỗi phiên bản dùng một trình đọc riêng, chạy hoàn toàn trên
          máy bạn — không byte nào được gửi lên server.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {VERSIONS.map((v) => (
          <li key={v.href}>
            <Link
              href={v.href}
              className="block h-full rounded-sm border border-grid bg-abyss/60 p-6 transition-colors hover:border-electric hover:bg-abyss-300/60"
            >
              <span className="font-display text-2xl font-semibold text-ghost">{v.name}</span>
              <span className="mt-2 block text-sm text-mist">{v.note}</span>
              <span className="mt-4 block font-mono text-[11px] uppercase tracking-[0.18em] text-electric">
                Mở trình đọc →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

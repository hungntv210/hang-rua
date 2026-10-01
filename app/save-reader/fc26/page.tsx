import type { Metadata } from "next";
import Link from "next/link";

import { SaveReaderClient } from "@/components/save/SaveReaderClient";

export const metadata: Metadata = {
  title: "Save Reader FC 26",
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
          Save Reader FC 26
        </h1>
        <p className="max-w-3xl text-mist">
          Đọc file save Career Mode của EA Sports FC 26 ngay trên máy bạn. Không
          byte nào được gửi lên server.
        </p>
        <p className="text-sm text-mist">
          <Link href="/save-reader" className="underline">
            ← Đổi phiên bản
          </Link>
        </p>
      </header>

      <SaveReaderClient />
    </div>
  );
}

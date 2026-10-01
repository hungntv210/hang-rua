import type { Metadata } from "next";
import Link from "next/link";

import { Fc27Client } from "@/components/save27/Fc27Client";

export const metadata: Metadata = {
  title: "Save Reader FC 27",
  description:
    "Đọc file save Career Mode EA Sports FC 27 ngay trên trình duyệt: đội hình thật, học viện, cho mượn, scout — không tải file lên server.",
};

/** Vỏ server component tĩnh; mọi việc đọc file nằm ở client. */
export default function SaveReaderFc27Page() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-16 pt-10">
      <header className="space-y-3">
        <p className="eyebrow">Hang Rùa · công cụ</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ghost sm:text-4xl">Save Reader FC 27</h1>
        <p className="max-w-3xl text-mist">
          Đọc file save Career Mode của EA Sports FC 27 ngay trên máy bạn. Không byte nào được gửi lên server.
        </p>
        <p className="text-sm text-mist">
          <Link href="/save-reader" className="underline">
            ← Đổi phiên bản
          </Link>
        </p>
      </header>

      <Fc27Client />
    </div>
  );
}

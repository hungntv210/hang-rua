import Link from "next/link";

import { Scute } from "@/components/Scute";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <span className="mx-auto flex justify-center">
        <Scute state="upcoming" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ghost">
        Không tìm thấy trang
      </h1>
      <p className="mt-2 text-sm text-mist">
        Giải đấu bạn tìm không có trong cấu hình (lib/config.ts).
      </p>
      <Link href="/" className="tab mt-5 inline-flex">
        Về trang chủ
      </Link>
    </div>
  );
}

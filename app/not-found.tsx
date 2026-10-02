import Link from "next/link";

import { buttonClass } from "@/components/ui/Button";
import { MascotState } from "@/components/ui/MascotState";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <MascotState kind="empty" title="Hang này trống trơn">
        <p>Không tìm thấy trang. Giải đấu bạn tìm không có trong cấu hình (lib/config.ts).</p>
      </MascotState>
      <div className="mt-6 flex justify-center">
        <Link href="/" className={buttonClass("royal")}>
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}

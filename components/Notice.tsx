import { MascotState } from "@/components/ui/MascotState";

interface NoticeProps {
  title: string;
  children?: React.ReactNode;
  tone?: "info" | "error";
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16Zm.75-11.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9 9a1 1 0 0 0 0 2h.25v3H9a1 1 0 1 0 0 2h2.5a1 1 0 1 0 0-2h-.25v-4A1 1 0 0 0 10.25 9H9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Notice({ title, children, tone = "info" }: NoticeProps) {
  // Lỗi: mascot nghiêng + nền đỏ nhạt — đọc được tông trước cả khi đọc chữ.
  if (tone === "error") {
    return (
      <div className="rounded-xl border-2 border-ink bg-lose-wash p-4 shadow-pop-sm">
        <MascotState kind="error" inline title={title}>
          {children}
        </MascotState>
      </div>
    );
  }

  return (
    <div className="flex gap-3 rounded-xl border-2 border-ink bg-sky-100 p-4 shadow-pop-sm">
      <span className="text-royal">
        <InfoIcon />
      </span>
      <div className="min-w-0">
        <p className="font-display font-extrabold text-ink">{title}</p>
        {children ? (
          <div className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Hiển thị lỗi gọi API một cách thân thiện thay vì làm sập trang. */
export function ErrorNotice({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Lỗi không xác định.";
  return (
    <Notice tone="error" title="Không tải được dữ liệu">
      <p>{message}</p>
      <p className="mt-2">
        Kiểm tra FOOTBALL_DATA_TOKEN trong .env.local. Gói free của
        football-data.org giới hạn 10 request mỗi phút và chỉ hỗ trợ 12 giải.
      </p>
    </Notice>
  );
}

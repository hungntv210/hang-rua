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

function ErrorIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
      <path
        fillRule="evenodd"
        d="M9.401 3.003c.868-1.5 3.03-1.5 3.898 0l7.148 12.373c.868 1.5-.217 3.374-1.949 3.374H4.202c-1.732 0-2.817-1.874-1.949-3.374L9.4 3.003ZM11 6.75a1 1 0 1 0-2 0v4.5a1 1 0 1 0 2 0v-4.5Zm-1 8.25a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Notice({ title, children, tone = "info" }: NoticeProps) {
  const toneClass =
    tone === "error"
      ? "border-crimson/40 bg-crimson-wash text-crimson"
      : "border-grid bg-abyss text-electric";

  return (
    <div className={`relative flex gap-3 overflow-hidden rounded-sm border p-4 ${toneClass}`}>
      {/* Vạch màu ở cạnh trái: đọc được tông của thông báo trước cả khi đọc chữ. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-0.5 ${
          tone === "error" ? "bg-crimson" : "bg-electric"
        }`}
      />
      {tone === "error" ? <ErrorIcon /> : <InfoIcon />}
      <div className="min-w-0">
        <p className="font-medium text-ghost">{title}</p>
        {children ? (
          <div className="mt-1 text-sm leading-relaxed text-mist">{children}</div>
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

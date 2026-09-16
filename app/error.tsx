"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="space-y-3 rounded border border-crimson/40 bg-crimson-wash p-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ghost">
          Có lỗi xảy ra
        </h1>
        <p className="text-sm text-mist">
          {error.message || "Lỗi không xác định khi hiển thị trang."}
        </p>
        {error.digest ? (
          <p className="text-xs text-mist">Mã lỗi: {error.digest}</p>
        ) : null}
        <button type="button" onClick={reset} className="tab">
          Thử lại
        </button>
      </div>
    </div>
  );
}

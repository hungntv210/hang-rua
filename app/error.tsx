"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { MascotState } from "@/components/ui/MascotState";

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
      <div className="space-y-5 rounded-2xl border-2 border-ink bg-lose-wash p-6 shadow-pop">
        <MascotState kind="error" title="Rùa vấp rồi, có lỗi xảy ra">
          <p>{error.message || "Lỗi không xác định khi hiển thị trang."}</p>
          {error.digest ? <p className="mt-1 text-xs">Mã lỗi: {error.digest}</p> : null}
        </MascotState>
        <div className="flex justify-center">
          <Button onClick={reset}>Thử lại</Button>
        </div>
      </div>
    </div>
  );
}

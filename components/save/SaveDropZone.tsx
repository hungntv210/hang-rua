"use client";

import { useRef, useState } from "react";

import { MascotState } from "@/components/ui/MascotState";
import { formatBytes } from "@/lib/save/format";
import { FILE_LIMITS } from "@/lib/save/heuristics";

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
  /** 0–1 khi đang quét, null khi rảnh. */
  progress: number | null;
  /** Thư mục chứa save; mặc định là của FC 26. */
  folder?: string;
}

/**
 * Vùng thả file.
 *
 * Không đặt `accept` cho input: file save không có phần mở rộng cố định
 * (`CmMgrC...` trần trụi), lọc theo đuôi chỉ tổ khiến file thật không chọn được.
 */
export function SaveDropZone({ onFile, busy, progress, folder = "Documents\\FC 26\\settings" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  function accept(file: File | undefined | null) {
    if (!file) return;
    if (file.size > FILE_LIMITS.maxBytes) {
      setRejected(
        `File ${formatBytes(file.size)} vượt trần ${formatBytes(FILE_LIMITS.maxBytes)}. Trình duyệt sẽ hết bộ nhớ trước khi parser đọc xong.`,
      );
      return;
    }
    setRejected(null);
    onFile(file);
  }

  return (
    <section className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) accept(event.dataTransfer.files?.[0]);
        }}
        className={`rounded-3xl border-[3px] border-dashed border-ink p-8 text-center sm:p-12 ${
          dragging
            ? "bg-aqua-100"
            : "pop-halftone bg-sky-100"
        }`}
      >
        <p className="font-display text-2xl font-extrabold text-ink">
          Thả file save Career Mode vào đây
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Tên file thường có dạng <code className="rounded bg-white px-1 font-bold text-ink">CmMgrC…</code>,
          nằm trong thư mục <code className="rounded bg-white px-1 font-bold text-ink">{folder}</code>.
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="btn-primary mt-5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Đang đọc…" : "Chọn file từ máy"}
        </button>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            accept(event.target.files?.[0]);
            // Xoá giá trị để chọn lại đúng file đó lần nữa vẫn kích hoạt onChange.
            event.target.value = "";
          }}
        />

        <p className="mt-4 text-xs text-ink-soft">
          File được đọc hoàn toàn trên máy bạn, trong một Web Worker — không có
          byte nào được gửi lên server.
        </p>
      </div>

      {progress !== null ? (
        <div
          className="plate p-3"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <MascotState kind="loading" inline title="Rùa đang đọc file…" />
          <div className="mb-2 mt-3 flex items-center justify-between text-xs text-ink-soft">
            <span>Đang quét cấu trúc file</span>
            <span className="tabular-nums">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-white">
            <div
              className="h-full origin-left bg-royal transition-transform duration-150"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        </div>
      ) : null}

      {rejected ? (
        <p role="alert" className="rounded-xl border-2 border-ink bg-lose-wash p-3 text-sm font-bold text-lose shadow-pop-sm">
          {rejected}
        </p>
      ) : null}
    </section>
  );
}

"use client";

import { useRef, useState } from "react";

import { formatBytes } from "@/lib/save/format";
import { FILE_LIMITS } from "@/lib/save/heuristics";

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
  /** 0–1 khi đang quét, null khi rảnh. */
  progress: number | null;
}

/**
 * Vùng thả file.
 *
 * Không đặt `accept` cho input: file save không có phần mở rộng cố định
 * (`CmMgrC...` trần trụi), lọc theo đuôi chỉ tổ khiến file thật không chọn được.
 */
export function SaveDropZone({ onFile, busy, progress }: Props) {
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
        className={`rounded border-2 border-dashed p-8 text-center transition-colors duration-200 sm:p-12 ${
          dragging
            ? "border-electric bg-electric-wash"
            : "border-grid bg-abyss hover:border-electric/50"
        }`}
      >
        <p className="font-display text-xl font-semibold text-ghost">
          Thả file save Career Mode vào đây
        </p>
        <p className="mt-2 text-sm text-mist">
          Tên file thường có dạng <code className="font-mono">CmMgrC…</code>,
          nằm trong thư mục <code className="font-mono">Documents\FC 26\settings</code>.
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

        <p className="mt-4 text-xs text-mist">
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
          <div className="mb-2 flex items-center justify-between text-xs text-mist">
            <span>Đang quét cấu trúc file</span>
            <span className="font-mono">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-abyss-300">
            <div
              className="h-full bg-electric transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {rejected ? (
        <p className="rounded border border-crimson/40 bg-crimson-wash p-3 text-sm text-crimson">
          {rejected}
        </p>
      ) : null}
    </section>
  );
}

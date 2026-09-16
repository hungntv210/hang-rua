"use client";

import { useState } from "react";

import { formatBytes, formatCount, formatOffset } from "@/lib/save/format";
import { HIGH_ENTROPY_THRESHOLD } from "@/lib/save/heuristics";
import type { SaveUnknownRegion } from "@/lib/save/types";

const PAGE_SIZE = 50;

/**
 * Các vùng parser không đọc được.
 *
 * Đây là phần trung thực nhất của trang: thay vì im lặng bỏ qua, mỗi vùng được
 * ghi rõ nằm ở đâu, dài bao nhiêu, entropy bao nhiêu, và 32 byte đầu ra sao —
 * đủ để mở hex editor tới đúng chỗ đó mà điều tra tiếp.
 *
 * Entropy ≥ 7,5 bit/byte gần như chắc chắn là dữ liệu đã nén hoặc mã hoá, tức
 * không phải TLV bị parser bỏ sót. Entropy thấp mà vẫn không parse được thì
 * ngược lại: rất đáng nghi là một cấu trúc khác chưa được nhận ra.
 */
export function SaveUnknownList({ regions }: { regions: SaveUnknownRegion[] }) {
  const [shown, setShown] = useState(PAGE_SIZE);

  if (regions.length === 0) {
    return (
      <p className="plate p-6 text-center text-sm text-mist">
        Không có vùng nào đủ lớn để đáng liệt kê.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-mist">
        {formatCount(regions.length)} vùng lớn nhất, sắp theo độ dài giảm dần.
      </p>

      {regions.slice(0, shown).map((region) => {
        const highEntropy = region.entropy >= HIGH_ENTROPY_THRESHOLD;
        return (
          <article key={region.offset} className="plate space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-mono text-xs text-mist">
                {formatOffset(region.offset)}
              </span>
              <span className="font-medium text-ghost">{formatBytes(region.length)}</span>
              <span
                className={
                  highEntropy
                    ? "rounded bg-sakura-wash px-1.5 py-0.5 text-xs font-medium text-sakura"
                    : "text-xs text-mist"
                }
              >
                entropy {region.entropy.toFixed(2)} bit/byte
                {highEntropy ? " — nghi đã nén" : ""}
              </span>
              {region.compressionGuess ? (
                <span className="rounded bg-electric-wash px-1.5 py-0.5 text-xs font-medium text-electric">
                  magic khớp {region.compressionGuess}
                </span>
              ) : null}
            </div>
            <p className="break-all font-mono text-[11px] leading-relaxed text-mist">
              {region.hexPreview}
            </p>
          </article>
        );
      })}

      {shown < regions.length ? (
        <button
          type="button"
          onClick={() => setShown((value) => value + PAGE_SIZE)}
          className="tab w-full justify-center"
        >
          Xem thêm {formatCount(Math.min(PAGE_SIZE, regions.length - shown))} vùng
        </button>
      ) : null}
    </div>
  );
}

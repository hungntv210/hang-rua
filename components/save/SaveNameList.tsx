"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { formatCount } from "@/lib/save/format";
import type { SaveFieldStat } from "@/lib/save/types";

const PAGE_SIZE = 100;

/**
 * Danh mục tên field và số lần xuất hiện.
 *
 * Đây là bảng đáng đọc nhất khi đi giải mã tiếp: tên xuất hiện hàng chục nghìn
 * lần gần như chắc chắn là field thật của một bản ghi lặp lại (mỗi cầu thủ một
 * lần), còn tên chỉ xuất hiện đúng một lần thì nhiều khả năng là dương tính giả
 * do máy quét bắt nhầm giữa vùng nhiễu.
 */
export function SaveNameList({ stats }: { stats: SaveFieldStat[] }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return stats;
    return stats.filter((stat) => stat.name.toLowerCase().includes(needle));
  }, [stats, deferredQuery]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setShown(PAGE_SIZE);
        }}
        placeholder="Tìm tên field…"
        className="focus-ring min-h-[40px] w-full rounded border border-grid bg-abyss px-3 py-2 text-sm text-ghost placeholder:text-mist"
      />

      <p className="text-xs text-mist">
        {formatCount(filtered.length)} tên field khác nhau, sắp theo số lần xuất
        hiện.
      </p>

      <div className="plate overflow-x-auto">
        <div className="min-w-[36rem]">
          <div className="grid grid-cols-[minmax(12rem,2fr)_6rem_8rem_minmax(8rem,1.5fr)] gap-3 border-b border-grid bg-abyss-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-mist">
            <span>Tên field</span>
            <span className="text-right">Số lần</span>
            <span>Kiểu</span>
            <span>Giá trị mẫu</span>
          </div>

          {filtered.slice(0, shown).map((stat) => (
            <div
              key={stat.name}
              className="grid grid-cols-[minmax(12rem,2fr)_6rem_8rem_minmax(8rem,1.5fr)] gap-3 border-b border-grid px-3 py-1.5 text-sm"
            >
              <span className="truncate text-ghost">{stat.name}</span>
              <span className="text-right font-mono text-xs text-mist">
                {formatCount(stat.count)}
              </span>
              <span className="truncate text-xs text-mist">
                {stat.types.join(", ")}
              </span>
              <span className="truncate text-mist">{stat.sample}</span>
            </div>
          ))}

          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-mist">
              Không có tên nào khớp.
            </p>
          ) : null}
        </div>
      </div>

      {shown < filtered.length ? (
        <button
          type="button"
          onClick={() => setShown((value) => value + PAGE_SIZE)}
          className="tab w-full justify-center"
        >
          Xem thêm {formatCount(Math.min(PAGE_SIZE, filtered.length - shown))} tên
        </button>
      ) : null}
    </div>
  );
}

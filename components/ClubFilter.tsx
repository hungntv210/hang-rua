"use client";

import { useEffect, useMemo, useState } from "react";

import { FAVORITES_STORAGE_PREFIX } from "@/lib/config";
import type { ClubOption } from "@/lib/types";

interface Props {
  /** Slug giải — mỗi giải có danh sách CLB yêu thích riêng. */
  competitionSlug: string;
  clubs: ClubOption[];
  /** Nhận lại danh sách id đã chọn; rỗng nghĩa là không lọc. */
  onChange: (selectedIds: number[]) => void;
}

/**
 * Bộ chọn CLB yêu thích. Lưu vào localStorage nên lần sau vào lại vẫn còn.
 *
 * Lọc hoàn toàn ở phía client: server đã trả về sẵn toàn bộ trận của giải
 * (một request đã được ISR cache), nên bấm chọn hoặc bỏ chọn không tốn thêm
 * request nào và phản hồi tức thì.
 */
export function ClubFilter({ competitionSlug, clubs, onChange }: Props) {
  const storageKey = `${FAVORITES_STORAGE_PREFIX}${competitionSlug}`;
  const [selected, setSelected] = useState<number[]>([]);
  const [ready, setReady] = useState(false);

  // Đọc localStorage sau khi mount, không đọc lúc render đầu: server và client
  // phải ra cùng một HTML, nếu không React sẽ báo hydration mismatch.
  useEffect(() => {
    let restored: number[] = [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          restored = parsed.filter((v): v is number => typeof v === "number");
        }
      }
    } catch {
      // localStorage bị chặn (chế độ riêng tư) hoặc dữ liệu hỏng — bỏ qua,
      // coi như chưa chọn CLB nào.
    }
    setSelected(restored);
    setReady(true);
    onChange(restored);
    // Chỉ chạy một lần cho mỗi giải; onChange đổi tham chiếu mỗi lần render của
    // component cha nên không đưa vào deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function toggle(id: number) {
    const next = selected.includes(id)
      ? selected.filter((v) => v !== id)
      : [...selected, id];
    setSelected(next);
    onChange(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Không lưu được thì vẫn cho lọc trong phiên này.
    }
  }

  function clearAll() {
    setSelected([]);
    onChange([]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // bỏ qua
    }
  }

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  if (clubs.length === 0) return null;

  return (
    <section className="plate space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="eyebrow">Câu lạc bộ yêu thích</h3>
        {ready && selected.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="focus-ring rounded px-2 py-1 text-xs font-medium text-electric transition-colors hover:text-electric"
          >
            Bỏ chọn tất cả ({selected.length})
          </button>
        ) : (
          <span className="text-xs text-mist">
            Chưa chọn — đang hiện tất cả
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {clubs.map((club) => {
          const active = selectedSet.has(club.id);
          return (
            <button
              key={club.id}
              type="button"
              onClick={() => toggle(club.id)}
              aria-pressed={active}
              className={`focus-ring inline-flex min-h-[36px] items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors duration-150 ${
                active
                  ? "border-electric bg-electric font-semibold text-ghost"
                  : "border-grid bg-abyss text-mist hover:border-electric/50 hover:bg-abyss-200 hover:text-ghost"
              }`}
            >
              {club.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={club.logo}
                  alt=""
                  width={16}
                  height={16}
                  loading="lazy"
                  className="h-4 w-4 shrink-0 object-contain"
                />
              ) : null}
              <span className="max-w-[9rem] truncate">{club.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

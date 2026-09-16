"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";

import { formatCount, formatOffset } from "@/lib/save/format";
import { reinterpret } from "@/lib/save/reinterpret";
import type { SaveField, SaveFieldStat, SaveValueType } from "@/lib/save/types";

const ROW_HEIGHT = 34;
const VIEWPORT_HEIGHT = 560;
/** Số dòng vẽ thừa trên/dưới khung nhìn để cuộn nhanh không thấy khoảng trắng. */
const OVERSCAN = 8;

const TYPE_LABELS: Record<SaveValueType, string> = {
  string: "chuỗi",
  int32: "int32",
  float32: "float32",
  none: "cụt",
};

const GRID = "grid-cols-[9rem_minmax(9rem,1fr)_5rem_minmax(8rem,1.2fr)_11rem]";

interface Props {
  fields: SaveField[];
  fieldStats: SaveFieldStat[];
}

/**
 * Bảng field có tìm kiếm, lọc và ảo hoá.
 *
 * Ảo hoá tự viết thay vì kéo thêm thư viện: dự án đang zero-dependency, và toàn
 * bộ nhu cầu ở đây gói gọn trong "dòng cao cố định, vẽ phần đang nhìn thấy".
 *
 * Lọc chạy trên `useDeferredValue` nên gõ vào ô tìm kiếm không bị khựng khi
 * danh sách có hàng trăm nghìn dòng: React giữ kết quả cũ trên màn hình cho tới
 * khi lượt lọc mới xong.
 */
export function SaveFieldTable({ fields, fieldStats }: Props) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SaveValueType | "all">("all");
  const [nameFilter, setNameFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<SaveField | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle && type === "all" && !nameFilter) return fields;

    return fields.filter((field) => {
      if (nameFilter && field.name !== nameFilter) return false;
      if (type !== "all" && field.type !== type) return false;
      if (!needle) return true;
      return (
        field.name.toLowerCase().includes(needle) ||
        field.display.toLowerCase().includes(needle)
      );
    });
  }, [fields, deferredQuery, type, nameFilter]);

  const firstVisible = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
  const visible = filtered.slice(firstVisible, firstVisible + visibleCount);

  function resetScroll() {
    setScrollTop(0);
    viewportRef.current?.scrollTo({ top: 0 });
  }

  return (
    <div className="space-y-4">
      <div className="plate space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetScroll();
            }}
            placeholder="Tìm theo tên field hoặc giá trị…"
            className="focus-ring min-h-[40px] flex-1 rounded border border-grid bg-abyss px-3 py-2 text-sm text-ghost placeholder:text-mist"
          />

          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as SaveValueType | "all");
              resetScroll();
            }}
            className="focus-ring min-h-[40px] rounded border border-grid bg-abyss px-3 py-2 text-sm text-ghost"
          >
            <option value="all">Mọi kiểu</option>
            {(Object.keys(TYPE_LABELS) as SaveValueType[]).map((value) => (
              <option key={value} value={value}>
                {TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {nameFilter ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-mist">Đang lọc theo tên:</span>
            <button
              type="button"
              onClick={() => {
                setNameFilter(null);
                resetScroll();
              }}
              className="focus-ring rounded border border-electric bg-electric px-2 py-1 text-xs font-medium text-ghost"
            >
              {nameFilter} ✕
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <span className="eyebrow self-center pr-1">Tên phổ biến</span>
            {fieldStats.slice(0, 12).map((stat) => (
              <button
                key={stat.name}
                type="button"
                onClick={() => {
                  setNameFilter(stat.name);
                  resetScroll();
                }}
                title={`${formatCount(stat.count)} lần · ${stat.types.join(", ")}`}
                className="focus-ring rounded border border-grid bg-abyss px-2 py-1 text-xs text-mist transition-colors hover:border-electric/50 hover:text-ghost"
              >
                <span className="max-w-[12rem] truncate align-middle">{stat.name}</span>
                <span className="ml-1.5 text-mist">{formatCount(stat.count)}</span>
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-mist">
          Hiện {formatCount(filtered.length)} / {formatCount(fields.length)} field.
          Bấm một dòng để xem các cách đọc khác của cùng chuỗi byte.
        </p>
      </div>

      <div className="plate overflow-x-auto">
        <div className="min-w-[52rem]">
          {/* Hàng tiêu đề nằm NGOÀI khung cuộn dọc: đặt sticky bên trong một
              phần tử overflow sẽ bám vào chính nó và không bao giờ dính. */}
          <div
            className={`grid ${GRID} gap-3 border-b border-grid bg-abyss-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-mist`}
          >
            <span>Offset</span>
            <span>Tên field</span>
            <span>Kiểu</span>
            <span>Giá trị</span>
            <span>Hex giá trị</span>
          </div>

          <div
            ref={viewportRef}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            style={{ height: VIEWPORT_HEIGHT }}
            className="overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-mist">
                Không có field nào khớp bộ lọc.
              </p>
            ) : (
              <div style={{ height: filtered.length * ROW_HEIGHT }} className="relative">
                <div
                  style={{ transform: `translateY(${firstVisible * ROW_HEIGHT}px)` }}
                  className="absolute inset-x-0 top-0"
                >
                  {visible.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => setSelected(field)}
                      style={{ height: ROW_HEIGHT }}
                      className={`grid w-full ${GRID} items-center gap-3 border-b border-grid px-3 text-left text-sm transition-colors hover:bg-abyss-200 ${
                        selected?.id === field.id ? "bg-electric-wash" : ""
                      }`}
                    >
                      <span className="font-mono text-xs text-mist">
                        {field.offset.toString(16).toUpperCase()}
                      </span>
                      <span className="truncate text-ghost">{field.name}</span>
                      <span className="text-xs text-mist">
                        {TYPE_LABELS[field.type]}
                      </span>
                      <span className="truncate text-mist">{field.display}</span>
                      <span className="truncate font-mono text-[11px] text-mist">
                        {field.rawHex}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selected ? <FieldDetail field={selected} /> : null}
    </div>
  );
}

/**
 * Đọc lại cùng chuỗi byte theo mọi kiểu.
 *
 * Kiểu ở cột bên trên chỉ là phỏng đoán; bảng này để bạn tự phán xử. Tất cả
 * tính từ `rawHex` đã lưu sẵn nên không cần đọc lại file.
 */
function FieldDetail({ field }: { field: SaveField }) {
  const alt = reinterpret(field.rawHex);

  return (
    <section className="plate space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-ghost">{field.name}</h3>
        <span className="font-mono text-xs text-mist">
          tên @ {formatOffset(field.offset)} · giá trị @ {formatOffset(field.valueOffset)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Reading label="Kiểu suy đoán" value={`${TYPE_LABELS[field.type]} — ${field.display}`} />
        <Reading label="int32 LE" value={alt.int32 === null ? "—" : String(alt.int32)} />
        <Reading label="uint32 LE" value={alt.uint32 === null ? "—" : String(alt.uint32)} />
        <Reading
          label="float32 LE"
          value={alt.float32 === null ? "—" : alt.float32.toPrecision(7)}
        />
        <Reading label="int16 LE" value={alt.int16 === null ? "—" : String(alt.int16)} />
        <Reading label="ASCII" value={alt.ascii || "—"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Reading label="8 byte giá trị" value={field.rawHex || "—"} mono />
        <Reading
          label="4 byte trước tên (nghi là byte đánh dấu kiểu)"
          value={field.markerHex || "—"}
          mono
        />
      </div>
    </section>
  );
}

function Reading({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded border border-grid bg-abyss-200 p-2">
      <p className="eyebrow">{label}</p>
      <p className={`mt-0.5 break-all text-sm text-ghost ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </p>
    </div>
  );
}

"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { formatCount, formatOffset } from "@/lib/save/format";
import type { SaveLooseString, SaveStringToken } from "@/lib/save/types";

const PAGE_SIZE = 200;

/**
 * Hai nhóm chuỗi, ĐỘ TIN CẬY KHÁC HẲN NHAU nên không được trộn:
 *
 * 1. Token chuỗi — chính file khai báo độ dài (`01 [u32] [chuỗi]`). Chắc chắn
 *    là chuỗi thật. Thường là tên vùng dữ liệu, ví dụ "DataMananger".
 * 2. Chuỗi rời — parser tự dò ra giữa vùng nhị phân, không có độ dài khai báo.
 *    Tên đội ("Fluminense") nằm ở đây vì trong file chúng là chuỗi NUL-pad
 *    trong bảng cố định. Nhóm này có lẫn dương tính giả.
 */
export function SaveStringList({
  tokens,
  strings,
}: {
  tokens: SaveStringToken[];
  strings: SaveLooseString[];
}) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);

  const needle = deferredQuery.trim().toLowerCase();

  const filteredTokens = useMemo(() => {
    if (!needle) return tokens;
    return tokens.filter((item) => item.text.toLowerCase().includes(needle));
  }, [tokens, needle]);

  const filtered = useMemo(() => {
    if (!needle) return strings;
    return strings.filter((item) => item.text.toLowerCase().includes(needle));
  }, [strings, needle]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setShown(PAGE_SIZE);
        }}
        placeholder="Tìm chuỗi — thử tên một CLB trong save của bạn…"
        className="focus-ring min-h-[40px] w-full rounded border border-grid bg-abyss px-3 py-2 text-sm text-ghost placeholder:text-mist"
      />

      {filteredTokens.length > 0 ? (
        <section className="space-y-2">
          <h3 className="eyebrow">
            Token chuỗi — file tự khai báo độ dài ({formatCount(filteredTokens.length)})
          </h3>
          <div className="plate divide-y divide-grid">
            {filteredTokens.slice(0, 50).map((item) => (
              <div
                key={item.offset}
                className="flex items-baseline justify-between gap-4 px-3 py-1.5 text-sm"
              >
                <span className="break-all text-ghost">{item.text}</span>
                <span className="shrink-0 font-mono text-[11px] text-mist">
                  {formatOffset(item.offset)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <h3 className="eyebrow pt-2">
        Chuỗi rời — parser tự dò trong vùng nhị phân
      </h3>
      <p className="text-xs text-mist">
        Hiện {formatCount(Math.min(shown, filtered.length))} /{" "}
        {formatCount(filtered.length)} chuỗi. Nhóm này có lẫn dương tính giả —
        tên đội và tên cầu thủ nằm lẫn trong đây.
      </p>

      <div className="plate divide-y divide-grid">
        {filtered.slice(0, shown).map((item) => (
          <div
            key={item.offset}
            className="flex items-baseline justify-between gap-4 px-3 py-1.5 text-sm"
          >
            <span className="break-all text-ghost">{item.text}</span>
            <span className="shrink-0 font-mono text-[11px] text-mist">
              {formatOffset(item.offset)}
            </span>
          </div>
        ))}
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-mist">
            Không có chuỗi nào khớp.
          </p>
        ) : null}
      </div>

      {shown < filtered.length ? (
        <button
          type="button"
          onClick={() => setShown((value) => value + PAGE_SIZE)}
          className="tab w-full justify-center"
        >
          Xem thêm {formatCount(Math.min(PAGE_SIZE, filtered.length - shown))} chuỗi
        </button>
      ) : null}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

import type { SavePlayer } from "@/lib/save/types";

export const POT_NOTE = "POT tại thời điểm lưu — dynamic potential, thay đổi theo phong độ";
export const AGE_NOTE = "tuổi ước tính, sai ±1";

export interface ExtraColumn {
  label: string;
  title?: string;
  render: (p: SavePlayer) => ReactNode;
}

interface Props {
  players: SavePlayer[];
  jerseyOf?: Map<number, number>;
  extra?: ExtraColumn[];
  /** Ô đá chính, để đánh dấu. */
  starterIds?: Set<number>;
  empty: string;
  maxHeight?: string;
}

/**
 * Bảng cầu thủ dùng chung cho các tab FC27.
 *
 * Tách khỏi bảng FC26 vì nghĩa khác: CLB ở đây là CLB hiện tại, POT là dynamic
 * potential, không có cột "giá trị ước tính".
 */
export function Fc27Table({ players, jerseyOf, extra = [], starterIds, empty, maxHeight = "28rem" }: Props) {
  if (players.length === 0) {
    return <p className="rounded-sm border border-dashed border-grid px-3 py-4 text-xs text-mist-dim">{empty}</p>;
  }
  return (
    <div className="overflow-auto rounded-sm border border-grid bg-abyss/60" style={{ maxHeight }}>
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="sticky top-0 z-10 bg-abyss-200 text-mist-dim">
            {jerseyOf ? <th scope="col" className="th-cell text-center">Số</th> : null}
            <th scope="col" className="th-cell w-full">Cầu thủ</th>
            <th scope="col" className="th-cell text-center">VT</th>
            <th scope="col" className="th-cell text-center" title={AGE_NOTE}>Tuổi ≈</th>
            <th scope="col" className="th-cell text-center">OVR</th>
            <th scope="col" className="th-cell text-center" title={POT_NOTE}>POT*</th>
            {extra.map((c) => (
              <th key={c.label} scope="col" className="th-cell whitespace-nowrap" title={c.title}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.playerId} className="border-t border-grid/60 transition-colors hover:bg-abyss-300/60">
              {jerseyOf ? (
                <td className="px-2 py-1.5 text-center font-mono text-xs text-mist">{jerseyOf.get(p.playerId) ?? "–"}</td>
              ) : null}
              <td className="px-2 py-1.5">
                <span className={`text-[13px] ${p.nameSource === "database" || p.nameSource === "newgen" ? "text-ghost" : "text-mist"}`}>
                  {p.name}
                </span>
                {starterIds?.has(p.playerId) ? (
                  <span className="ml-1.5 rounded-[2px] bg-electric-wash px-1 font-mono text-[9px] uppercase tracking-wide text-electric">
                    XI
                  </span>
                ) : null}
                {p.nation ? <span className="ml-2 font-mono text-[10px] text-mist-dim">{p.nation}</span> : null}
              </td>
              <td className="px-2 py-1.5 text-center font-mono text-xs text-mist">{p.position}</td>
              <td className="px-2 py-1.5 text-center font-mono text-xs text-mist">{p.age ?? "–"}</td>
              <td className="px-2 py-1.5 text-center font-mono text-xs text-ghost">{p.overall ?? "–"}</td>
              <td className="px-2 py-1.5 text-center font-mono text-xs text-ghost">{p.potential ?? "–"}</td>
              {extra.map((c) => (
                <td key={c.label} className="whitespace-nowrap px-2 py-1.5 text-xs text-mist">
                  {c.render(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Chú thích cuối bảng — nói rõ POT, tuổi và dấu tên. */
export function TableNotes() {
  return (
    <p className="text-[11px] leading-relaxed text-mist-dim">
      * {POT_NOTE}. Tuổi là {AGE_NOTE} (save FC27 không lưu ngày hiện tại trong game). Tên có dấu ≈ là tên suy ra từ kho
      tên FC26, có thể chưa chính xác; #số là cầu thủ chưa tra được tên.
    </p>
  );
}

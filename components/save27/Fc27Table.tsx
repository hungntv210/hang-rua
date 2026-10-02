"use client";

import type { ReactNode } from "react";

import { PlayerAvatar, StatBadge } from "@/components/save/squad-shared";
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
    return <p className="rounded-md border-2 border-dashed border-ink/40 px-3 py-4 text-xs text-ink-mute">{empty}</p>;
  }
  return (
    <div className="overflow-auto rounded-xl border-2 border-ink bg-white" style={{ maxHeight }}>
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="sticky top-0 z-10 bg-sky text-ink">
            {jerseyOf ? <th scope="col" className="th-cell text-center">Số</th> : null}
            <th scope="col" className="th-cell w-full">Cầu thủ</th>
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
            <tr key={p.playerId} className="border-t border-ink/15 hover:bg-sky-100">
              {jerseyOf ? (
                <td className="px-2 py-1.5 text-center tabular-nums text-xs text-ink-soft">{jerseyOf.get(p.playerId) ?? "–"}</td>
              ) : null}
              <td className="px-2 py-1.5">
                <span className="flex items-center gap-2">
                  <PlayerAvatar position={p.position} size={30} />
                  <span className="min-w-0">
                <span className={`text-[13px] ${p.nameSource === "database" || p.nameSource === "newgen" ? "text-ink" : "text-ink-soft"}`}>
                  {p.name}
                </span>
                {starterIds?.has(p.playerId) ? (
                  <span className="ml-1.5 rounded-md bg-royal-100 px-1 tabular-nums text-[9px] uppercase tracking-wide text-royal">
                    XI
                  </span>
                ) : null}
                {p.nation ? <span className="ml-2 tabular-nums text-[10px] text-ink-mute">{p.nation}</span> : null}
                </span>
                </span>
              </td>
              <td className="px-2 py-1.5 text-center tabular-nums text-xs text-ink-soft">{p.age ?? "–"}</td>
              <td className="px-2 py-1.5 text-center"><StatBadge value={p.overall} /></td>
              <td className="px-2 py-1.5 text-center"><StatBadge value={p.potential} /></td>
              {extra.map((c) => (
                <td key={c.label} className="whitespace-nowrap px-2 py-1.5 text-xs text-ink-soft">
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
    <p className="text-[11px] leading-relaxed text-ink-mute">
      * {POT_NOTE}. Tuổi là {AGE_NOTE} (save FC27 không lưu ngày hiện tại trong game). Tên có dấu ≈ là tên suy ra từ kho
      tên FC26, có thể chưa chính xác; #số là cầu thủ chưa tra được tên.
    </p>
  );
}

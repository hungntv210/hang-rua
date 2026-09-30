"use client";

import { useMemo, useState } from "react";

import { GROUP_LABEL, GROUP_ORDER, type PositionGroup } from "@/lib/fc26/positions";
import { EMPTY_CRITERIA, filterPlayers, type ScoutCriteria } from "@/lib/fc26/scout";
import { Notice } from "@/components/Notice";
import type { Fc27Career } from "@/lib/fc27/read";
import type { SavePlayer } from "@/lib/save/types";

import { Fc27Table, POT_NOTE, TableNotes } from "./Fc27Table";

/** Vẽ hơn chừng này dòng một lúc thì trình duyệt ì; bảng nói rõ là đang cắt. */
const SHOW = 300;

const toNum = (v: string): number | null => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** `players` đã được lọc bằng `scoutPool`: không có người của CLB bạn. */
export function ScoutTab({ players, career }: { players: SavePlayer[]; career: Fc27Career }) {
  const [c, setC] = useState<ScoutCriteria>(EMPTY_CRITERIA);
  const result = useMemo(
    () => filterPlayers(players, c).sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0)),
    [players, c],
  );

  const num = (key: "minAge" | "maxAge" | "minOverall" | "minPotential" | "minGrowth", label: string, title?: string) => (
    <label className="flex flex-col gap-1 text-[11px] text-mist-dim" title={title}>
      {label}
      <input
        inputMode="numeric"
        className="w-20 rounded-sm border border-grid bg-abyss px-2 py-1 font-mono text-xs text-ghost"
        value={c[key] ?? ""}
        onChange={(e) => setC({ ...c, [key]: toNum(e.target.value) })}
      />
    </label>
  );

  const toggle = (g: PositionGroup) =>
    setC({ ...c, groups: c.groups.includes(g) ? c.groups.filter((x) => x !== g) : [...c.groups, g] });

  if (career.errors.scout) {
    return (
      <Notice tone="error" title="Không đọc được danh sách cầu thủ">
        {career.errors.scout}
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      {career.warnings.scout?.map((w) => (
        <Notice key={w} title="Cần lưu ý">
          {w}
        </Notice>
      ))}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] text-mist-dim">
          Tìm (tên, CLB, quốc tịch, vị trí, ID)
          <input
            className="w-64 rounded-sm border border-grid bg-abyss px-2 py-1 text-xs text-ghost"
            value={c.query}
            onChange={(e) => setC({ ...c, query: e.target.value })}
          />
        </label>
        {num("minAge", "Tuổi từ")}
        {num("maxAge", "đến")}
        {num("minOverall", "OVR ≥")}
        {num("minPotential", "POT ≥", POT_NOTE)}
        {num("minGrowth", "POT − OVR ≥", POT_NOTE)}
        <div className="flex gap-1">
          {GROUP_ORDER.map((g) => (
            <button
              key={g}
              type="button"
              className={`tab ${c.groups.includes(g) ? "tab-active" : ""}`}
              aria-pressed={c.groups.includes(g)}
              onClick={() => toggle(g)}
            >
              {GROUP_LABEL[g].vi}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-mist-dim">
        {result.length.toLocaleString("vi-VN")} cầu thủ khớp (không gồm đội một và học viện của bạn)
        {result.length > SHOW ? ` · hiện ${SHOW} người POT cao nhất` : ""}. CLB là CLB hiện tại trong save.
      </p>
      <Fc27Table
        players={result.slice(0, SHOW)}
        empty="Không cầu thủ nào khớp bộ lọc."
        maxHeight="36rem"
        extra={[{ label: "CLB", render: (p) => p.club ?? "–" }]}
      />
      <TableNotes />
    </div>
  );
}

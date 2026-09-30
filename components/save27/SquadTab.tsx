"use client";

import { useMemo } from "react";

import { Notice } from "@/components/Notice";
import { Pitch } from "@/components/save/Pitch";
import type { Lineup } from "@/lib/fc26/lineup";
import type { Fc27Career } from "@/lib/fc27/read";
import type { SavePlayer } from "@/lib/save/types";

import { Fc27Table, TableNotes } from "./Fc27Table";

interface Props {
  career: Fc27Career;
  lineup: Lineup | null;
  players: SavePlayer[];
  byId: Map<number, SavePlayer>;
  jerseyOf: Map<number, number>;
}

export function SquadTab({ career, lineup, players, byId, jerseyOf }: Props) {
  const squad = useMemo(
    () =>
      career.squad
        .map((l) => byId.get(l.playerId))
        .filter((p): p is SavePlayer => Boolean(p))
        .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)),
    [career.squad, byId],
  );
  const starterIds = useMemo(() => new Set(lineup?.slots.map((s) => s.playerId) ?? []), [lineup]);
  const captain = career.lineup?.captainId ? byId.get(career.lineup.captainId) : null;

  if (career.errors.squad) {
    return (
      <Notice tone="error" title="Không đọc được đội hình">
        {career.errors.squad}
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      {career.warnings.squad?.map((w) => (
        <Notice key={w} title="Cần lưu ý">
          {w}
        </Notice>
      ))}
      <p className="text-sm text-mist">
        <strong className="text-ghost">{career.club?.name}</strong>
        {lineup ? (
          <>
            {" "}· sơ đồ <strong className="text-ghost">{lineup.formationName}</strong> · team sheet “{lineup.sheetName}”
          </>
        ) : null}
        {captain ? <> · đội trưởng {captain.name}</> : null}
        <span className="text-mist-dim"> — đội hình thật người chơi đã xếp, đọc thẳng từ save.</span>
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        {lineup ? <Pitch lineup={lineup} players={players} jerseyOf={jerseyOf} /> : null}
        <div className="space-y-2">
          <h3 className="font-display text-sm font-semibold tracking-wide text-ghost">Cả đội ({squad.length})</h3>
          <Fc27Table players={squad} jerseyOf={jerseyOf} starterIds={starterIds} empty="Không có cầu thủ nào." />
          <TableNotes />
        </div>
      </div>
    </div>
  );
}

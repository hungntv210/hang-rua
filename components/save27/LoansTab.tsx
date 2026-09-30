"use client";

import { useMemo } from "react";

import { Notice } from "@/components/Notice";
import type { Fc27Career } from "@/lib/fc27/read";
import type { SavePlayer } from "@/lib/save/types";

import { Fc27Table, TableNotes } from "./Fc27Table";

const vnDate = (iso: string): string => iso.split("-").reverse().join("/");

export function LoansTab({ career, byId }: { career: Fc27Career; byId: Map<number, SavePlayer> }) {
  const loanOf = useMemo(() => new Map(career.loans.map((l) => [l.playerId, l])), [career.loans]);
  const players = useMemo(
    () => career.loans.map((l) => byId.get(l.playerId)).filter((p): p is SavePlayer => Boolean(p)),
    [career.loans, byId],
  );

  if (career.errors.loans) {
    return (
      <Notice tone="error" title="Không đọc được danh sách cho mượn">
        {career.errors.loans}
      </Notice>
    );
  }
  return (
    <div className="space-y-3">
      {career.warnings.loans?.map((w) => (
        <Notice key={w} title="Cần lưu ý">
          {w}
        </Notice>
      ))}
      <p className="text-sm text-mist">
        Cầu thủ của <strong className="text-ghost">{career.club?.name}</strong> đang cho mượn ({players.length})
      </p>
      <Fc27Table
        players={players}
        empty="Không có cầu thủ nào đang cho mượn."
        extra={[
          { label: "Đang ở", render: (p) => loanOf.get(p.playerId)?.atTeamName ?? "?" },
          { label: "Hết hạn", render: (p) => vnDate(loanOf.get(p.playerId)?.until ?? "") },
        ]}
      />
      <TableNotes />
    </div>
  );
}

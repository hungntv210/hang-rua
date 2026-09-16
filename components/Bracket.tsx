import { TeamBadge } from "@/components/TeamBadge";
import { aggregateScore, type BracketRound, type BracketTie } from "@/lib/bracket";
import { formatDate, isFinished, isLive, scoreOrKickoff } from "@/lib/format";
import type { Fixture } from "@/lib/types";

/** Tỷ số của lượt về, đảo lại theo thứ tự đội của lượt đi. */
function reverseScore(fixture: Fixture): string {
  if (!isLive(fixture) && !isFinished(fixture)) {
    return scoreOrKickoff(fixture);
  }
  const { home, away } = fixture.goals;
  return `${away ?? 0} - ${home ?? 0}`;
}

function TieCard({ tie }: { tie: BracketTie }) {
  const first = tie.legs[0];
  const totals = aggregateScore(tie);
  const allFinished = tie.legs.every(isFinished);

  const totalFor = (teamId: number) =>
    totals?.find((t) => t.teamId === teamId)?.goals ?? null;

  const homeTotal = totalFor(first.teams.home.id);
  const awayTotal = totalFor(first.teams.away.id);
  const twoLegs = tie.legs.length > 1;

  return (
    <li className="plate p-3">
      <div className="space-y-1">
        {[first.teams.home, first.teams.away].map((team) => {
          const total = totalFor(team.id);
          const other = team.id === first.teams.home.id ? awayTotal : homeTotal;
          const advancing =
            allFinished && total !== null && other !== null && total > other;

          return (
            <div
              key={team.id}
              className={`flex items-center justify-between gap-2 rounded px-1.5 py-1 ${
                advancing ? "bg-electric-wash" : ""
              }`}
            >
              <TeamBadge team={team} size={20} />
              <span
                className={`shrink-0 font-display text-base tabular-nums ${
                  advancing ? "font-bold text-electric" : "font-semibold text-mist"
                }`}
              >
                {total ?? "–"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 space-y-0.5 border-t border-grid pt-2 text-xs text-mist">
        {tie.legs.map((leg, index) => {
          // Ở lượt về, đội chủ nhà đổi chỗ. Xoay tỷ số về đúng thứ tự 2 dòng
          // tên đội phía trên, nếu không người đọc sẽ hiểu ngược kết quả.
          const swapped = leg.teams.home.id !== first.teams.home.id;
          const label = `Sân ${leg.teams.home.name}`;

          return (
            <div key={leg.fixture.id} className="flex justify-between gap-2">
              <span className="truncate" title={label}>
                {twoLegs ? `Lượt ${index + 1} · ` : ""}
                {formatDate(leg.fixture.date)}
              </span>
              <span className="shrink-0 tabular-nums" title={label}>
                {swapped ? reverseScore(leg) : scoreOrKickoff(leg)}
              </span>
            </div>
          );
        })}
      </div>
    </li>
  );
}

export function Bracket({ rounds }: { rounds: BracketRound[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((round) => (
        <section key={round.name} className="w-64 shrink-0 space-y-3">
          {/* Không dùng sticky ở đây: bracket bắt buộc phải cuộn ngang nên div
              cha luôn là scroll container, sticky dọc sẽ không bao giờ kích
              hoạt — chỉ tốn thêm một lớp stacking context vô ích. */}
          <h3 className="rounded border border-grid bg-abyss-300 px-3 py-2 font-display text-sm font-semibold tracking-tight text-ghost">
            {round.name}
          </h3>
          <ul className="space-y-3">
            {round.ties.map((tie) => (
              <TieCard key={tie.key} tie={tie} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

import { TeamBadge } from "@/components/TeamBadge";
import { isFinished, isLive, scoreOrKickoff, statusLabel } from "@/lib/format";
import type { Fixture } from "@/lib/types";

interface Props {
  fixture: Fixture;
  /** Hiện tên giải trong dòng phụ — dùng cho lịch của một đội đá nhiều giải. */
  showLeague?: boolean;
  /** Hiện tên vòng trong dòng phụ — tắt khi đã nhóm sẵn theo vòng. */
  showRound?: boolean;
  /** Hiện ngày trong dòng phụ — bật khi danh sách không nhóm theo ngày. */
  showDate?: boolean;
  dateLabel?: string;
}

/**
 * Một dòng trận đấu. Dùng chung cho danh sách theo ngày (lịch của Arsenal) và
 * cho accordion theo vòng (lịch của một giải).
 */
export function FixtureRow({
  fixture,
  showLeague = false,
  showRound = false,
  showDate = false,
  dateLabel,
}: Props) {
  const live = isLive(fixture);
  const finished = isFinished(fixture);

  const meta: string[] = [];
  if (showDate && dateLabel) meta.push(dateLabel);
  meta.push(statusLabel(fixture));
  if (showLeague) meta.push(fixture.league.name);
  if (showRound) meta.push(fixture.league.round);

  return (
    <li className="px-3 py-3 transition-colors duration-150 hover:bg-abyss-200 sm:px-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <TeamBadge team={fixture.teams.home} />

        <span
          className={`min-w-[3.75rem] rounded px-2 py-1 text-center text-sm font-semibold tabular-nums ${
            live
              ? "animate-pulse-live bg-sakura-wash text-sakura"
              : finished
                ? "bg-electric-wash text-ghost"
                : "bg-abyss-300 font-medium text-mist"
          }`}
        >
          {scoreOrKickoff(fixture)}
        </span>

        <TeamBadge team={fixture.teams.away} align="right" />
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mist">
        {meta.map((item, index) => (
          <span key={`${index}-${item}`} className="flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden className="text-mist-dim">
                ·
              </span>
            ) : null}
            <span className={index === 0 && live ? "font-semibold text-sakura" : ""}>
              {item}
            </span>
          </span>
        ))}
      </p>
    </li>
  );
}

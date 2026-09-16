import { ErrorNotice, Notice } from "@/components/Notice";
import { StandingsTable } from "@/components/StandingsTable";
import type { Competition } from "@/lib/config";
import { getStandings } from "@/lib/football-data";
import type { LeagueStandings } from "@/lib/types";

/** 1 request / chu kỳ revalidate. */
export async function StandingsView({
  competition,
}: {
  competition: Competition;
}) {
  let data: LeagueStandings | null;

  try {
    data = await getStandings(competition.code);
  } catch (error) {
    return <ErrorNotice error={error} />;
  }

  const groups = data?.league.standings ?? [];

  if (groups.length === 0) {
    return (
      <Notice title={`Chưa có bảng xếp hạng cho ${competition.name}`}>
        Giải này có thể chưa khởi tranh, hoặc là giải cúp không có vòng bảng.
      </Notice>
    );
  }

  const multipleGroups = groups.length > 1;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h2 className="section-title">{competition.name}</h2>
        <span aria-hidden className="h-px flex-1 bg-abyss-400" />
        <span className="eyebrow">Bảng xếp hạng</span>
      </div>

      {groups.map((rows, index) => (
        <div key={rows[0]?.group ?? index} className="space-y-2">
          {multipleGroups ? (
            <h3 className="text-sm font-semibold text-mist">
              {rows[0]?.group ?? `Bảng ${index + 1}`}
            </h3>
          ) : null}
          <StandingsTable rows={rows} />
        </div>
      ))}
    </section>
  );
}

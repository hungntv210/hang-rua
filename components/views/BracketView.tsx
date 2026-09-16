import { Bracket } from "@/components/Bracket";
import { ErrorNotice, Notice } from "@/components/Notice";
import { buildBracket } from "@/lib/bracket";
import type { Competition } from "@/lib/config";
import { BRACKET_MAX_ROUNDS, REVALIDATE } from "@/lib/config";
import { getCompetitionMatches } from "@/lib/football-data";
import type { Fixture } from "@/lib/types";

/** 1 request / chu kỳ revalidate. */
export async function BracketView({
  competition,
}: {
  competition: Competition;
}) {
  let fixtures: Fixture[];

  try {
    fixtures = await getCompetitionMatches(competition.code, REVALIDATE.bracket);
  } catch (error) {
    return <ErrorNotice error={error} />;
  }

  const { rounds, omittedRounds } = buildBracket(fixtures, BRACKET_MAX_ROUNDS);

  if (rounds.length === 0) {
    return (
      <Notice title={`Chưa có vòng loại trực tiếp cho ${competition.name}`}>
        Giải đang ở vòng League Stage (36 đội xếp chung một bảng) nên chưa có sơ
        đồ loại trực tiếp. Sơ đồ sẽ xuất hiện từ vòng play-off trở đi.
      </Notice>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="section-title">{competition.name}</h2>
        <span aria-hidden className="h-px flex-1 bg-abyss-400" />
        <span className="eyebrow">Sơ đồ loại trực tiếp</span>
      </div>

      <p className="text-sm text-mist">
        Kéo ngang để xem các vòng. Cặp đấu hai lượt được gộp, con số bên phải là
        tổng tỷ số.
        {omittedRounds > 0
          ? ` Đã ẩn ${omittedRounds} vòng loại sớm để trang không quá nặng.`
          : ""}
      </p>

      <Bracket rounds={rounds} />
    </section>
  );
}

import { LeagueFixturesBrowser } from "@/components/LeagueFixturesBrowser";
import { ErrorNotice, Notice } from "@/components/Notice";
import type { Competition } from "@/lib/config";
import { clubsFromFixtures, getCompetitionMatches } from "@/lib/football-data";
import type { Fixture } from "@/lib/types";

/**
 * 1 request / chu kỳ revalidate cho cả giải.
 *
 * Lấy hết trận của mùa rồi đẩy sang client để gom theo vòng và lọc theo câu lạc
 * bộ yêu thích: bấm chọn không tốn thêm request nào và phản hồi tức thì. Danh
 * sách câu lạc bộ cũng suy ra từ chính dữ liệu này, không cần gọi thêm endpoint.
 */
export async function LeagueFixturesView({
  competition,
}: {
  competition: Competition;
}) {
  let fixtures: Fixture[];

  try {
    fixtures = await getCompetitionMatches(competition.code);
  } catch (error) {
    return <ErrorNotice error={error} />;
  }

  if (fixtures.length === 0) {
    return (
      <Notice title={`Chưa có lịch thi đấu cho ${competition.name}`}>
        football-data.org chưa công bố lịch mùa mới của giải này.
      </Notice>
    );
  }

  return (
    <LeagueFixturesBrowser
      competitionName={competition.name}
      competitionSlug={competition.slug}
      clubs={clubsFromFixtures(fixtures)}
      fixtures={fixtures}
    />
  );
}

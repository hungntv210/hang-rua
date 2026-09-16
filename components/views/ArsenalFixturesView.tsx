import { FixtureList } from "@/components/FixtureList";
import { ErrorNotice, Notice } from "@/components/Notice";
import { ARSENAL_TEAM_ID, RECENT_LIMIT, UPCOMING_LIMIT } from "@/lib/config";
import { getTeamMatches } from "@/lib/football-data";
import { splitByKickoff } from "@/lib/format";
import type { Fixture } from "@/lib/types";

/**
 * 1 request / chu kỳ revalidate: lấy cả mùa rồi cắt trong code.
 *
 * Đây là lịch của MỘT đội đá nhiều giải nên nhóm theo ngày, không theo vòng:
 * mỗi vòng Arsenal chỉ có đúng một trận, nhóm theo vòng sẽ ra hàng chục nhóm
 * chỉ chứa một dòng. Lịch của cả một giải mới dùng accordion phân vòng — xem
 * components/RoundAccordion.tsx.
 */
export async function ArsenalFixturesView() {
  let all: Fixture[];

  try {
    all = await getTeamMatches(ARSENAL_TEAM_ID);
  } catch (error) {
    return <ErrorNotice error={error} />;
  }

  if (all.length === 0) {
    return (
      <Notice title="Chưa có dữ liệu Arsenal cho mùa này">
        football-data.org chưa công bố lịch mùa mới, hoặc mùa trước vừa kết
        thúc. Thử lại sau vài ngày.
      </Notice>
    );
  }

  const { upcoming, recent } = splitByKickoff(all, UPCOMING_LIMIT, RECENT_LIMIT);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex items-baseline gap-3">
          <h2 className="section-title">Arsenal</h2>
          <span aria-hidden className="h-px flex-1 bg-abyss-400" />
          <span className="eyebrow">Trận sắp tới</span>
        </div>

        {upcoming.length === 0 ? (
          <Notice title="Không còn trận sắp tới">
            Cả {all.length} trận của mùa này đã diễn ra.
          </Notice>
        ) : (
          <FixtureList fixtures={upcoming} />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline gap-3">
          <h2 className="section-title">Arsenal</h2>
          <span aria-hidden className="h-px flex-1 bg-abyss-400" />
          <span className="eyebrow">Kết quả gần nhất</span>
        </div>

        <FixtureList
          fixtures={recent}
          order="desc"
          emptyMessage="Mùa giải chưa khởi tranh nên chưa có kết quả."
        />
      </section>
    </div>
  );
}

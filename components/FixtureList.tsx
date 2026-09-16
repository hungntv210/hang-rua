import { FixtureRow } from "@/components/FixtureRow";
import { groupByDay } from "@/lib/format";
import type { Fixture } from "@/lib/types";

interface Props {
  fixtures: Fixture[];
  /** Hiện tên giải trong từng dòng — dùng cho lịch của đội đá nhiều giải. */
  showLeague?: boolean;
  /** "desc" cho kết quả gần nhất (mới nhất lên đầu). */
  order?: "asc" | "desc";
  emptyMessage?: string;
}

/**
 * Danh sách trận nhóm theo NGÀY.
 *
 * Dùng cho lịch của một đội (trang Arsenal), nơi mỗi vòng chỉ có đúng một trận
 * nên nhóm theo vòng sẽ ra một loạt nhóm chỉ chứa một dòng. Lịch của cả một
 * giải thì dùng RoundAccordion — xem components/RoundAccordion.tsx.
 */
export function FixtureList({
  fixtures,
  showLeague = true,
  order = "asc",
  emptyMessage = "Không có trận nào.",
}: Props) {
  if (fixtures.length === 0) {
    return (
      <p className="plate px-4 py-6 text-center text-sm text-mist">
        {emptyMessage}
      </p>
    );
  }

  const days = groupByDay(fixtures);
  const ordered = order === "desc" ? [...days].reverse() : days;

  return (
    <div className="space-y-3">
      {ordered.map((day) => {
        const items =
          order === "desc" ? [...day.fixtures].reverse() : day.fixtures;
        return (
          <section key={day.key} className="plate">
            <h3 className="border-b border-grid px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-mist sm:px-4">
              {day.label}
            </h3>
            <ul className="divide-y divide-grid">
              {items.map((fixture) => (
                <FixtureRow
                  key={fixture.fixture.id}
                  fixture={fixture}
                  showLeague={showLeague}
                  showRound
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

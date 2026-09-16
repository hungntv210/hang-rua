"use client";

import { useCallback, useMemo, useState } from "react";

import { ClubFilter } from "@/components/ClubFilter";
import { Notice } from "@/components/Notice";
import { RoundAccordion } from "@/components/RoundAccordion";
import { groupByRound } from "@/lib/format";
import type { ClubOption, Fixture } from "@/lib/types";

interface Props {
  competitionName: string;
  competitionSlug: string;
  clubs: ClubOption[];
  /** Toàn bộ trận của mùa, chưa cắt. */
  fixtures: Fixture[];
}

/**
 * Lịch thi đấu của một giải, phân theo VÒNG ĐẤU và có bộ lọc CLB.
 *
 * Accordion liệt kê đủ mọi vòng của mùa nên không cần cắt thành "sắp tới" và
 * "gần nhất" như trước: người dùng thấy được toàn cảnh mùa giải, vòng hiện tại
 * mở sẵn, các vòng khác thu gọn.
 *
 * Lọc theo CLB rồi mới gom vòng — làm ngược lại thì các vòng mà CLB đã chọn
 * không thi đấu vẫn hiện ra dưới dạng nhóm rỗng.
 */
export function LeagueFixturesBrowser({
  competitionName,
  competitionSlug,
  clubs,
  fixtures,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // ClubFilter gọi onChange trong useEffect lúc mount; nếu tham chiếu hàm đổi
  // mỗi lần render sẽ thành vòng lặp vô tận.
  const handleChange = useCallback((ids: number[]) => {
    setSelectedIds(ids);
  }, []);

  const rounds = useMemo(() => {
    const selected = new Set(selectedIds);
    const filtered =
      selected.size === 0
        ? fixtures
        : fixtures.filter(
            (f) =>
              selected.has(f.teams.home.id) || selected.has(f.teams.away.id),
          );
    return groupByRound(filtered);
  }, [fixtures, selectedIds]);

  const filtering = selectedIds.length > 0;
  const matchCount = rounds.reduce((sum, r) => sum + r.fixtures.length, 0);

  return (
    <div className="space-y-6">
      <ClubFilter
        competitionSlug={competitionSlug}
        clubs={clubs}
        onChange={handleChange}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="section-title">{competitionName}</h2>
          <p className="text-sm text-mist">
            {rounds.length} vòng · {matchCount} trận
            {filtering ? " (đang lọc theo câu lạc bộ)" : ""}
          </p>
        </div>

        {rounds.length === 0 ? (
          <Notice title="Không có trận nào khớp">
            {filtering
              ? "Các câu lạc bộ bạn chọn chưa có lịch ở mùa này. Thử bỏ bớt bộ lọc."
              : "Mùa giải này chưa có lịch thi đấu."}
          </Notice>
        ) : (
          <RoundAccordion rounds={rounds} />
        )}
      </section>
    </div>
  );
}

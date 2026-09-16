import { FixtureRow } from "@/components/FixtureRow";
import { Scute, type ScuteState } from "@/components/Scute";
import { formatDayMonth, formatRoundRange, type RoundGroup } from "@/lib/format";

function scuteState(round: RoundGroup): ScuteState {
  if (round.current) return "current";
  if (round.complete) return "played";
  return "upcoming";
}

function RoundSummary({ round }: { round: RoundGroup }) {
  const total = round.fixtures.length;

  return (
    <summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded px-3 py-3 transition-colors duration-150 hover:bg-abyss-200 sm:px-4 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-display text-lg font-semibold tracking-tight text-ghost">
            {round.label}
          </span>
          {round.current ? (
            <span className="rounded-sm bg-sakura-wash px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sakura">
              {round.live ? "Đang diễn ra" : "Vòng hiện tại"}
            </span>
          ) : null}
        </span>

        <span className="mt-0.5 block text-xs text-mist">
          {total} trận
          <span aria-hidden className="mx-1.5 text-mist-dim">
            ·
          </span>
          {formatRoundRange(round)}
          {round.playedCount > 0 && !round.complete ? (
            <>
              <span aria-hidden className="mx-1.5 text-mist-dim">
                ·
              </span>
              đã đá {round.playedCount}/{total}
            </>
          ) : null}
        </span>
      </span>

      {/* Mũi tên xoay khi mở — dùng biến thể group-open nên <details> phải mang
          class `group`. */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="h-4 w-4 shrink-0 text-mist-dim transition-transform duration-200 group-open:rotate-90"
      >
        <path
          d="M9 5l7 7-7 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </summary>
  );
}

interface Props {
  rounds: RoundGroup[];
  /** Hiện tên giải trong từng dòng — tắt khi cả trang chỉ có một giải. */
  showLeague?: boolean;
}

/**
 * Sống mai: các vòng đấu xếp thành đốt vảy dọc một đường gờ bên trái.
 *
 * Dùng <details>/<summary> của trình duyệt thay vì state React — không cần
 * JavaScript phía client, phím Tab và Enter chạy sẵn, và thuộc tính `open`
 * render thẳng từ server nên vòng hiện tại đã mở ngay trong HTML đầu tiên,
 * không nháy một nhịp sau khi hydrate.
 *
 * TOẠ ĐỘ (đừng đổi lẻ một chỗ):
 *   khung ngoài  pl-9      -> mép trái của <li> nằm ở 36px
 *   đường gờ     left-4    -> tâm gờ ở 16.5px
 *   đốt vảy      -left-7   -> 36 - 28 = 8px, rộng 17px, tâm rơi đúng 16.5px
 */
export function RoundAccordion({ rounds, showLeague = false }: Props) {
  if (rounds.length === 0) return null;

  return (
    <div className="relative pl-9">
      {/* Đường gờ sống mai. Dừng cách hai đầu để không đâm ra ngoài đốt vảy
          đầu và cuối. */}
      <span
        aria-hidden
        className="absolute bottom-5 left-4 top-5 w-px bg-abyss-400"
      />

      <ol className="space-y-2">
        {rounds.map((round) => (
          <li key={round.key} className="relative">
            {/* Nền trùng màu trang để che đoạn gờ chạy phía sau đốt vảy. */}
            <span
              aria-hidden
              className="absolute -left-7 top-3.5 flex w-[17px] justify-center bg-void py-0.5"
            >
              <Scute state={scuteState(round)} />
            </span>

            <details
              open={round.current}
              className={`group plate ${round.current ? "border-sakura/50" : ""}`}
            >
              <RoundSummary round={round} />

              <ul className="divide-y divide-grid border-t border-grid">
                {round.fixtures.map((fixture) => (
                  <FixtureRow
                    key={fixture.fixture.id}
                    fixture={fixture}
                    showLeague={showLeague}
                    showDate
                    dateLabel={formatDayMonth(fixture.fixture.date)}
                  />
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

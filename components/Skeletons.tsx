/** Khối skeleton dùng chung cho các màn hình loading.tsx — chỉ để trình bày. */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-sm ${className}`} />;
}

export function TabsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {Array.from({ length: count }).map((_, index) => (
        <Bar key={index} className="h-10 w-28 shrink-0 rounded" />
      ))}
    </div>
  );
}

/** Khung chờ cho accordion vòng đấu: một vòng mở, phần còn lại thu gọn. */
export function RoundAccordionSkeleton({
  rounds = 4,
  rows = 4,
}: {
  rounds?: number;
  rows?: number;
}) {
  return (
    <div className="relative pl-9">
      <span
        aria-hidden
        className="absolute bottom-5 left-4 top-5 w-px bg-abyss-400"
      />
      <div className="space-y-2">
        {Array.from({ length: rounds }).map((_, roundIndex) => (
          <div key={roundIndex} className="relative">
            <span
              aria-hidden
              className="absolute -left-7 top-3.5 flex w-[17px] justify-center bg-void py-0.5"
            >
              <Bar className="h-[18px] w-[17px]" />
            </span>
            <div className="plate">
              <div className="space-y-2 px-3 py-3 sm:px-4">
                <Bar className="h-5 w-28" />
                <Bar className="h-3 w-40" />
              </div>
              {roundIndex === 0 ? (
                <ul className="divide-y divide-grid border-t border-grid">
                  {Array.from({ length: rows }).map((_, rowIndex) => (
                    <li key={rowIndex} className="px-3 py-3 sm:px-4">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                        <Bar className="h-4 w-24" />
                        <Bar className="h-7 w-14" />
                        <Bar className="ml-auto h-4 w-24" />
                      </div>
                      <Bar className="mt-2 h-3 w-32" />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FixtureListSkeleton({
  days = 2,
  rows = 3,
}: {
  days?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: days }).map((_, dayIndex) => (
        <section key={dayIndex} className="plate">
          <div className="border-b border-grid px-3 py-2 sm:px-4">
            <Bar className="h-3 w-32" />
          </div>
          <ul className="divide-y divide-grid">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <li key={rowIndex} className="px-3 py-3 sm:px-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                  <Bar className="h-4 w-24" />
                  <Bar className="h-7 w-14" />
                  <Bar className="ml-auto h-4 w-24" />
                </div>
                <Bar className="mt-2 h-3 w-32" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function StandingsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="plate space-y-3 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Bar className="h-3 w-4" />
          <Bar className="h-4 w-32 flex-1" />
          <Bar className="h-3 w-6" />
          <Bar className="h-3 w-6" />
          <Bar className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

export function BracketSkeleton({
  columns = 3,
  ties = 2,
}: {
  columns?: number;
  ties?: number;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {Array.from({ length: columns }).map((_, colIndex) => (
        <section key={colIndex} className="w-64 shrink-0 space-y-3">
          <Bar className="h-9 w-full rounded" />
          <ul className="space-y-3">
            {Array.from({ length: ties }).map((_, tieIndex) => (
              <li key={tieIndex} className="plate space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Bar className="h-4 w-28" />
                  <Bar className="h-4 w-5" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Bar className="h-4 w-28" />
                  <Bar className="h-4 w-5" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

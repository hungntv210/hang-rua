import { CompetitionTabs } from "@/components/CompetitionTabs";
import { ArsenalFixturesView } from "@/components/views/ArsenalFixturesView";
import { COMPETITIONS } from "@/lib/config";

// ISR 1 gio - xem REVALIDATE.fixtures trong lib/config.ts.
// KHONG doi sang `export const dynamic = "force-dynamic"`: Next 14 se ep fetch
// sang no-store va dot het quota 100 request/ngay cua goi free.
export const revalidate = 3600;

export default function HomePage() {
  return (
    <div className="space-y-6">
      <CompetitionTabs
        competitions={COMPETITIONS}
        basePath="/football/league"
        leadingTab={{ href: "/football", label: "Arsenal", active: true }}
      />
      <ArsenalFixturesView />
    </div>
  );
}

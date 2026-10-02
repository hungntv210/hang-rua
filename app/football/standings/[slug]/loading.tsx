import { MascotState } from "@/components/ui/MascotState";
import { StandingsTableSkeleton, TabsSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <MascotState kind="loading" inline title="Rùa đang đi lấy dữ liệu…" />
      <TabsSkeleton count={6} />
      <StandingsTableSkeleton />
    </div>
  );
}

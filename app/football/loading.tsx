import { MascotState } from "@/components/ui/MascotState";
import { FixtureListSkeleton, TabsSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <MascotState kind="loading" inline title="Rùa đang đi lấy dữ liệu…" />
      <TabsSkeleton count={7} />
      <FixtureListSkeleton />
    </div>
  );
}

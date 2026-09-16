import { StandingsTableSkeleton, TabsSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <TabsSkeleton count={6} />
      <StandingsTableSkeleton />
    </div>
  );
}

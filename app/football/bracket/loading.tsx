import { BracketSkeleton, TabsSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <TabsSkeleton count={4} />
      <BracketSkeleton />
    </div>
  );
}

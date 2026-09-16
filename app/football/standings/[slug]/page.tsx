import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompetitionTabs } from "@/components/CompetitionTabs";
import { StandingsView } from "@/components/views/StandingsView";
import { STANDINGS_COMPETITIONS, getCompetitionBySlug } from "@/lib/config";

// ISR 6 gio - xem REVALIDATE.standings trong lib/config.ts.
export const revalidate = 21600;

export const dynamicParams = false;

export function generateStaticParams() {
  return STANDINGS_COMPETITIONS.map((competition) => ({
    slug: competition.slug,
  }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const competition = getCompetitionBySlug(params.slug);
  return {
    title: competition
      ? `Bảng xếp hạng ${competition.name}`
      : "Football",
  };
}

export default function StandingsBySlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const competition = getCompetitionBySlug(params.slug);
  if (!competition || !competition.hasStandings) notFound();

  return (
    <div className="space-y-6">
      <CompetitionTabs
        competitions={STANDINGS_COMPETITIONS}
        basePath="/football/standings"
        activeSlug={competition.slug}
      />
      <StandingsView competition={competition} />
    </div>
  );
}

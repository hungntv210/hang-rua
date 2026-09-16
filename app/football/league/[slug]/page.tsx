import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompetitionTabs } from "@/components/CompetitionTabs";
import { LeagueFixturesView } from "@/components/views/LeagueFixturesView";
import { COMPETITIONS, getCompetitionBySlug } from "@/lib/config";

// ISR 1 gio - xem REVALIDATE.fixtures trong lib/config.ts.
export const revalidate = 3600;

/** Chi build san cac giai co trong config; slug la se tra 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return COMPETITIONS.map((competition) => ({ slug: competition.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const competition = getCompetitionBySlug(params.slug);
  return {
    title: competition
      ? `Lịch thi đấu ${competition.name}`
      : "Football",
  };
}

export default function LeagueFixturesPage({
  params,
}: {
  params: { slug: string };
}) {
  const competition = getCompetitionBySlug(params.slug);
  if (!competition) notFound();

  return (
    <div className="space-y-6">
      <CompetitionTabs
        competitions={COMPETITIONS}
        basePath="/football/league"
        activeSlug={competition.slug}
        leadingTab={{ href: "/football", label: "Arsenal", active: false }}
      />
      <LeagueFixturesView competition={competition} />
    </div>
  );
}

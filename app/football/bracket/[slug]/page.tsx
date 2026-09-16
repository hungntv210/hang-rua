import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompetitionTabs } from "@/components/CompetitionTabs";
import { BracketView } from "@/components/views/BracketView";
import { BRACKET_COMPETITIONS, getCompetitionBySlug } from "@/lib/config";

// ISR 12 gio - xem REVALIDATE.bracket trong lib/config.ts.
export const revalidate = 43200;

export const dynamicParams = false;

export function generateStaticParams() {
  return BRACKET_COMPETITIONS.map((competition) => ({
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
      ? `Sơ đồ cúp ${competition.name}`
      : "Football",
  };
}

export default function BracketBySlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const competition = getCompetitionBySlug(params.slug);
  if (!competition || !competition.hasBracket) notFound();

  return (
    <div className="space-y-6">
      <CompetitionTabs
        competitions={BRACKET_COMPETITIONS}
        basePath="/football/bracket"
        activeSlug={competition.slug}
      />
      <BracketView competition={competition} />
    </div>
  );
}

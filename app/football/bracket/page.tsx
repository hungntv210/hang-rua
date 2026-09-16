import { CompetitionTabs } from "@/components/CompetitionTabs";
import { BracketView } from "@/components/views/BracketView";
import {
  BRACKET_COMPETITIONS,
  DEFAULT_BRACKET_SLUG,
  getCompetitionBySlug,
} from "@/lib/config";

// ISR 12 gio - xem REVALIDATE.bracket trong lib/config.ts.
export const revalidate = 43200;

// Xem ghi chú về template tiêu đề trong app/football/standings/page.tsx.
export const metadata = {
  title: "Sơ đồ cúp",
};

export default function BracketPage() {
  const competition = getCompetitionBySlug(DEFAULT_BRACKET_SLUG);

  if (!competition) {
    throw new Error(
      `DEFAULT_BRACKET_SLUG "${DEFAULT_BRACKET_SLUG}" khong co trong COMPETITIONS.`,
    );
  }

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

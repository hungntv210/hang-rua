import { CompetitionTabs } from "@/components/CompetitionTabs";
import { StandingsView } from "@/components/views/StandingsView";
import {
  DEFAULT_STANDINGS_SLUG,
  STANDINGS_COMPETITIONS,
  getCompetitionBySlug,
} from "@/lib/config";

// ISR 6 gio - xem REVALIDATE.standings trong lib/config.ts.
export const revalidate = 21600;

// Chỉ đặt phần riêng của trang: root layout có template "%s | Hang Rùa" nên tự
// thêm hậu tố. Ghi cả tên thương hiệu ở đây sẽ ra tiêu đề nhân đôi.
export const metadata = {
  title: "Bảng xếp hạng",
};

export default function StandingsPage() {
  const competition = getCompetitionBySlug(DEFAULT_STANDINGS_SLUG);

  if (!competition) {
    throw new Error(
      `DEFAULT_STANDINGS_SLUG "${DEFAULT_STANDINGS_SLUG}" khong co trong COMPETITIONS.`,
    );
  }

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

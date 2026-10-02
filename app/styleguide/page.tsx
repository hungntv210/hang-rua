import { notFound } from "next/navigation";

import { Notice } from "@/components/Notice";
import { FixtureListSkeleton } from "@/components/Skeletons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MascotState } from "@/components/ui/MascotState";
import { Sticker } from "@/components/ui/Sticker";
import { Tooltip } from "@/components/ui/Tooltip";
import { TONE_CLASS, type Tone } from "@/components/ui/tones";

const TONES = Object.keys(TONE_CLASS) as Tone[];

/** Bảng mẫu mọi thành phần giao diện. Chỉ có ở môi trường dev. */
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold">Styleguide</h1>

      <section className="space-y-3" aria-label="Nút">
        <h2 className="section-title">Nút</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Royal</Button>
          <Button variant="salmon">Salmon</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Tắt</Button>
        </div>
      </section>

      <section className="space-y-3" aria-label="Badge và sticker">
        <h2 className="section-title">Badge và sticker</h2>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <Badge key={t} tone={t}>
              {t}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 py-2">
          <Sticker>NEW!</Sticker>
          <Sticker tone="aqua" tilt={-2}>
            Sắp có
          </Sticker>
          <Sticker tone="navy" tilt={3}>
            Beta
          </Sticker>
        </div>
      </section>

      <section className="space-y-3" aria-label="Thẻ">
        <h2 className="section-title">Thẻ</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card tone="sky" title="Lịch đấu" href="/football">
            Trận nào, khi nào.
          </Card>
          <Card tone="aqua" title="Xếp hạng" href="/football/standings">
            Ai đang dẫn đầu.
          </Card>
          <Card tone="royal" title="Sơ đồ cúp" href="/football/bracket" corner={<Sticker>NEW!</Sticker>}>
            Loại trực tiếp.
          </Card>
          <Card tone="salmon" title="Sắp có" size="lg" />
        </div>
      </section>

      <section className="space-y-3" aria-label="Tooltip">
        <h2 className="section-title">Tooltip</h2>
        <Tooltip id="sg-tip" open>
          Dự bị cùng vị trí: tooltip mở.
        </Tooltip>
      </section>

      <section className="space-y-4" aria-label="Trạng thái">
        <h2 className="section-title">Loading, trống, lỗi</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <MascotState kind="loading" title="Đang tải…" />
          <MascotState kind="empty" title="Chưa có gì" />
          <MascotState kind="error" title="Có lỗi">
            Thử lại sau nhé.
          </MascotState>
        </div>
        <Notice title="Thông báo thường">Nội dung thông báo.</Notice>
        <Notice tone="error" title="Thông báo lỗi">
          Chi tiết lỗi.
        </Notice>
        <FixtureListSkeleton days={1} rows={2} />
      </section>
    </main>
  );
}

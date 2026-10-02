import Image from "next/image";

import { HeroSlider, type HeroSlide } from "@/components/HeroSlider";
import { Card } from "@/components/ui/Card";
import { Sticker } from "@/components/ui/Sticker";
import { HOME_CARDS } from "@/lib/home-cards";

const SLIDES: readonly HeroSlide[] = [
  {
    id: "save",
    kicker: "Mới có FC 27",
    title: "Thả file save vào, xem đội hình của bạn",
    body: "Sơ đồ ra sân, tiềm năng, hợp đồng, lò trẻ — đọc thẳng từ file Career Mode, ngay trên trình duyệt.",
    href: "/save-reader",
    cta: "Mở Save Reader",
    tone: "navy",
    art: "capsule",
  },
  {
    id: "football",
    kicker: "Sáu giải lớn",
    title: "Lịch đá, bảng điểm, sơ đồ cúp — gom một chỗ",
    body: "Ưu tiên Arsenal, nhưng giải nào cũng có. Dữ liệu tự làm mới mỗi giờ.",
    href: "/football",
    cta: "Xem lịch đấu",
    tone: "royal",
    art: "ball",
  },
  {
    id: "kame",
    kicker: "Linh vật",
    title: "Rùa đi chậm, nhưng không bỏ trận nào",
    body: "Kame giữ hang. Mỗi mục mới là một ngách đào thêm, chậm mà chắc.",
    href: "/football/standings",
    cta: "Xem bảng xếp hạng",
    tone: "aqua",
    art: "mascot",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:pt-10">
      <HeroSlider slides={SLIDES} />

      {/* Tiêu đề lệch trái kèm nhãn dán — không căn giữa, không khẩu hiệu chung. */}
      <div className="mt-14 flex flex-wrap items-end gap-3">
        <h2 className="font-display text-3xl font-extrabold leading-none text-ink sm:text-4xl">
          Trong hang có gì?
        </h2>
        <Sticker tone="aqua" tilt={3}>
          {HOME_CARDS.filter((c) => c.href).length} ngách đang mở
        </Sticker>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {HOME_CARDS.map((card) => (
          <li key={card.id} className={card.size === "lg" ? "col-span-2" : ""}>
            <Card
              tone={card.tone}
              title={card.title}
              href={card.href}
              size={card.size}
              corner={card.isNew ? <Sticker>NEW!</Sticker> : undefined}
            >
              {card.blurb}
            </Card>
          </li>
        ))}
      </ul>

      {/* Dải linh vật: ảnh nghiêng nhô khỏi khung, chữ dồn phải. */}
      <section className="mt-16 flex items-center gap-5 rounded-3xl border-4 border-ink bg-sky-100 p-5 shadow-pop sm:gap-8 sm:p-8">
        <span className="-my-10 block h-28 w-28 shrink-0 -rotate-6 overflow-hidden rounded-full border-4 border-ink bg-sky shadow-pop sm:h-36 sm:w-36">
          <Image
            src="/brand/kame-mascot.webp"
            alt="Kame, linh vật rùa của Hang Rùa"
            width={288}
            height={288}
            sizes="144px"
            className="h-full w-full object-cover"
          />
        </span>
        <div className="min-w-0">
          <p className="font-display text-2xl font-extrabold text-ink">Kame</p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft sm:text-base">
            Rùa đi chậm nhưng không dừng — và mai rùa là một bản ghi, từng đốt vảy xếp chồng
            theo thời gian.
          </p>
        </div>
      </section>
    </main>
  );
}

import Image from "next/image";

import { BrushWordmark } from "@/components/BrushWordmark";
import { ModuleCard } from "@/components/ModuleCard";
import { MODULES } from "@/lib/modules";

/**
 * Dashboard của Hang Rùa.
 *
 * Ảnh Tokyo về đêm giờ là hero thật chứ không còn là tấm ảnh minh hoạ cuối
 * trang: nó chính là thế giới mà cả bộ nhận diện lấy màu ra, nên đặt nó ở chỗ
 * khác thì trang phải tự dựng lại không khí đó bằng gradient — vừa yếu hơn vừa
 * là thứ ai cũng làm.
 *
 * Tên thương hiệu đè lên ảnh, không nằm cạnh: banner đã có sẵn chữ カメ viết
 * bằng bút lông ở góc trái, nên chữ Latin đặt chồng lên sẽ đọc như cùng một lớp
 * với nó thay vì tranh chấp.
 */
export default function HomePage() {
  const liveCount = MODULES.filter((m) => m.status === "live").length;
  const soonCount = MODULES.length - liveCount;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      {/* HERO ---------------------------------------------------------- */}
      <section className="relative overflow-hidden rounded-sm border border-grid">
        <Image
          src="/brand/tokyo-night.webp"
          alt=""
          width={1536}
          height={1024}
          priority
          sizes="(min-width: 1024px) 64rem, 100vw"
          className="h-[19rem] w-full object-cover object-center sm:h-[24rem]"
        />

        {/* Phủ tối dồn về phía dưới-trái để chữ luôn đọc được, bất kể ảnh. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-tr from-void via-void/70 to-transparent"
        />

        {/* Ngoặc góc — cùng chi tiết với khung HUD của viewport. */}
        <span aria-hidden className="hud-corner left-3 top-3 border-l border-t" />
        <span aria-hidden className="hud-corner bottom-3 right-3 border-b border-r" />

        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-9">
          <p className="eyebrow text-electric/80">Trang cá nhân</p>

          {/* Chữ thư pháp cần nhiều khoảng thở phía dưới hơn chữ thường: nét
              quét bút kéo xuống dưới đường chân chữ. */}
          <div className="mt-3 flex items-end gap-5 pb-3">
            <h1 className="text-6xl font-bold sm:text-8xl">
              <BrushWordmark text="Hang Rùa" />
            </h1>
            <span className="brand-jp mb-2 hidden text-sm text-electric sm:block">
              カメの巣穴
            </span>
          </div>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-mist sm:text-base">
            Nơi tập hợp những thứ tôi quan tâm, gom lại một chỗ. Mỗi thứ là một
            mục riêng, mở rộng dần theo thời gian.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="glass inline-flex items-center gap-2 rounded-sm border-electric/40 px-3 py-1.5 font-mono text-[11px] text-ghost">
              <span className="animate-pulse-live h-1.5 w-1.5 rounded-full bg-sakura shadow-[0_0_8px_theme(colors.sakura.DEFAULT)]" />
              {liveCount} mục đang chạy
            </span>
            <span className="glass inline-flex items-center gap-2 rounded-sm px-3 py-1.5 font-mono text-[11px] text-mist-dim">
              {soonCount} chỗ trống
            </span>
          </div>
        </div>
      </section>

      {/* CÁC MỤC ------------------------------------------------------- */}
      <section className="mt-12 sm:mt-16">
        <div className="flex items-center gap-3">
          <h2 className="eyebrow">Các mục</h2>
          <span aria-hidden className="rule-ticks flex-1" />
          <span className="font-mono text-[10px] text-mist-dim">
            {String(MODULES.length).padStart(2, "0")}
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod, index) => (
            <div
              key={mod.id}
              style={{ animationDelay: `${index * 70}ms` }}
              className="animate-fade-in-up"
            >
              <ModuleCard module={mod} />
            </div>
          ))}
        </div>
      </section>

      {/* LINH VẬT ------------------------------------------------------ */}
      <section className="mt-12 flex items-center gap-6 sm:mt-16">
        <figure className="shrink-0">
          <div className="overflow-hidden rounded-sm border border-grid bg-abyss p-1.5">
            <Image
              src="/brand/kame-mascot.webp"
              alt="Linh vật rùa của Hang Rùa"
              width={384}
              height={384}
              className="aspect-square w-24 rounded-sm object-cover sm:w-32"
            />
          </div>
        </figure>
        <div className="min-w-0">
          <p className="eyebrow">Linh vật</p>
          <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ghost">
            Kame <span className="brand-jp text-sm text-electric">カメ</span>
          </p>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-mist">
            Rùa đi chậm nhưng không dừng — và mai rùa là một bản ghi, từng đốt
            vảy xếp chồng theo thời gian.
          </p>
        </div>
      </section>
    </main>
  );
}

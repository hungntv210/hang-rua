"use client";

import { useMemo, useState } from "react";

import { positionName } from "@/lib/save/career/schema";
import type { Lineup } from "@/lib/fc26/formations";
import type { SavePlayer } from "@/lib/save/types";

/**
 * Sơ đồ đội hình trên sân.
 *
 * ─── TOẠ ĐỘ ─────────────────────────────────────────────────────────────────
 *
 * `x` và `y` lấy thẳng từ bảng `formations` của game, đã chuẩn hoá 0..1. Không
 * tự chế hình học: thủ môn ra đúng `(0.5, 0.02)`, tiền đạo `(0.5, 0.87)`.
 *
 * `y = 0` là khung thành nhà, nên trên màn hình nó nằm ở ĐÁY — dùng `bottom`
 * chứ không phải `top`. Đảo chiều là cả đội hình lộn ngược.
 *
 * ─── VÌ SAO KHÔNG DÙNG MÀU CỦA ẢNH MẪU ──────────────────────────────────────
 *
 * Ảnh mẫu là sân xanh dương tươi với áo đỏ. Đặt nguyên bảng màu đó vào một trang
 * nền đêm tông cyan/magenta sẽ đọc như một ảnh dán vào chứ không phải một phần
 * của trang. Nên giữ BỐ CỤC của ảnh mẫu — sọc sân, áo có số lớn, tên ngay dưới,
 * thủ môn khác màu — còn sắc độ thì lấy từ bảng màu sẵn có của dự án.
 */

/** Nhóm vị trí để biết cầu thủ dự bị nào thay được cho ô nào. */
const SLOT_FAMILY: Record<string, string[]> = {
  GK: ["GK"],
  SW: ["CB", "SW", "RCB", "LCB"],
  RWB: ["RB", "RWB"], RB: ["RB", "RWB"],
  RCB: ["CB", "RCB", "LCB", "SW"], CB: ["CB", "RCB", "LCB", "SW"], LCB: ["CB", "RCB", "LCB", "SW"],
  LB: ["LB", "LWB"], LWB: ["LB", "LWB"],
  RDM: ["CDM", "RDM", "LDM", "CM"], CDM: ["CDM", "RDM", "LDM", "CM"], LDM: ["CDM", "RDM", "LDM", "CM"],
  RM: ["RM", "RW"], LM: ["LM", "LW"],
  RCM: ["CM", "RCM", "LCM", "CDM", "CAM"], CM: ["CM", "RCM", "LCM", "CDM", "CAM"],
  LCM: ["CM", "RCM", "LCM", "CDM", "CAM"],
  RAM: ["CAM", "RAM", "LAM"], CAM: ["CAM", "RAM", "LAM", "CM"], LAM: ["CAM", "RAM", "LAM"],
  RF: ["RF", "RW", "ST"], CF: ["CF", "ST"], LF: ["LF", "LW", "ST"],
  RW: ["RW", "RM", "RF"], LW: ["LW", "LM", "LF"],
  RS: ["ST", "CF", "RS", "LS"], ST: ["ST", "CF", "RS", "LS"], LS: ["ST", "CF", "RS", "LS"],
};

/** Tên hiển thị gọn: "Francesco Pio Esposito" -> "F. P. Esposito". */
function shortName(name: string | null, fallback: string): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  if (name.length <= 14) return name;
  return `${parts.slice(0, -1).map((p) => `${p[0]}.`).join(" ")} ${last}`;
}

/** Áo đấu. Thủ môn khác màu — cùng quy ước với mọi sơ đồ đội hình. */
function Shirt({ number, gk }: { number: number; gk: boolean }) {
  return (
    <svg viewBox="0 0 48 44" className="h-full w-full drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]">
      <path
        d="M17 3 L24 7 L31 3 L41 8 L45 17 L38 21 L38 41 L10 41 L10 21 L3 17 L7 8 Z"
        className={gk ? "fill-ghost/90 stroke-ghost" : "fill-sakura stroke-sakura-300"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <text
        x="24"
        y="31"
        textAnchor="middle"
        className={`font-mono font-bold ${gk ? "fill-void" : "fill-white"}`}
        style={{ fontSize: number >= 10 ? 17 : 19 }}
      >
        {number > 0 ? number : "–"}
      </text>
    </svg>
  );
}

interface Props {
  lineup: Lineup;
  /** Mọi cầu thủ đọc từ save, để tra tên và chỉ số. */
  players: SavePlayer[];
}

export function Pitch({ lineup, players }: Props) {
  const [open, setOpen] = useState<number | null>(null);

  const byId = useMemo(() => {
    const m = new Map<number, SavePlayer>();
    for (const p of players) m.set(p.playerId, p);
    return m;
  }, [players]);

  const starters = useMemo(
    () => new Set(lineup.slots.map((s) => s.playerId)),
    [lineup],
  );

  /** Dự bị hợp vị trí cho một ô — lọc theo VỊ TRÍ SỞ TRƯỜNG đọc từ save. */
  const alternativesFor = (slotIndex: number): SavePlayer[] => {
    const slotPos = positionName(lineup.slots[slotIndex].positionCode);
    const family = SLOT_FAMILY[slotPos] ?? [slotPos];
    return lineup.benchIds
      .filter((id) => !starters.has(id))
      .map((id) => byId.get(id))
      .filter((p): p is SavePlayer => !!p && family.includes(p.position))
      .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-2xl font-semibold tracking-tight text-ghost">
          {lineup.formationName}
        </span>
        <span className="eyebrow">
          đội hình xuất phát · khớp {lineup.matched}/11 từ file save
        </span>
      </div>

      {/* SÂN ─────────────────────────────────────────────────────────────── */}
      {/* Giới hạn bề ngang: sân tỉ lệ 3/4 mà kéo hết khung nội dung thì cao gần
          1000px trên desktop và đẩy mọi thứ khác ra khỏi màn hình. */}
      <div
        className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-sm border border-grid"
        style={{ aspectRatio: "3 / 4" }}
      >
        {/* Mặt cỏ: sọc ngang đậm nhạt xen kẽ, cùng cách sân thật được cắt cỏ. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #0d2b4a 0%, #103457 50%, #0d2b4a 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, rgba(255,255,255,0.11) 0 8.33%, transparent 8.33% 16.66%)",
          }}
        />

        {/* Vạch sân. Một SVG duy nhất — mọi vạch cùng một hệ toạ độ. */}
        <svg
          aria-hidden
          viewBox="0 0 100 133"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth="0.45"
          fill="none"
        >
          <rect x="3" y="3" width="94" height="127" />
          <line x1="3" y1="66.5" x2="97" y2="66.5" />
          <circle cx="50" cy="66.5" r="14" />
          <circle cx="50" cy="66.5" r="0.9" fill="rgba(255,255,255,0.32)" stroke="none" />
          {/* Vòng cấm + khung nhà (dưới) và đối thủ (trên) */}
          <rect x="21" y="112" width="58" height="18" />
          <rect x="36" y="124" width="28" height="6" />
          <rect x="21" y="3" width="58" height="18" />
          <rect x="36" y="3" width="28" height="6" />
          <path d="M 38 112 A 14 14 0 0 0 62 112" />
          <path d="M 38 21 A 14 14 0 0 1 62 21" />
        </svg>

        {/* CẦU THỦ ──────────────────────────────────────────────────────── */}
        {lineup.slots.map((slot, i) => {
          const p = byId.get(slot.playerId);
          const gk = positionName(slot.positionCode) === "GK";
          const alts = alternativesFor(i);
          const isOpen = open === i;
          /*
           * Ô có cầu thủ KHÔNG nằm trong save.
           *
           * Bảng đội hình dựng sẵn lấy từ một career, nên vài đội có cầu thủ do
           * career đó sinh ra chiếm suất đá chính — đo được: Croatia 2 suất,
           * Norway 1. Save của người khác không có những cầu thủ ấy, và nếu cứ
           * vẽ thì ô đó hiện `#460028`, một người không tồn tại trong file họ
           * tải lên. Vẽ ô trống có nhãn thì trung thực; vẽ áo có số thì là bịa.
           */
          const missing = !p;
          // Không có tên thì dùng `#id` chứ không phải "Cầu thủ <quốc tịch>":
          // "Cầu thủ Trinidad and Tobago" dài 27 ký tự, đủ để đẩy hai ô cạnh nhau
          // chồng lên nhau. Quốc tịch đầy đủ vẫn còn ở bảng cầu thủ.
          const label = missing ? "không có trong save" : shortName(p?.name ?? null, `#${slot.playerId}`);

          return (
            <div
              key={`${slot.playerId}-${i}`}
              className="absolute z-10 -translate-x-1/2 translate-y-1/2"
              // `y` của game chạy khoảng 0,02..0,90; trải ra 6%..85% để cầu thủ dùng hết
              // chiều dài sân thay vì dồn xuống nửa dưới.
              style={{ left: `${slot.x * 100}%`, bottom: `${slot.y * 88 + 6}%` }}
              onMouseEnter={() => setOpen(i)}
              onMouseLeave={() => setOpen((cur) => (cur === i ? null : cur))}
            >
              <button
                type="button"
                onClick={() => setOpen((cur) => (cur === i ? null : i))}
                /* Nút rộng hơn áo có chủ ý: ô tên trước đây hẹp đúng bằng áo (64px) nên
                   "Yan Diomande" bị cắt thành "Yan Diom…". Khoảng cách gần nhất giữa
                   hai ô trên sân là 0,3 × bề ngang, tức ~145px ở cỡ desktop, nên nhãn
                   90px vẫn không chạm nhau. */
                className="focus-ring flex w-[17vw] max-w-[88px] flex-col items-center gap-0.5 sm:w-[88px]"
                aria-expanded={isOpen}
                aria-label={`${label}, ${positionName(slot.positionCode)}${
                  alts.length ? `, ${alts.length} cầu thủ dự bị cùng vị trí` : ""
                }`}
              >
                <span
                  className={`block aspect-[48/44] w-[68%] transition-transform duration-150 ${
                    missing ? "opacity-30 grayscale" : ""
                  }`}
                >
                  <Shirt number={missing ? 0 : slot.jersey} gk={gk} />
                </span>
                {/* Tên và chỉ số CÙNG một dòng. Tách hai dòng làm mỗi ô cao thêm
                    ~14px, đủ để nhãn thủ môn chạm nhãn hai trung vệ — game xếp thủ
                    môn ở y=0,02 còn trung vệ ở 0,15 nên khoảng đó vốn đã rất hẹp. */}
                <span className="flex max-w-full items-baseline gap-1 rounded-sm bg-void/70 px-1 backdrop-blur-sm">
                  <span
                    className={`truncate text-[10px] font-medium leading-tight sm:text-[11px] ${
                      missing ? "text-mist-dim" : "text-white"
                    }`}
                  >
                    {label}
                  </span>
                  {p?.overall != null ? (
                    <span className="shrink-0 font-mono text-[9px] leading-none text-electric-bright sm:text-[10px]">
                      {p.overall}
                    </span>
                  ) : null}
                </span>
              </button>

              {/* DỰ BỊ CÙNG VỊ TRÍ ─────────────────────────────────────── */}
              {isOpen ? (
                <div
                  role="tooltip"
                  /* Neo theo vị trí ô thay vì luôn căn giữa: bảng rộng 192px mà ô
                     biên chỉ cách mép sân ~34px, nên căn giữa làm nó tràn hẳn ra
                     ngoài màn hình trên điện thoại. Đo được: tràn trái 45px ở LB
                     và LW. */
                  className={`glass-strong absolute top-full z-20 mt-1 w-48 rounded-sm p-2 shadow-panel-lift ${
                    slot.x < 0.25
                      ? "left-0"
                      : slot.x > 0.75
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2"
                  }`}
                >
                  <p className="eyebrow mb-1.5 text-electric">
                    {positionName(slot.positionCode)} · dự bị
                  </p>
                  {alts.length === 0 ? (
                    <p className="text-[11px] leading-snug text-mist">
                      Không có cầu thủ dự bị nào cùng vị trí này.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {alts.slice(0, 6).map((alt) => (
                        <li
                          key={alt.playerId}
                          className="flex items-baseline justify-between gap-2 text-[11px]"
                        >
                          <span className="min-w-0 truncate text-ghost">
                            {alt.name ??
                              (alt.nation ? `Cầu thủ ${alt.nation}` : `#${alt.playerId}`)}
                          </span>
                          <span className="shrink-0 font-mono text-mist-dim">
                            {alt.position} · {alt.overall ?? "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-mist">
        Đội hình và số áo đọc từ chính file save của bạn; toạ độ từng vị trí lấy
        từ bảng sơ đồ của game, không phải dựng lại bằng tay. Di chuột — hoặc
        chạm trên điện thoại — vào một vị trí để xem cầu thủ dự bị cùng sở
        trường.
      </p>
    </div>
  );
}

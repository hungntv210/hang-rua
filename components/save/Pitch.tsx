"use client";

import { useMemo, useState } from "react";

import {
  PlayerAvatar,
  StatBadge,
  displayName,
  familyOf,
  initialsOf,
  shortName,
  surnameOf,
} from "@/components/save/squad-shared";
import { FIT_LABEL } from "@/lib/fc26/lineup";
import type { Lineup } from "@/lib/fc26/lineup";
import { positionName } from "@/lib/save/career/schema";
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
 * của trang. Nên giữ BỐ CỤC của ảnh mẫu — sọc sân, ảnh đại diện, tên in hoa,
 * dòng chỉ số — còn sắc độ thì lấy từ bảng màu sẵn có của dự án.
 *
 * ─── ĐÂY LÀ ĐỘI HÌNH GỢI Ý ──────────────────────────────────────────────────
 *
 * Save không lưu được ai đá ô nào (xem `lib/fc26/lineup.ts`), nên 11 người ở đây
 * do trang xếp ra từ vị trí sở trường và chỉ số. Component này phải nói ra điều
 * đó ở chỗ người xem nhìn thấy, không giấu xuống chú thích cuối trang: một đội
 * hình gợi ý trông y hệt đội hình thật là thứ tệ hơn cả không hiển thị gì.
 */

interface Props {
  lineup: Lineup;
  /** Mọi cầu thủ đọc từ save, để tra tên và chỉ số. */
  players: SavePlayer[];
  /** Số áo — chỉ có khi người dùng nạp bản export career. */
  jerseyOf?: Map<number, number>;
}

/**
 * Mặt cỏ vẽ kiểu hoạt hình: các dải xanh lá nhiều tông. Đây là màu MINH HOẠ của
 * riêng sân (như quả bóng trên banner), không phải token giao diện — chữ không
 * bao giờ nằm trực tiếp trên cỏ mà luôn trong nhãn trắng viền đen.
 */
const PITCH_GRASS =
  "repeating-linear-gradient(180deg, #7FCB8C 0 8.33%, #6DBE7C 8.33% 16.66%, #8ED39A 16.66% 25%)";

/** Nhãn cầu thủ nghiêng nhẹ 1° xen kẽ — sticker dán tay, không xếp thẳng hàng máy. */
const TILT = ["-rotate-1", "rotate-0", "rotate-1"] as const;

export function Pitch({ lineup, players, jerseyOf }: Props) {
  /**
   * Ô đang mở bảng cùng vị trí.
   *
   * Một biến chứ không phải cờ trên từng ô: chỉ được mở MỘT bảng. Hai bảng mở
   * cùng lúc trên một sân rộng 520px thì chúng chồng lên nhau.
   */
  const [open, setOpen] = useState<number | null>(null);

  const byId = useMemo(() => {
    const m = new Map<number, SavePlayer>();
    for (const p of players) m.set(p.playerId, p);
    return m;
  }, [players]);

  const starters = useMemo(() => new Set(lineup.slots.map((s) => s.playerId)), [lineup]);

  /**
   * Cầu thủ không đá chính mà hợp vị trí với một ô.
   *
   * Lấy từ TOÀN ĐỘI chứ không chỉ từ băng ghế đăng ký: người xem muốn biết ai
   * đá được vị trí này, và một cầu thủ ngoài danh sách trận vẫn trả lời được
   * câu hỏi đó. Khung "Dự bị" dưới sơ đồ mới là chỗ nói về danh sách đăng ký.
   */
  const alternativesFor = (slotIndex: number): SavePlayer[] => {
    const family = familyOf(positionName(lineup.slots[slotIndex].positionCode));
    return lineup.squadIds
      .filter((id) => !starters.has(id))
      .map((id) => byId.get(id))
      .filter((p): p is SavePlayer => !!p && family.includes(p.position))
      .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  };

  return (
    /* Giới hạn bề ngang: sân tỉ lệ 3/4 mà kéo hết khung nội dung thì cao gần
       1000px trên desktop và đẩy mọi thứ khác ra khỏi màn hình. */
    <div className="relative mx-auto aspect-[3/5] w-full max-w-[520px] sm:aspect-[3/4]">
      {/*
       * Sân CAO hơn trên điện thoại, và đây là số đo chứ không phải sở thích.
       *
       * Khoảng cách dọc giữa hàng thủ môn và hàng trung vệ là chỗ hẹp nhất của
       * mọi sơ đồ. Ở tỉ lệ 3/4 trên màn hình 375px, khoảng đó còn 52px trong khi
       * ô cầu thủ cao 74px — đo được 4 cặp ô chồng lên nhau. Kéo tỉ lệ về 3/5
       * cộng với ô thấp hơn thì khoảng ấy đủ rộng trở lại.
       *
       * Lớp cắt (`overflow-hidden`) chỉ bọc mặt cỏ và vạch sân, KHÔNG bọc cầu
       * thủ: ô tên của hậu vệ biên nhô ra khỏi đường biên vài pixel, và cắt nó
       * đi thì mất chữ. Nhô ra vẫn nằm trong lề trang nên không sinh cuộn ngang.
       */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl border-4 border-ink shadow-pop">
      {/* Mặt cỏ: sọc ngang đậm nhạt xen kẽ, cùng cách sân thật được cắt cỏ. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: PITCH_GRASS,
        }}
      />
      <div
        aria-hidden
        className="pop-halftone absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, rgba(255,255,255,0.14) 0 8.33%, transparent 8.33% 16.66%)",
        }}
      />

      {/* Vạch sân. Một SVG duy nhất — mọi vạch cùng một hệ toạ độ. */}
      <svg
        aria-hidden
        viewBox="0 0 100 133"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        stroke="#ffffff"
        strokeWidth="0.9"
        fill="none"
      >
        <rect x="3" y="3" width="94" height="127" />
        <line x1="3" y1="66.5" x2="97" y2="66.5" />
        <circle cx="50" cy="66.5" r="14" />
        <circle cx="50" cy="66.5" r="1.4" fill="#ffffff" stroke="none" />
        {/* Vòng cấm + khung nhà (dưới) và đối thủ (trên) */}
        <rect x="21" y="112" width="58" height="18" />
        <rect x="36" y="124" width="28" height="6" />
        <rect x="21" y="3" width="58" height="18" />
        <rect x="36" y="3" width="28" height="6" />
        <path d="M 38 112 A 14 14 0 0 0 62 112" />
        <path d="M 38 21 A 14 14 0 0 1 62 21" />
      </svg>
      </div>

      {/* CẦU THỦ ────────────────────────────────────────────────────────── */}
      {lineup.slots.map((slot, i) => {
        const p = byId.get(slot.playerId);
        const position = positionName(slot.positionCode);
        const gk = position === "GK";
        const alts = alternativesFor(i);
        const isOpen = open === i;
        /*
         * Ô không tra được cầu thủ.
         *
         * Hiếm hơn hẳn trước đây: 11 người giờ đều lấy từ khối đội hình đọc
         * trong save, nên ai cũng có thật. Nhưng danh sách truyền vào đây đã lọc
         * bỏ nội dung Ultimate Team, nên một icon lọt vào đội hình vẫn tra
         * không ra. Vẽ ô trống có nhãn thì trung thực; vẽ một cái tên thì là bịa.
         */
        const missing = !p;
        const label = missing ? "trống" : shortName(p.name, `#${slot.playerId}`).toUpperCase();
        // Màn hình hẹp chỉ còn chỗ cho họ. Xem `surnameOf`.
        const shortLabel = missing ? "trống" : surnameOf(p.name, `#${slot.playerId}`).toUpperCase();

        /*
         * Bảng mở LÊN hay XUỐNG.
         *
         * Đây là cách thoả yêu cầu "không đè chữ lên cầu thủ xuất phát". Mở
         * xuống ở nửa trên sân và mở lên ở nửa dưới thì bảng luôn hướng về phía
         * giữa sân — nơi trống nhất — và không bao giờ phủ lên chính ô vừa được
         * trỏ vào.
         */
        const openDown = slot.y >= 0.5;

        return (
          <div
            key={`${slot.playerId}-${i}`}
            className={`absolute w-[22%] max-w-[104px] -translate-x-1/2 translate-y-1/2 ${isOpen ? "z-30" : "z-10"}`}
            /* `y` của game chạy khoảng 0,02..0,90; trải ra 4%..87% để cầu thủ
               dùng hết chiều dài sân thay vì dồn xuống nửa dưới.
               Hệ số 92 không tuỳ tiện: chỗ hẹp nhất là thủ môn với trung vệ, cách
               nhau 0,13 đơn vị `y`. Ở hệ số 88 khoảng đó ra 73px trong khi ô cầu
               thủ cao 76px — đo được thủ môn chồng lên cả hai trung vệ 3px. */
            style={{ left: `${slot.x * 100}%`, bottom: `${slot.y * 92 + 4}%` }}
            onMouseEnter={() => setOpen(i)}
            onMouseLeave={() => setOpen((cur) => (cur === i ? null : cur))}
          >
            <button
              type="button"
              onClick={() => setOpen((cur) => (cur === i ? null : i))}
              onFocus={() => setOpen(i)}
              onBlur={() => setOpen((cur) => (cur === i ? null : cur))}
              /* Bề ngang ô: đặt ở lớp bọc ngoài, 22% bề ngang SÂN (tối đa 104px)
                 — tức 75px trên sân 343px của màn hình 375px, 104px trên desktop.
                 Trước đây là 20vw: cùng con số trên điện thoại thật, nhưng `vw`
                 bám cửa sổ chứ không bám sân, và đo được trong khung giả lập
                 375px nó ra 103px làm 6 cặp ô chồng nhau. Phần trăm của sân thì
                 không phụ thuộc cửa sổ.
                 Lịch sử các con số:
                 Cả hai con số đều do khoảng cách giữa hai ô gần nhau nhất quyết
                 định, không phải do chọn cho vừa mắt. Cặp sát nhau nhất là hậu vệ
                 biên với trung vệ cùng bên, cách nhau 0,24 bề ngang sân: 115px ở
                 desktop và 82px ở màn hình 375px. Bản trước để 23vw (86px) trên
                 điện thoại và đo được đúng hai cặp ô chồng nhau ở đúng chỗ đó;
                 còn 96px trên desktop thì "YAN DIOMANDE" vừa khít 88px, tức là
                 nằm đúng trên ngưỡng và bị cắt khi bề ngang sân lệch đi vài pixel. */
              data-audit-box
              className="focus-ring flex w-full flex-col items-center gap-0.5 rounded-lg sm:gap-1"
              aria-expanded={isOpen}
              aria-label={`${missing ? "Ô trống" : displayName(p)}, ${position}${
                alts.length ? `, ${alts.length} cầu thủ cùng vị trí đang không đá chính` : ""
              }`}
            >
              {/* Viền quanh ảnh đại diện nói lên mức hợp vị trí.
                  Cần thiết vì đây là đội hình GỢI Ý: khi trang phải đẩy một tiền
                  vệ ra đá hậu vệ biên vì đội không còn ai khác, người xem phải
                  thấy điều đó ngay trên sân — nếu không họ sẽ đọc cách xếp này
                  như một lựa chọn chiến thuật có chủ đích. */}
              <span
                title={FIT_LABEL[slot.fit]}
                className={`rounded-full ${
                  missing
                    ? "opacity-30 grayscale"
                    : slot.fit === "out"
                      ? "ring-2 ring-lose"
                      : slot.fit === "group"
                        ? "ring-2 ring-warn"
                        : ""
                }`}
              >
                <span className="sm:hidden">
                  <PlayerAvatar
                    initials={missing ? null : initialsOf(p.name)}
                    jersey={jerseyOf?.get(slot.playerId) ?? null}
                    gk={gk}
                    size={28}
                  />
                </span>
                <span className="hidden sm:block">
                  <PlayerAvatar
                    initials={missing ? null : initialsOf(p.name)}
                    jersey={jerseyOf?.get(slot.playerId) ?? null}
                    gk={gk}
                    size={34}
                  />
                </span>
              </span>

              <span className={`flex w-full flex-col items-center gap-[2px] rounded-md border-2 border-ink bg-white px-0.5 py-[2px] shadow-pop-sm sm:px-1 ${TILT[i % 3]}`}>
                <span
                  data-audit-label
                  className={`w-full truncate text-center font-display text-[10px] font-extrabold uppercase leading-tight sm:text-[12px] ${
                    missing ? "text-ink-mute" : "text-ink"
                  }`}
                >
                  <span className="sm:hidden">{shortLabel}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
                {/* Dòng chỉ số: CS — vị trí — TN, đúng thứ tự của bản mô tả. Cỡ
                    9px là cỡ nhỏ nhất còn đọc được ở đây; đây là số để liếc, còn
                    bảng bên phải có bản đầy đủ cho ai muốn đọc kỹ. */}
                {missing ? (
                  <span className="text-[9px] leading-none text-ink-mute">
                    không có trong save
                  </span>
                ) : (
                  <span className="flex items-center gap-1 tabular-nums text-[9px] leading-none tabular-nums sm:text-[10px]">
                    <span className="font-bold text-royal">{p.overall ?? "—"}</span>
                    <span
                      className={`rounded-md px-1 py-[1px] text-[8px] font-semibold sm:text-[9px] ${
                        gk ? "bg-salmon text-ink" : "bg-sky text-ink"
                      }`}
                    >
                      {position}
                    </span>
                    <span className="font-bold text-win">{p.potential ?? "—"}</span>
                  </span>
                )}
              </span>
            </button>

            {/* CÙNG VỊ TRÍ, KHÔNG ĐÁ CHÍNH ──────────────────────────────── */}
            {isOpen ? (
              /* HAI lớp, và việc tách chúng ra là bắt buộc chứ không phải cho gọn:
                 lớp ngoài giữ `-translate-x-1/2` để căn giữa, lớp trong chạy
                 animation `scale`. Gộp làm một thì keyframe ghi đè `transform` và
                 nuốt mất phần căn giữa — bảng nhảy lệch nửa bề rộng ngay khi
                 animation kết thúc. */
              <div
                /* Neo theo vị trí ô thay vì luôn căn giữa: bảng rộng 200px mà ô
                   biên chỉ cách mép sân ~34px, nên căn giữa làm nó tràn hẳn ra
                   ngoài màn hình trên điện thoại. Đo được: tràn trái 45px ở LB
                   và LW. */
                className={`absolute w-[200px] ${
                  openDown ? "top-full mt-2" : "bottom-full mb-2"
                } ${
                  slot.x < 0.25
                    ? "left-0"
                    : slot.x > 0.75
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2"
                }`}
              >
                <div
                  role="tooltip"
                  /* Hiện bằng animation CSS, KHÔNG bằng `AnimatePresence`.
                   *
                   * Bản đầu dùng `AnimatePresence`. Hoạt ảnh thoát chạy tới
                   * `opacity: 0` nhưng phần tử KHÔNG BAO GIỜ được gỡ khỏi DOM —
                   * đo được: sau khi mở lần lượt cả 11 ô, cả 11 bảng vẫn còn đó.
                   * Vô hình, nên ảnh chụp màn hình trông hoàn toàn bình thường;
                   * nhưng phần tử `opacity: 0` vẫn nhận chuột, nên chúng chặn
                   * đúng những ô cầu thủ nằm cạnh, và trình đọc màn hình vẫn đọc
                   * cả 11.
                   *
                   * Ở đây không có gì để gỡ: hiện thì dựng, ẩn thì biến mất. Chỉ
                   * lúc HIỆN mới cần mượt — đó cũng là điều bản mô tả yêu cầu —
                   * còn lúc ẩn thì biến ngay là đúng hành vi của một tooltip.
                   * `@media (prefers-reduced-motion)` trong `globals.css` tự tắt
                   * animation này, không cần xử lý riêng.
                   */
                  style={{ transformOrigin: openDown ? "top center" : "bottom center" }}
                  className="animate-tooltip-in rounded-xl border-2 border-ink bg-white p-2 shadow-pop-sm"
                >
                <p className="mb-1.5 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-royal">
                  {position} · cùng vị trí
                </p>
                {alts.length === 0 ? (
                  <p className="text-[11px] leading-snug text-ink-soft">
                    Không còn ai trong đội đá được vị trí này.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {alts.slice(0, 6).map((alt) => (
                      <li key={alt.playerId} className="flex items-center gap-1.5 text-[11px]">
                        <PlayerAvatar
                          initials={initialsOf(alt.name)}
                          gk={alt.position === "GK"}
                          size={18}
                        />
                        <span className="min-w-0 flex-1 truncate text-left text-ink">
                          {displayName(alt)}
                        </span>
                        <span className="shrink-0 tabular-nums text-[10px] text-ink-mute">
                          {alt.position}
                        </span>
                        <StatBadge value={alt.overall} />
                      </li>
                    ))}
                    {alts.length > 6 ? (
                      <li className="pt-0.5 text-[10px] text-ink-mute">
                        và {alts.length - 6} người nữa
                      </li>
                    ) : null}
                  </ul>
                )}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

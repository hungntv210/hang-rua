"use client";

import { useMemo } from "react";

import {
  GROUP_LABEL,
  GROUP_ORDER,
  PlayerAvatar,
  StatBadge,
  contractLabel,
  displayName,
  groupOf,
  initialsOf,
  type PositionGroup,
} from "@/components/save/squad-shared";
import { formatMoney } from "@/lib/fc26/value";
import type { SavePlayer } from "@/lib/save/types";

/**
 * Danh sách cầu thủ của đội, chia bốn nhóm vị trí.
 *
 * ─── VÌ SAO KHÔNG PHẢI MỘT BẢNG `<table>` DUY NHẤT ──────────────────────────
 *
 * Mỗi nhóm cuộn riêng, theo đúng yêu cầu. Một `<table>` chung không làm được
 * chuyện đó mà không phá cấu trúc bảng; bốn `<table>` riêng thì làm được, và
 * mỗi cái vẫn là một bảng thật với `<thead>` — nên trình đọc màn hình đọc được
 * tên cột, và chọn-sao-chép ra Excel vẫn giữ nguyên hàng cột.
 *
 * Cột số áo đã bị bỏ: số áo không đọc được từ save (nó thuộc về cặp cầu thủ-đội
 * chứ không thuộc về cầu thủ). Ảnh đại diện mang chữ cái đầu tên thay vào đó.
 *
 * ─── VÌ SAO CÓ CỜ MÀ KHÔNG PHẢI HÌNH CỜ ─────────────────────────────────────
 *
 * Emoji cờ (🇻🇳) KHÔNG hiển thị thành cờ trên Windows — hệ điều hành này không
 * có font cờ, và người dùng chính của trang đang dùng Windows. Nó sẽ hiện ra
 * đúng hai chữ cái "VN" trong một hộp. Nên thay vì để hệ điều hành quyết định,
 * hiển thị thẳng mã quốc gia trong một ô mono: giống nhau ở mọi máy, và hợp
 * tông HUD của trang hơn một lá cờ nhỏ xíu.
 */

/**
 * Từ nối không mang thông tin nhận dạng — bỏ trước khi lấy chữ cái đầu.
 *
 * Không có bước này thì "Trinidad and Tobago" ra "TAT", một mã không tồn tại ở
 * đâu cả và làm người đọc mất vài giây để hiểu. Bỏ "and" thì ra "TT", đúng mã
 * ISO thật.
 */
const FILLER = new Set(["and", "of", "the", "republic", "islands", "saint", "new"]);

/** Rút tên quốc gia thành mã ngắn để nhét vừa một ô hẹp. */
function nationCode(nation: string | null): string {
  if (!nation) return "—";
  const clean = nation.replace(/[^A-Za-zÀ-ỹ\s]/g, " ").trim();
  const words = clean.split(/\s+/).filter((w) => w.length > 1 && !FILLER.has(w.toLowerCase()));
  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }
  // Một từ: ba chữ cái đầu. Trùng khớp mã ba chữ thật ở phần lớn trường hợp —
  // England→ENG, France→FRA, Croatia→CRO, Sweden→SWE.
  return (words[0] ?? clean).slice(0, 3).toUpperCase();
}

interface Props {
  /** Toàn bộ cầu thủ của đội — không chỉ đội hình xuất phát. */
  squad: SavePlayer[];
  /** Ai được xếp đá chính, để đánh dấu. */
  starterIds: Set<number>;
  /** Số áo — chỉ có khi người dùng nạp bản export career. */
  jerseyOf?: Map<number, number>;
  /** Lương mỗi tuần — cùng nguồn với số áo. Không có thì cột lương ẩn hẳn. */
  wageOf?: Map<number, number>;
}

/** Mỗi nhóm vị trí một màu khối — thủ môn salmon theo quy ước "thủ môn khác màu". */
const GROUP_TONE: Record<(typeof GROUP_ORDER)[number], string> = {
  GK: "bg-salmon text-ink",
  DF: "bg-sky text-ink",
  MF: "bg-aqua text-ink",
  FW: "bg-royal text-ice",
};

export function SquadList({ squad, starterIds, jerseyOf, wageOf }: Props) {
  /*
   * Cột lương ẩn HẲN khi không có dữ liệu, không hiện một cột toàn dấu gạch.
   *
   * Một cột rỗng chạy suốt bảng trông như lỗi, và nó chiếm chỗ của thứ khác
   * trên màn hình hẹp. Ẩn đi thì bảng vẫn đọc được, và khi người dùng nạp bản
   * export thì cột xuất hiện — bản thân việc nó xuất hiện đã là phản hồi.
   */
  const showWage = !!wageOf && wageOf.size > 0;
  const groups = useMemo(() => {
    const m = new Map<PositionGroup, SavePlayer[]>();
    for (const g of GROUP_ORDER) m.set(g, []);
    for (const p of squad) m.get(groupOf(p.position))!.push(p);
    // Sắp theo chỉ số giảm dần: câu hỏi đầu tiên với một nhóm vị trí luôn là
    // "ai giỏi nhất ở đây", không phải "ai vần A".
    for (const list of m.values()) list.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
    return m;
  }, [squad]);

  return (
    <div className="space-y-5">
      {GROUP_ORDER.map((g) => {
        const list = groups.get(g)!;
        return (
          <section key={g}>
            <div className="mb-2 flex items-center gap-2">
              <h3
                className={`rounded-full border-2 border-ink px-3 py-0.5 font-display text-sm font-extrabold shadow-pop-sm ${GROUP_TONE[g]}`}
              >
                {GROUP_LABEL[g].vi}
              </h3>
              <span className="tabular-nums text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                {GROUP_LABEL[g].en} · {list.length}
              </span>
            </div>

            {list.length === 0 ? (
              <p className="rounded-md border-2 border-dashed border-ink/40 px-3 py-4 text-xs text-ink-mute">
                Không có cầu thủ nào thuộc nhóm này trong đội.
              </p>
            ) : (
              /* Cuộn riêng từng nhóm. `max-h` chọn theo 6 hàng: đủ để phần lớn
                 nhóm hiện trọn, và khi tràn thì hàng thứ bảy bị cắt một nửa —
                 dấu hiệu "còn nữa" rõ hơn bất kỳ mũi tên nào. */
              <div className="max-h-[17rem] overflow-y-auto overflow-x-auto rounded-xl border-2 border-ink bg-white">
                <table
                  className={`w-full border-collapse text-left ${showWage ? "min-w-[600px]" : "min-w-[520px]"}`}
                >
                  <thead>
                    <tr className="sticky top-0 z-10 bg-sky text-ink">
                      <th scope="col" className="th-cell w-full">
                        Cầu thủ
                      </th>
                      <th scope="col" className="th-cell text-center" title="Chỉ số tổng (tính)">
                        CS
                      </th>
                      <th scope="col" className="th-cell text-center" title="Tiềm năng">
                        TN
                      </th>
                      <th scope="col" className="th-cell text-center">
                        Tuổi
                      </th>
                      <th scope="col" className="th-cell whitespace-nowrap">
                        Hết HĐ
                      </th>
                      <th
                        scope="col"
                        className="th-cell whitespace-nowrap text-right"
                        title="Ước tính, không đọc từ save"
                      >
                        Giá trị ≈
                      </th>
                      {showWage ? (
                        <th
                          scope="col"
                          className="th-cell whitespace-nowrap text-right"
                          title="Đọc từ bản export career"
                        >
                          Lương
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => {
                      const starter = starterIds.has(p.playerId);
                      return (
                        <tr
                          key={p.playerId}
                          className="border-t border-ink/15 hover:bg-sky-100"
                        >
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <PlayerAvatar
                                initials={initialsOf(p.name)}
                                jersey={jerseyOf?.get(p.playerId) ?? null}
                                gk={p.position === "GK"}
                                size={26}
                              />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className={`truncate text-[13px] leading-tight ${
                                      p.name ? "text-ink" : "text-ink-mute"
                                    }`}
                                  >
                                    {displayName(p)}
                                  </span>
                                  {/* Dấu đá chính thay cho việc lặp lại cả đội hình
                                      ở cột riêng — người xem đã thấy sơ đồ ngay bên
                                      trái, đây chỉ cần nối hai bên lại với nhau. */}
                                  {starter ? (
                                    <span
                                      title="Được xếp đá chính trong đội hình gợi ý"
                                      className="shrink-0 rounded-md bg-royal-100 px-1 tabular-nums text-[9px] uppercase tracking-wide text-royal"
                                    >
                                      XP
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1.5 tabular-nums text-[10px] leading-none text-ink-mute">
                                  <span
                                    title={p.nation ?? undefined}
                                    className="rounded-md bg-ink/10 px-1 py-[1px] tracking-wide"
                                  >
                                    {nationCode(p.nation)}
                                  </span>
                                  <span className="text-navy">{p.position}</span>
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <StatBadge value={p.overall} />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <StatBadge value={p.potential} />
                          </td>
                          <td className="px-2 py-1.5 text-center tabular-nums text-xs tabular-nums text-ink-soft">
                            {p.age ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-xs tabular-nums text-ink-soft">
                            {contractLabel(p.contractUntil)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-xs tabular-nums text-ink-soft">
                            {formatMoney(p.valueEstimate)}
                          </td>
                          {showWage ? (
                            <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-xs tabular-nums text-ink">
                              {formatMoney(wageOf!.get(p.playerId) ?? null)}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

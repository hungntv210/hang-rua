"use client";

import { useMemo } from "react";

import { Pitch } from "@/components/save/Pitch";
import { SquadList } from "@/components/save/SquadList";
import { PlayerAvatar, StatBadge, displayName, initialsOf } from "@/components/save/squad-shared";
import type { Lineup } from "@/lib/fc26/lineup";
import type { SavePlayer } from "@/lib/save/types";

/**
 * Trang đội hình: sơ đồ sân bên trái, danh sách theo nhóm vị trí bên phải.
 *
 * ─── VÌ SAO HAI CỘT LỆCH NHAU ───────────────────────────────────────────────
 *
 * Sân có tỉ lệ cố định 3/4 nên chiều cao của nó do chiều rộng quyết định, còn
 * danh sách bên phải thì cao theo số cầu thủ. Ép hai bên bằng nhau sẽ hoặc bóp
 * sân lại, hoặc chừa một khoảng trống lớn dưới nó. Nên cột trái `sticky` và tự
 * dừng lại khi cuộn — người xem giữ được sơ đồ trong tầm mắt trong lúc dò danh
 * sách, đúng việc mà hai khối này sinh ra để làm cùng nhau.
 *
 * Ngưỡng chia cột là 1280px chứ không phải 1024px, và đây là số đo. Sân chiếm
 * 480px; ở 1100px màn hình, phần còn lại chỉ đủ ~500px cho một bảng cần tối
 * thiểu 520px, nên bảng phải cuộn ngang và người xem chỉ thấy cột tên với cột
 * CS. Xếp chồng ở quãng đó thì bảng được trọn bề ngang trang.
 */

interface Props {
  lineup: Lineup;
  /** Mọi cầu thủ đọc được từ save. */
  players: SavePlayer[];
  /** Số áo — chỉ có khi người dùng nạp bản export career. */
  jerseyOf?: Map<number, number>;
  /** Lương mỗi tuần — cùng nguồn với số áo. */
  wageOf?: Map<number, number>;
}

export function SquadHub({ lineup, players, jerseyOf, wageOf }: Props) {
  const byId = useMemo(() => {
    const m = new Map<number, SavePlayer>();
    for (const p of players) m.set(p.playerId, p);
    return m;
  }, [players]);

  const starterIds = useMemo(
    () => new Set(lineup.slots.map((s) => s.playerId)),
    [lineup],
  );

  /** Toàn đội, theo thứ tự chỉ số. */
  const squad = useMemo(
    () =>
      lineup.squadIds
        .map((id) => byId.get(id))
        .filter((p): p is SavePlayer => !!p),
    [lineup, byId],
  );

  /**
   * Cả đội trừ 11 người được xếp đá chính.
   *
   * KHÔNG phải danh sách đăng ký trận. Bản trước lấy băng ghế từ bảng team sheet
   * nướng sẵn nên nó đúng là danh sách đăng ký — nhưng của một career tại một
   * thời điểm, không phải của save đang mở. Save không lưu được ai ngồi ghế dự
   * bị, nên chỗ này giờ nói đúng thứ nó biết: những người còn lại của đội.
   */
  const bench = useMemo(
    () =>
      lineup.benchIds
        .filter((id) => !starterIds.has(id))
        .map((id) => byId.get(id))
        .filter((p): p is SavePlayer => !!p)
        .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)),
    [lineup, byId, starterIds],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ghost">
          {lineup.formationName}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist-dim">
          {squad.length} cầu thủ đọc từ save ·{" "}
          {lineup.source === "export" ? (
            <span className="text-jade">
              đội hình thật{lineup.sheetName ? ` · ${lineup.sheetName}` : ""}
            </span>
          ) : (
            "đội hình gợi ý"
          )}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)] xl:gap-8">
        {/* KHỐI TRÁI ───────────────────────────────────────────────────── */}
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Pitch lineup={lineup} players={players} jerseyOf={jerseyOf} />

          <section>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="font-display text-sm font-semibold tracking-wide text-ghost">
                Còn lại trong đội
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist-dim">
                Rest of squad · {bench.length}
              </span>
            </div>

            {bench.length === 0 ? (
              /* Ô trống có LỜI GIẢI THÍCH, không phải một khung rỗng.
                 Khung rỗng trong ảnh mẫu không nói được vì sao nó rỗng, và người
                 xem sẽ đọc nó thành lỗi của trang. */
              <p className="rounded-sm border border-dashed border-grid px-3 py-5 text-center text-xs leading-relaxed text-mist-dim">
                Đội chỉ có đúng 11 cầu thủ trong save, không còn ai ngoài đội hình.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {bench.map((p) => (
                  <li
                    key={p.playerId}
                    className="flex items-center gap-2 rounded-sm border border-grid bg-abyss/60 px-2 py-1.5"
                  >
                    <PlayerAvatar
                      initials={initialsOf(p.name)}
                      jersey={jerseyOf?.get(p.playerId) ?? null}
                      gk={p.position === "GK"}
                      size={24}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ghost">
                      {displayName(p)}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-orchid">{p.position}</span>
                    <StatBadge value={p.overall} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* KHỐI PHẢI ───────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">
          <SquadList
            squad={squad}
            starterIds={starterIds}
            jerseyOf={jerseyOf}
            wageOf={wageOf}
          />

          <p className="text-xs leading-relaxed text-mist">
            <strong>Danh sách đội, tuổi, vị trí sở trường và hạn hợp đồng đọc thẳng
            từ file save của bạn</strong> — đổi save thì chúng đổi theo.{" "}
            {lineup.source === "export" ? (
              <>
                <strong>11 suất đá chính là đội hình thật bạn đã xếp</strong>, đọc từ
                bản export career và đã đối chiếu khớp với file save. Số áo và lương
                cũng từ đó.{" "}
              </>
            ) : (
              <>
                <strong>Riêng 11 suất đá chính thì không:</strong> save không lưu được
                ai đá ô nào, nên trang tự xếp từ vị trí sở trường và chỉ số, rồi chọn
                sơ đồ mà đội này xếp được mạnh nhất. Đó là một gợi ý, không phải đội
                hình bạn đã xếp trong game.{" "}
              </>
            )}
            Vòng cam quanh ảnh đại diện nghĩa là người đó đang đá lệch tuyến, vòng đỏ
            là trái vị trí hẳn.{" "}
            <strong>Cột &ldquo;Giá trị&rdquo; cũng là ước tính</strong> — game
            không lưu giá trị chuyển nhượng ở bất kỳ đâu, nên con số này tính từ
            CS, TN và tuổi: đúng bậc độ lớn và đúng thứ tự giữa các cầu thủ, không
            đúng tới từng triệu. <strong>CS cũng là số tính</strong>, sai số ±1. Di
            chuột — hoặc chạm trên điện thoại — vào một vị trí trên sân để xem ai
            khác đá được vị trí đó.
          </p>
        </div>
      </div>
    </div>
  );
}

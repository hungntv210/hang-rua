"use client";

import {
  PlayerAvatar,
  StatBadge,
  contractLabel,
  displayName,
  initialsOf,
  toneOf,
} from "@/components/save/squad-shared";
import type { YouthFilterStats } from "@/lib/fc26/youth";
import type { SavePlayer } from "@/lib/save/types";

/**
 * Danh sách cầu thủ trẻ do career sinh ra.
 *
 * ─── CỘT CHÍNH LÀ KHOẢNG PHÁT TRIỂN, KHÔNG PHẢI CHỈ SỐ ──────────────────────
 *
 * Chỉ số hiện tại của một cậu bé 14 tuổi gần như không nói gì. Câu hỏi duy nhất
 * đáng hỏi với nhóm này là "ai đáng giữ", và câu trả lời nằm ở khoảng cách giữa
 * tiềm năng và chỉ số hiện tại. Nên bảng sắp theo tiềm năng và cột `+n` được
 * tô màu, chứ không phải cột CS.
 *
 * ─── PHẢI NÓI RÕ ĐÂY LÀ SUY LUẬN ────────────────────────────────────────────
 *
 * Save chứa toàn bộ roster của game và CLB máy cũng sinh cầu thủ trẻ. Không có
 * cách nào chắc chắn biết ai thuộc học viện của người dùng — bảng nói được điều
 * đó chỉ có trong bản export Lua. Danh sách này lọc theo "do career sinh ra,
 * tuổi học viện, chưa lên đội một", và phần chú thích nói đúng như vậy.
 */

interface Props {
  players: SavePlayer[];
  stats: YouthFilterStats;
  /** Số áo nếu nhận ra được CLB. Cầu thủ trẻ hiếm khi có. */
  jerseyOf?: Map<number, number>;
  /**
   * Danh sách đến từ đâu. Hai chế độ cho hai mức tin cậy rất khác nhau, và
   * người xem không có cách nào tự biết mình đang ở chế độ nào — nên bảng
   * phải nói ra.
   */
  source: "bang" | "suy-luan";
}

export function YouthList({ players, stats, jerseyOf, source }: Props) {
  if (players.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-sm border border-dashed border-grid px-4 py-6 text-center text-sm leading-relaxed text-mist">
          Không tìm thấy cầu thủ trẻ nào do career sinh ra trong file save này.
          <br />
          <span className="text-xs text-mist-dim">
            Career mới thường chưa có lứa nào — game sinh cầu thủ học viện sau vài
            tháng trong game.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ghost">
          {players.length} cầu thủ trẻ
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist-dim">
          {source === "bang"
            ? "học viện + đang scout · đọc từ save · sắp theo tiềm năng"
            : "suy luận · mọi CLB · sắp theo tiềm năng"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-sm border border-grid bg-abyss/60">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="sticky top-0 z-10 bg-abyss-200 text-mist-dim">
              <th scope="col" className="th-cell w-full">
                Cầu thủ
              </th>
              <th scope="col" className="th-cell text-center">
                Tuổi
              </th>
              <th scope="col" className="th-cell text-center" title="Chỉ số tổng hiện tại (tính)">
                CS
              </th>
              <th scope="col" className="th-cell text-center" title="Tiềm năng">
                TN
              </th>
              <th
                scope="col"
                className="th-cell text-center"
                title="Còn tăng được bao nhiêu — thứ đáng quan tâm nhất ở cầu thủ trẻ"
              >
                Còn tăng
              </th>
              <th scope="col" className="th-cell whitespace-nowrap">
                Hết HĐ
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const growth =
                p.overall !== null && p.potential !== null ? p.potential - p.overall : null;
              return (
                <tr
                  key={p.playerId}
                  className="border-t border-grid/60 transition-colors hover:bg-abyss-300/60"
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
                        <span
                          className={`block truncate text-[13px] leading-tight ${
                            p.name ? "text-ghost" : "text-mist-dim"
                          }`}
                        >
                          {displayName(p)}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] leading-none text-mist-dim">
                          <span className="text-orchid">{p.position}</span>
                          {p.nation ? <span>{p.nation}</span> : null}
                          {p.heightCm ? <span>{p.heightCm}cm</span> : null}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono text-xs tabular-nums text-mist">
                    {p.age ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <StatBadge value={p.overall} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <StatBadge value={p.potential} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {/* Tô màu theo chính khoảng tăng, không theo tiềm năng: một
                        cầu thủ 78/82 và một cầu thủ 58/82 có cùng tiềm năng
                        nhưng không cùng giá trị. */}
                    <StatBadge
                      value={growth}
                      tone={toneOf(growth === null ? null : 60 + growth * 2)}
                      title="Tiềm năng trừ chỉ số hiện tại"
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs tabular-nums text-mist">
                    {contractLabel(p.contractUntil)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {source === "bang" ? (
        <p className="text-xs leading-relaxed text-mist">
          <strong>
            Danh sách này gồm cả cầu thủ bạn đã ký lẫn cầu thủ trưởng đoàn scout
            mới tìm thấy, và trang chưa tách được hai nhóm.
          </strong>{" "}
          Save có một bảng riêng của đội bạn — không lẫn cầu thủ trẻ câu lạc bộ khác
          — nhưng bảng đó chứa cả hai nhóm và không đánh dấu ai đã ký. Đối chiếu với
          màn hình Đội trẻ trên một career thật: bảng ghi 25 người, trong đó 16 đã ký
          và 9 còn ở mục scout. Đã dò cả 12 byte chưa giải mã của từng dòng, dò khối
          đội hình, và dò mọi vùng chứa đúng 16 người — chưa tìm ra chỗ đánh dấu.
          Nên con số ở đây <em>lớn hơn</em> số người trong Đội trẻ của bạn.
          {stats.inSenior > 0 || stats.tooOld > 0 || stats.implausible > 0 ? (
            <>
              {" "}
              Bảng ghi {stats.careerCreated} người, đã bỏ{" "}
              {[
                stats.inSenior > 0 ? `${stats.inSenior} người đã lên đội một` : null,
                stats.tooOld > 0 ? `${stats.tooOld} người ngoài tuổi học viện` : null,
                stats.implausible > 0
                  ? `${stats.implausible} người không đọc được bản ghi`
                  : null,
              ]
                .filter(Boolean)
                .join(", ")}
              .
            </>
          ) : null}{" "}
          Chỉ số tổng là số tính từ 31 chỉ số thành phần, sai số ±1; tiềm năng và hạn
          hợp đồng thì đọc thẳng từ save.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-mist">
          <strong>Danh sách này là suy luận, không phải đọc thẳng.</strong> Không tìm
          thấy bảng học viện trong file save này, nên trang phải lọc theo dấu hiệu — và
          cách đó <strong>gom cả cầu thủ trẻ của câu lạc bộ khác</strong>, vì save chứa
          toàn bộ roster của game và CLB máy cũng sinh cầu thủ trẻ. Ba dấu hiệu dùng để
          lọc: cầu thủ <strong>không có trong dữ liệu gốc của game</strong> (tức do
          career tạo ra), <strong>tuổi 14–21</strong>, và <strong>chưa nằm trong đội
          hình chính</strong>. Từ {stats.careerCreated} cầu thủ do career sinh ra, đã
          loại {stats.inSenior} người đã lên đội một, {stats.tooOld} người ngoài dải
          tuổi và {stats.implausible} bản ghi không hợp lý. Chỉ số tổng là số tính từ
          31 chỉ số thành phần, sai số ±1.
        </p>
      )}
    </div>
  );
}

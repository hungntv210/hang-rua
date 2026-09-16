import { TeamBadge } from "@/components/TeamBadge";
import { ARSENAL_TEAM_ID } from "@/lib/config";
import type { StandingRow } from "@/lib/types";

function FormBadges({ form }: { form: string | null }) {
  if (!form) return null;
  return (
    <span className="hidden gap-1 lg:flex">
      {form
        .slice(-5)
        .split("")
        .map((result, index) => (
          <span
            key={`${index}-${result}`}
            title={
              result === "W" ? "Thắng" : result === "D" ? "Hoà" : "Thua"
            }
            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold ${
              result === "W"
                ? "bg-electric text-ghost"
                : result === "D"
                  ? "bg-abyss-400 text-mist"
                  : "bg-crimson-wash text-crimson"
            }`}
          >
            {result}
          </span>
        ))}
    </span>
  );
}

/**
 * Dải màu bên trái theo ý nghĩa vị trí — chỉ trình bày lại thông tin API cung
 * cấp, không tự bịa thêm luật. football-data.org hiện không trả trường mô tả
 * này nên trên thực tế dải thường trong suốt; giữ lại để khi nào có dữ liệu là
 * hiển thị được ngay.
 */
function zoneAccent(description: string | null): string {
  if (!description) return "border-transparent";
  const text = description.toLowerCase();
  if (text.includes("relegation")) return "border-crimson";
  if (text.includes("champions league")) return "border-electric";
  if (text.includes("europa") || text.includes("conference")) return "border-electric/50";
  return "border-transparent";
}

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    // overflow-x-auto tạo scroll container ở CẢ HAI trục, khiến sticky của
    // thead bám vào div này thay vì viewport -> không bao giờ dính. Từ sm trở
    // lên bảng đủ chỗ nên bỏ overflow, sticky mới chạy thật.
    <div className="plate overflow-x-auto sm:overflow-visible">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="sticky top-[var(--header-h)] z-[1] bg-abyss">
          <tr className="border-b border-grid text-[11px] uppercase tracking-[0.1em] text-mist">
            <th className="px-3 py-2.5 text-left font-semibold">#</th>
            <th className="px-3 py-2.5 text-left font-semibold">Đội</th>
            <th className="px-2 py-2.5 text-center font-semibold" title="Số trận">
              Trận
            </th>
            <th className="px-2 py-2.5 text-center font-semibold" title="Thắng">
              T
            </th>
            <th className="px-2 py-2.5 text-center font-semibold" title="Hoà">
              H
            </th>
            <th className="px-2 py-2.5 text-center font-semibold" title="Thua">
              B
            </th>
            <th
              className="px-2 py-2.5 text-center font-semibold"
              title="Bàn thắng : bàn thua"
            >
              Bàn
            </th>
            <th className="px-2 py-2.5 text-center font-semibold" title="Hiệu số">
              HS
            </th>
            <th className="px-3 py-2.5 text-center font-semibold">Điểm</th>
            <th className="hidden px-3 py-2.5 text-left font-semibold lg:table-cell">
              Phong độ
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-grid">
          {rows.map((row) => {
            const isArsenal = row.team.id === ARSENAL_TEAM_ID;
            return (
              <tr
                key={row.team.id}
                className={`border-l-2 transition-colors duration-150 hover:bg-abyss-200 ${zoneAccent(row.description)} ${
                  isArsenal ? "bg-electric-wash" : ""
                }`}
              >
                <td className="px-3 py-2.5 tabular-nums text-mist">
                  {row.rank}
                </td>
                <td className="max-w-[220px] px-3 py-2.5">
                  <TeamBadge team={row.team} size={20} />
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-mist">
                  {row.all.played}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-mist">
                  {row.all.win}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-mist">
                  {row.all.draw}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-mist">
                  {row.all.lose}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-mist">
                  {row.all.goals.for}:{row.all.goals.against}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-mist">
                  {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
                </td>
                <td className="px-3 py-2.5 text-center font-display text-base font-semibold tabular-nums text-ghost">
                  {row.points}
                </td>
                <td className="hidden px-3 py-2.5 lg:table-cell">
                  <FormBadges form={row.form} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

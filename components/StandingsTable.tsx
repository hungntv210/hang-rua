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
            className={`inline-flex h-4 w-4 items-center justify-center rounded-md text-[10px] font-bold ${
              result === "W"
                ? "bg-royal text-ice"
                : result === "D"
                  ? "bg-sky-100 text-ink-soft"
                  : "bg-lose-wash text-lose"
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
  if (text.includes("relegation")) return "border-lose";
  if (text.includes("champions league")) return "border-royal";
  if (text.includes("europa") || text.includes("conference")) return "border-aqua";
  return "border-transparent";
}

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    // overflow-x-auto tạo scroll container ở CẢ HAI trục, khiến sticky của
    // thead bám vào div này thay vì viewport. Tệ hơn "không dính": `top` vẫn
    // được áp trong khung cuộn đó nên thead bị ĐẨY XUỐNG đúng bằng --header-h
    // và đè lên các hàng đầu. Vì vậy sticky chỉ bật từ sm, khi đã bỏ overflow.
    <div className="plate overflow-x-auto sm:overflow-visible">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="z-[1] bg-sky sm:sticky sm:top-[var(--header-h)]">
          <tr className="border-b border-ink/15 text-[11px] uppercase tracking-[0.1em] text-ink">
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
        <tbody className="divide-y divide-ink/15">
          {rows.map((row) => {
            const isArsenal = row.team.id === ARSENAL_TEAM_ID;
            return (
              <tr
                key={row.team.id}
                className={`border-l-2 hover:bg-sky-100 ${zoneAccent(row.description)} ${
                  isArsenal ? "bg-royal-100" : ""
                }`}
              >
                <td className="px-3 py-2.5 tabular-nums text-ink-soft">
                  {row.rank}
                </td>
                <td className="max-w-[220px] px-3 py-2.5">
                  <TeamBadge team={row.team} size={20} />
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-ink-soft">
                  {row.all.played}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-ink-soft">
                  {row.all.win}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-ink-soft">
                  {row.all.draw}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-ink-soft">
                  {row.all.lose}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-ink-soft">
                  {row.all.goals.for}:{row.all.goals.against}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-ink-soft">
                  {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
                </td>
                <td className="px-3 py-2.5 text-center font-display text-base font-extrabold tabular-nums text-ink">
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

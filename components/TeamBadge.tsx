import { ARSENAL_TEAM_ID } from "@/lib/config";
import type { TeamRef } from "@/lib/types";

interface Props {
  team: Pick<TeamRef, "id" | "name" | "logo">;
  /** Đảo chiều để đội khách nằm bên phải. */
  align?: "left" | "right";
  size?: number;
}

export function TeamBadge({ team, align = "left", size = 22 }: Props) {
  const highlight = team.id === ARSENAL_TEAM_ID;

  return (
    <span
      className={`flex min-w-0 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {team.logo ? (
        // Huy hiệu từ football-data.org — dùng <img> để khỏi phải cấu hình
        // image optimizer của Next cho domain ngoài.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          className="shrink-0 object-contain"
          style={{ width: size, height: size }}
        />
      ) : null}
      {/* Đội được đánh dấu chỉ đổi ĐỘ ĐẬM, không đổi màu: hàng của nó đã có nền
          xanh riêng, tô chữ xanh lên nền xanh vừa thừa tín hiệu vừa tụt tương
          phản xuống 4,27:1 — dưới ngưỡng đọc được. */}
      <span className={`truncate text-ghost ${highlight ? "font-semibold" : ""}`}>
        {team.name}
      </span>
    </span>
  );
}

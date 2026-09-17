"use client";

import { Fragment, useDeferredValue, useMemo, useState } from "react";

import { Notice } from "@/components/Notice";
import { OVR_ACCURACY } from "@/lib/save/career/ovr-model";
import { ATTRIBUTE_GROUPS, ATTRIBUTE_ORDER } from "@/lib/save/career/schema";
import type { SavePlayer } from "@/lib/save/types";

/** Vị trí trong mảng `attributes`, tra một lần thay vì `indexOf` mỗi ô. */
const ATTR_INDEX = new Map(ATTRIBUTE_ORDER.map((name, i) => [name, i]));

/**
 * Thang màu cho chỉ số: chỉ đổi ĐỘ SÁNG trong cùng họ xanh, không đổi sắc.
 *
 * Thang nhiều màu (xanh lá → vàng → đỏ) đọc nhanh hơn về mặt trực giác nhưng ở
 * đây thì sai: sắc anh đào đã mang nghĩa "đang diễn ra" ở chỗ khác trong ứng
 * dụng, dùng lại cho "chỉ số cao" sẽ làm nhoè quy ước. Độ sáng tăng dần vẫn quét
 * được bằng mắt mà không mượn nghĩa của màu khác.
 */
function attrColor(value: number): string {
  if (value >= 85) return "text-electric-bright";
  if (value >= 70) return "text-electric";
  if (value >= 55) return "text-ghost";
  return "text-mist-dim";
}

/** Bảng 31 chỉ số chi tiết của một cầu thủ — đọc thẳng từ save, không suy đoán. */
function PlayerDetail({ player }: { player: SavePlayer }) {
  const groups = ATTRIBUTE_GROUPS.filter((g) =>
    // Bỏ nhóm thủ môn với cầu thủ ngoài sân và ngược lại: hiển thị cả hai chỉ
    // làm loãng bảng bằng những con số không ai đọc.
    g.group === "Thủ môn" ? player.position === "GK" : player.position !== "GK",
  );

  return (
    <td colSpan={11} className="border-l-2 border-electric/50 bg-void-soft px-4 py-4">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="mb-1.5 text-xs uppercase tracking-wide opacity-60">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map(([key, label]) => {
                const value = player.attributes[ATTR_INDEX.get(key) ?? -1] ?? 0;
                return (
                  <li key={key} className="flex justify-between gap-4 text-sm">
                    <span className="opacity-75">{label}</span>
                    <span className={`font-medium tabular-nums ${attrColor(value)}`}>
                      {value || "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide opacity-60">Khác</p>
          <ul className="space-y-0.5 text-sm">
            <li className="flex justify-between gap-4">
              <span className="opacity-75">Kỹ năng</span>
              <span className="tabular-nums">{player.skillMoves ?? "—"} ★</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="opacity-75">Chân không thuận</span>
              <span className="tabular-nums">{player.weakFoot ?? "—"} ★</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="opacity-75">Danh tiếng</span>
              <span className="tabular-nums">{player.internationalReputation ?? "—"} ★</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="opacity-75">playerId</span>
              <span className="tabular-nums opacity-70">{player.playerId}</span>
            </li>
          </ul>
        </div>
      </div>
    </td>
  );
}

type SortKey = "overall" | "potential" | "growth" | "age" | "name";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "potential", label: "Tiềm năng" },
  { id: "overall", label: "Chỉ số" },
  { id: "growth", label: "Còn phát triển" },
  { id: "age", label: "Trẻ nhất" },
  { id: "name", label: "Tên" },
];

/** Số dòng dựng ra mỗi lần. Bảng có hơn 20.000 cầu thủ nên không thể render hết. */
const PAGE = 100;

function growth(p: SavePlayer): number {
  if (p.overall === null || p.potential === null) return -1;
  return p.potential - p.overall;
}

/** Nhóm bản ghi đã bỏ qua — báo số lượng thay vì im lặng cắt bớt. */
export interface SkippedGroups {
  /** Icon và hero Ultimate Team: có trong roster game, không thuộc career. */
  icons: number;
  /** Cầu thủ nữ: save chứa cả hai nhánh, career chỉ ở một nhánh. */
  women: number;
}

export function PlayerTable({
  players,
  skipped,
}: {
  players: SavePlayer[];
  skipped?: SkippedGroups;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("potential");
  const [onlyNewgen, setOnlyNewgen] = useState(false);
  const [maxAge, setMaxAge] = useState<number | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const [openId, setOpenId] = useState<number | null>(null);

  // Lọc chạy trên hơn 20.000 dòng nên bám thẳng vào ô nhập sẽ giật khi gõ.
  const deferredQuery = useDeferredValue(query);

  const rows = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const filtered = players.filter((p) => {
      if (onlyNewgen && p.nameSource !== "newgen") return false;
      if (maxAge !== null && (p.age === null || p.age > maxAge)) return false;
      if (!needle) return true;
      return (
        (p.name?.toLowerCase().includes(needle) ?? false) ||
        (p.club?.toLowerCase().includes(needle) ?? false) ||
        (p.nation?.toLowerCase().includes(needle) ?? false) ||
        p.position.toLowerCase() === needle ||
        String(p.playerId) === needle
      );
    });

    const cmp: Record<SortKey, (a: SavePlayer, b: SavePlayer) => number> = {
      potential: (a, b) => (b.potential ?? -1) - (a.potential ?? -1),
      overall: (a, b) => (b.overall ?? -1) - (a.overall ?? -1),
      growth: (a, b) => growth(b) - growth(a),
      age: (a, b) => (a.age ?? 999) - (b.age ?? 999),
      name: (a, b) => (a.name ?? "").localeCompare(b.name ?? ""),
    };
    return [...filtered].sort(cmp[sort]);
  }, [players, deferredQuery, sort, onlyNewgen, maxAge]);

  const shown = rows.slice(0, visible);
  const unnamed = useMemo(() => players.filter((p) => p.name === null).length, [players]);
  const dropped = (skipped?.icons ?? 0) + (skipped?.women ?? 0);

  return (
    <div className="space-y-4">
      <Notice title="Bấm vào một dòng để xem đủ 31 chỉ số chi tiết">
        Toàn bộ chỉ số đọc trực tiếp từ file save của bạn.{" "}
        <strong>Chỉ cột CS là giá trị tính</strong> — file save không lưu chỉ số tổng,
        nên trang dựng lại từ 31 chỉ số thành phần, sai số ±1 ở{" "}
        {(OVR_ACCURACY.withinOne * 100).toFixed(1)}% trường hợp. Tiềm năng, ngày sinh,
        thể hình, vị trí và quốc tịch thì đọc thẳng, không suy đoán.
        {" "}
        <strong>Riêng cột &ldquo;CLB gốc&rdquo; thì không đọc từ save</strong> — file
        save chưa giải mã được CLB, nên cột này mượn từ dữ liệu công khai của EA đầu
        mùa. Với cầu thủ đã chuyển nhượng trong career, đó là CLB cũ.
        {dropped > 0 ? (
          <>
            {" "}
            <strong>Đã bỏ qua {dropped.toLocaleString("vi-VN")} bản ghi</strong> không
            thuộc phạm vi career nam:{" "}
            {skipped?.women ? `${skipped.women.toLocaleString("vi-VN")} cầu thủ nữ` : ""}
            {skipped?.women && skipped?.icons ? " và " : ""}
            {skipped?.icons
              ? `${skipped.icons.toLocaleString("vi-VN")} icon/hero Ultimate Team`
              : ""}
            . Save chứa toàn bộ roster của game, gồm cả nhánh bóng đá nữ và nội dung
            Ultimate Team — đó là lý do trước đây có huyền thoại 44 tuổi chỉ số 91
            đứng đầu bảng.
          </>
        ) : null}
        {unnamed > 0 ? (
          <>
            {" "}
            <strong>{unnamed.toLocaleString("vi-VN")} cầu thủ chưa có tên</strong> — họ
            không có trong cơ sở dữ liệu công khai (chủ yếu là đội trẻ và đội dự bị,
            nhóm không trang thống kê nào liệt kê) và file save cũng không lưu tên
            của họ. Chỉ số của họ vẫn đọc được đầy đủ.
          </>
        ) : null}
      </Notice>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE);
          }}
          placeholder="Tìm theo tên, CLB gốc, quốc tịch, vị trí hoặc ID…"
          className="focus-ring min-w-[16rem] flex-1 rounded-sm border border-grid bg-void-soft px-3 py-2 text-sm text-ghost placeholder:text-mist-dim"
        />
        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSort(s.id);
                setVisible(PAGE);
              }}
              className={`tab ${sort === s.id ? "tab-active" : ""}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyNewgen}
            onChange={(e) => {
              setOnlyNewgen(e.target.checked);
              setVisible(PAGE);
            }}
          />
          Chỉ cầu thủ do career sinh ra
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={maxAge !== null}
            onChange={(e) => {
              setMaxAge(e.target.checked ? 21 : null);
              setVisible(PAGE);
            }}
          />
          Chỉ cầu thủ từ 21 tuổi trở xuống
        </label>
        <span className="opacity-70">
          {rows.length.toLocaleString("vi-VN")} / {players.length.toLocaleString("vi-VN")} cầu thủ
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="text-left opacity-70">
            <tr>
              <th className="py-2 pr-3">Cầu thủ</th>
              <th className="py-2 pr-3">
                <span title="CLB theo dữ liệu công khai của EA đầu mùa — không phải CLB hiện tại trong career">
                  CLB gốc
                </span>
              </th>
              <th className="py-2 pr-3">Quốc tịch</th>
              <th className="py-2 pr-3">VT</th>
              <th className="py-2 pr-3 text-right">Tuổi</th>
              <th className="py-2 pr-3 text-right">CS</th>
              <th className="py-2 pr-3 text-right">TN</th>
              <th className="py-2 pr-3 text-right">+</th>
              <th className="py-2 pr-3">Ngày sinh</th>
              <th className="py-2 pr-3 text-right">Cao</th>
              <th className="py-2 text-right">Nặng</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const grow = growth(p);
              const open = openId === p.playerId;
              return (
                <Fragment key={p.playerId}>
                <tr
                  onClick={() => setOpenId(open ? null : p.playerId)}
                  className="cursor-pointer border-t border-white/10 hover:bg-white/5"
                >
                  <td className="py-1.5 pr-3">
                    {p.name ?? (
                      <span className="opacity-50">
                        {p.nation ? `Cầu thủ ${p.nation}` : `#${p.playerId}`}
                      </span>
                    )}
                    {p.nameSource === "newgen" ? (
                      <span
                        title="Cầu thủ do Career Mode sinh ra — tên lấy từ chính file save"
                        className="ml-2 rounded-sm border border-orchid/40 bg-orchid-wash px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-orchid"
                      >
                        newgen
                      </span>
                    ) : null}
                    {p.name === null ? (
                      <span
                        title="Không có trong DB nhúng và cũng không phải cầu thủ do career sinh ra"
                        className="ml-2 rounded border border-crimson/30 bg-crimson-wash px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-crimson"
                      >
                        chưa có tên
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 opacity-80">{p.club ?? "—"}</td>
                  <td className="py-1.5 pr-3 opacity-80">{p.nation ?? "—"}</td>
                  <td className="py-1.5 pr-3">{p.position}</td>
                  <td className="py-1.5 pr-3 text-right">{p.age ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-medium">{p.overall ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-medium">{p.potential ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right opacity-70">
                    {grow > 0 ? `+${grow}` : grow === 0 ? "0" : "—"}
                  </td>
                  <td className="py-1.5 pr-3 opacity-70">{p.birthDate ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right opacity-70">
                    {p.heightCm ? `${p.heightCm}cm` : "—"}
                  </td>
                  <td className="py-1.5 text-right opacity-70">
                    {p.weightKg ? `${p.weightKg}kg` : "—"}
                  </td>
                </tr>
                {open ? (
                  <tr>
                    <PlayerDetail player={p} />
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible < rows.length ? (
        <button type="button" onClick={() => setVisible((v) => v + PAGE * 5)} className="tab">
          Hiện thêm {Math.min(PAGE * 5, rows.length - visible)} cầu thủ
        </button>
      ) : null}

      {rows.length === 0 ? (
        <p className="py-8 text-center opacity-60">Không có cầu thủ nào khớp bộ lọc.</p>
      ) : null}
    </div>
  );
}

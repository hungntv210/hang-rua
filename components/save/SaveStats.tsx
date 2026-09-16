import { formatBytes, formatCount, formatOffset, formatPercent } from "@/lib/save/format";
import type { SaveDocument } from "@/lib/save/types";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="plate p-3 sm:p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ghost">{value}</p>
      {hint ? <p className="mt-1 text-xs text-mist">{hint}</p> : null}
    </div>
  );
}

/**
 * Bảng chỉ số của lượt đọc.
 *
 * "Độ phủ" là con số đáng nhìn nhất: nó nói bao nhiêu phần trăm file đã được
 * parser nhận dạng. Phủ thấp không phải lỗi hiển thị — nó nghĩa là phần lớn
 * file vẫn nằm ngoài tầm hiểu của cấu trúc TLV mà ta giả định.
 */
export function SaveStats({ doc }: { doc: SaveDocument }) {
  const { meta, counters } = doc;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Field nhận dạng được"
          value={formatCount(counters.fieldCount)}
          hint={`${formatCount(counters.distinctNameCount)} tên khác nhau`}
        />
        <Stat
          label="Độ phủ"
          value={formatPercent(counters.coverage)}
          hint={`${formatBytes(counters.unknownBytes)} chưa giải mã`}
        />
        <Stat
          label="Chuỗi tìm được"
          value={formatCount(counters.looseStringCount + counters.stringTokenCount)}
          hint={`${formatCount(counters.stringTokenCount)} token có khai báo độ dài`}
        />
        <Stat
          label="Thời gian đọc"
          value={`${formatCount(meta.parseMs)} ms`}
          hint={`${formatBytes(meta.fileSize)} · ${formatCount(counters.unknownRegionCount)} vùng chưa giải mã`}
        />
      </div>

      <dl className="plate grid gap-x-6 gap-y-2 p-3 text-sm sm:grid-cols-2 sm:p-4">
        <div className="flex justify-between gap-4">
          <dt className="text-mist">Tên file</dt>
          <dd className="truncate font-mono text-xs text-ghost">{meta.fileName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-mist">Magic</dt>
          <dd className="font-mono text-xs text-ghost">
            {meta.magic || "—"}{" "}
            <span className={meta.isFbchunks ? "text-electric" : "text-crimson"}>
              {meta.isFbchunks ? "✓ FBCHUNKS" : "✗ không khớp"}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-mist">Tag cmBNRY</dt>
          <dd className="font-mono text-xs text-ghost">
            {meta.cmBnryOffset === null ? (
              <span className="text-crimson">không tìm thấy</span>
            ) : (
              formatOffset(meta.cmBnryOffset)
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-mist">Header words</dt>
          <dd className="truncate font-mono text-xs text-ghost">
            {meta.headerWords.join(" · ") || "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

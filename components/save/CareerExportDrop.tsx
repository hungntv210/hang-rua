"use client";

import { useRef, useState } from "react";

import {
  EXPORT_FILES,
  REQUIRED_FILES,
  parseCareerExport,
  type CareerExport,
} from "@/lib/fc26/career-export";

/**
 * Nạp bản export career (các file CSV do `fc26-dump-career.lua` sinh ra).
 *
 * ─── VÌ SAO LÀ TUỲ CHỌN, KHÔNG PHẢI BẮT BUỘC ────────────────────────────────
 *
 * Trang chạy đầy đủ chỉ với file save. Bản export thêm vào ba thứ mà save không
 * lưu được: đội hình THẬT đã xếp, số áo, và lương. Không có nó thì trang vẫn
 * hiện đội hình gợi ý — kém hơn, nhưng đúng và tự đủ.
 *
 * Nên chỗ này phải trông như một tuỳ chọn nâng cao, không phải một bước bắt
 * buộc chắn giữa người dùng và kết quả.
 *
 * ─── VÌ SAO KHỚP THEO TÊN FILE ──────────────────────────────────────────────
 *
 * Người dùng chọn nhiều file cùng lúc và không ai nhớ thứ tự. Khớp theo tên thì
 * chọn lộn xộn vẫn đúng; khớp theo thứ tự thì chọn nhầm sẽ cho ra dữ liệu sai
 * chứ không phải một lỗi nhìn thấy được.
 */

interface Props {
  /**
   * Bản export đang nạp, do tầng trên giữ.
   *
   * KHÔNG giữ ở đây. Bản đầu giữ trạng thái "đã nạp" trong chính component, và
   * nó biến mất mỗi lần component bị gỡ khỏi cây — điều xảy ra mỗi khi người
   * dùng tải file save mới, vì lúc đội hình tạm thời là `null` thì cả nhánh này
   * không được vẽ. Người dùng thấy ô nạp tụt về "chưa có gì" và tưởng export
   * của mình bị quên.
   */
  data: CareerExport | null;
  onLoad: (data: CareerExport | null) => void;
  /** Kết quả đối chiếu với file save, do tầng trên tính. */
  gate?: { ok: boolean; message: string } | null;
  /** Đội hình đang hiển thị có thật sự lấy từ export không. */
  inUse: boolean;
}

export function CareerExportDrop({ data, onLoad, gate, inUse }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loaded = data
    ? { jerseys: data.jerseyOf.size, wages: data.wageOf.size, sheets: data.sheets.length }
    : null;

  async function accept(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const files = new Map<string, string>();
      const wanted = new Set(Object.values(EXPORT_FILES).map((f) => f.toLowerCase()));
      for (const file of Array.from(list)) {
        const name = file.name.toLowerCase();
        if (wanted.has(name)) files.set(name, await file.text());
      }

      const result = parseCareerExport(files);
      if (!result.ok) {
        onLoad(null);
        setError(
          result.missing
            ? `Thiếu ${result.missing.join(", ")}. Chọn cả ${REQUIRED_FILES.length} file bắt buộc cùng lúc.`
            : result.reason,
        );
        return;
      }
      onLoad(result.data);
    } catch (e) {
      onLoad(null);
      setError(e instanceof Error ? e.message : "không đọc được file");
    } finally {
      setBusy(false);
    }
  }

  /*
   * Ba trạng thái, ba thông điệp khác nhau — và phân biệt chúng là cả điểm của
   * component này. "Đã nạp" không đồng nghĩa với "đang dùng": bản export có thể
   * đọc được hoàn hảo mà vẫn bị cổng chặn thời điểm từ chối vì nó mô tả một
   * thời điểm khác với file save. Gộp hai trạng thái đó lại là cách chắc chắn
   * để người dùng tin rằng họ đang xem đội hình thật trong khi không phải.
   */
  const tone = error
    ? "border-crimson/50 bg-crimson-wash/40"
    : inUse
      ? "border-jade/40 bg-jade-wash/40"
      : loaded
        ? "border-amber/40 bg-amber-wash/40"
        : "border-grid bg-abyss/40";

  /*
   * Thu gọn thành một dòng mở được.
   *
   * Bản trước là một khung lớn chiếm đầu trang, và nó đọc như một BƯỚC BẮT
   * BUỘC — đúng thứ người dùng phản đối: họ không muốn chạy lại script Lua mỗi
   * lần có save mới. Trang chạy đủ chỉ với file save; bản export chỉ thêm đội
   * hình thật và lương.
   *
   * Nhưng khi nó ĐANG được dùng hoặc ĐANG báo lỗi thì mở sẵn: một trạng thái
   * đáng chú ý mà giấu sau một cú bấm thì coi như không tồn tại.
   */
  const notable = !!error || inUse || (!!loaded && !!gate && !gate.ok);

  return (
    <details
      open={notable}
      className={`rounded-sm border border-dashed px-3 py-2 ${tone}`}
    >
      <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 text-[12px] text-mist marker:content-none">
        <span className="font-mono text-[10px] text-mist-dim" aria-hidden>
          ▸
        </span>
        <span className="text-ghost">Đội hình thật, số áo và lương</span>
        {inUse ? (
          <span className="rounded-[2px] bg-jade-wash px-1 font-mono text-[9px] uppercase text-jade">
            đang dùng
          </span>
        ) : loaded && gate && !gate.ok ? (
          <span className="rounded-[2px] bg-amber-wash px-1 font-mono text-[9px] uppercase text-amber">
            không khớp save
          </span>
        ) : (
          <span className="text-mist-dim">— tuỳ chọn, cần chạy script Lua</span>
        )}
      </summary>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-relaxed text-mist">
            {error ? (
              <span className="text-crimson">{error}</span>
            ) : inUse && gate ? (
              <span className="text-jade">Đang dùng đội hình thật — {gate.message}.</span>
            ) : loaded && gate && !gate.ok ? (
              <span className="text-amber">Đã đọc được nhưng KHÔNG dùng: {gate.message}</span>
            ) : loaded ? (
              <span className="text-amber">
                Đã nạp {loaded.sheets} đội hình, {loaded.jerseys} số áo, {loaded.wages} mức lương —
                chờ đối chiếu với file save.
              </span>
            ) : (
              <>
                <strong>Không cần cho việc dùng trang hằng ngày.</strong> Số áo, tên
                CLB, danh sách đội và cầu thủ trẻ đều đã đọc được từ chính file save.
                Bản export chỉ thêm hai thứ mà save không lưu:{" "}
                <strong>đội hình bạn đã xếp</strong> và <strong>lương</strong>. Muốn
                có thì chạy <code>scripts/fc26-dump-career.lua</code> trong Live
                Editor rồi chọn {REQUIRED_FILES.length} file <code>fc26_*.csv</code> —
                và phải làm lại mỗi lần muốn cập nhật, vì cả hai đều đổi theo từng
                thời điểm trong career.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          className="tab shrink-0 disabled:opacity-50"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Đang đọc…" : loaded ? "Chọn lại" : "Chọn file CSV"}
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv"
          className="sr-only"
          onChange={(event) => {
            void accept(event.target.files);
            // Xoá giá trị để chọn lại đúng file đó lần nữa vẫn kích hoạt onChange.
            event.target.value = "";
          }}
        />
      </div>
    </details>
  );
}

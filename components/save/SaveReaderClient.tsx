"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Notice } from "@/components/Notice";
import { PlayerTable } from "@/components/save/PlayerTable";
import { SaveDropZone } from "@/components/save/SaveDropZone";
import { SaveFieldTable } from "@/components/save/SaveFieldTable";
import { SaveNameList } from "@/components/save/SaveNameList";
import { SaveStats } from "@/components/save/SaveStats";
import { SaveStringList } from "@/components/save/SaveStringList";
import { SaveUnknownList } from "@/components/save/SaveUnknownList";
import { TabBar, TabPanel, type TabItem } from "@/components/TabBar";
import { loadFc26Database } from "@/lib/fc26/db";
import { formatBytes, formatCount } from "@/lib/save/format";
import { FILE_LIMITS } from "@/lib/save/heuristics";
import type { SaveDocument, SavePlayer, WorkerResponse } from "@/lib/save/types";

type Tab = "players" | "fields" | "names" | "strings" | "unknown";

const TABS: TabItem<Tab>[] = [
  { id: "players", label: "Cầu thủ", labelJp: "選手" },
  { id: "fields", label: "Field" },
  { id: "names", label: "Tên field" },
  { id: "strings", label: "Chuỗi rời" },
  { id: "unknown", label: "Vùng chưa giải mã" },
];

/**
 * Điều phối toàn bộ luồng: thả file → worker → hiển thị.
 *
 * File được chuyển thẳng vào worker; main thread KHÔNG bao giờ giữ ArrayBuffer
 * vài chục MB, và `SaveDocument` trả về cũng không giữ tham chiếu tới buffer —
 * chỉ có field đã bóc và vài chuỗi hex ngắn.
 */
export function SaveReaderClient() {
  const [doc, setDoc] = useState<SaveDocument | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [largeFileNotice, setLargeFileNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("players");
  const [players, setPlayers] = useState<SavePlayer[] | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Tải DB tên ngay khi trang mở, song song với việc người dùng chọn file: 1,5MB
  // tải xong trước cả khi thả xong file, nên bảng không phải chờ thêm nhịp nào.
  useEffect(() => {
    void loadFc26Database();
  }, []);

  // Ghép tên cầu thủ có sẵn từ DB nhúng. Việc này nằm ở client chứ không trong
  // worker để `lib/save/*` không phải biết tới `fetch` và vẫn chạy được bằng Node.
  useEffect(() => {
    const career = doc?.career;
    if (!career) {
      setPlayers(null);
      return;
    }
    let alive = true;
    setPlayers(career.players);
    void loadFc26Database().then((db) => {
      if (!alive || !db) return;
      setPlayers(
        career.players.map((p) => {
          // Quốc tịch tra được cho MỌI cầu thủ vì mã quốc gia đọc thẳng từ save.
          // Với nhóm không có tên, đây là mẩu nhận dạng duy nhất còn lại.
          const nation = db.nation(p.nationalityId);
          if (p.nameSource === "newgen") return { ...p, nation };
          const entry = db.get(p.playerId);
          if (!entry) return { ...p, nation };
          return {
            ...p,
            name: entry.name,
            nameSource: "database" as const,
            club: entry.club,
            league: entry.league,
            nation: entry.nation || nation,
          };
        }),
      );
    });
    return () => {
      alive = false;
    };
  }, [doc]);

  // Dọn worker khi rời trang: worker sống độc lập với React, không tự chết theo
  // component.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const parseOnMainThread = useCallback(async (file: File) => {
    // Đường lui khi không tạo được worker. Chậm và làm khựng tab, nhưng vẫn ra
    // kết quả — thà chậm còn hơn trang chết.
    const { parseSaveBuffer } = await import("@/lib/save");
    const buffer = await file.arrayBuffer();
    const parsed = parseSaveBuffer(buffer, { fileName: file.name });
    setDoc(parsed);
    setProgress(null);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setDoc(null);
      setError(null);
      setProgress(0);
      setTab("players");
      setLargeFileNotice(
        file.size > FILE_LIMITS.warnBytes
          ? `File ${formatBytes(file.size)} khá lớn — lượt quét có thể mất vài giây và ngốn vài trăm MB RAM của tab.`
          : null,
      );

      workerRef.current?.terminate();

      let worker: Worker;
      try {
        worker = new Worker(new URL("../../lib/save/parse.worker.ts", import.meta.url));
      } catch {
        void parseOnMainThread(file).catch((cause: unknown) => {
          setProgress(null);
          setError(
            cause instanceof Error ? cause.message : "Không đọc được file.",
          );
        });
        return;
      }

      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.kind === "progress") {
          setProgress(message.ratio);
          return;
        }
        if (message.kind === "done") {
          setDoc(message.doc);
          setProgress(null);
          worker.terminate();
          workerRef.current = null;
          return;
        }
        setError(message.message);
        setProgress(null);
        worker.terminate();
        workerRef.current = null;
      };

      worker.onerror = (event) => {
        setError(
          event.message ||
            "Worker dừng bất thường. Thử lại, hoặc mở console để xem chi tiết.",
        );
        setProgress(null);
        worker.terminate();
        workerRef.current = null;
      };

      worker.postMessage({ kind: "parse", file });
    },
    [parseOnMainThread],
  );

  return (
    <div className="space-y-6">
      <SaveDropZone onFile={handleFile} busy={progress !== null} progress={progress} />

      {largeFileNotice && progress !== null ? (
        <Notice title="File lớn">{largeFileNotice}</Notice>
      ) : null}

      {error ? (
        <Notice tone="error" title="Không đọc được file">
          {error}
        </Notice>
      ) : null}

      {doc ? <SaveResult doc={doc} tab={tab} onTab={setTab} players={players} /> : null}
    </div>
  );
}

function SaveResult({
  doc,
  tab,
  onTab,
  players,
}: {
  doc: SaveDocument;
  tab: Tab;
  onTab: (tab: Tab) => void;
  players: SavePlayer[] | null;
}) {
  return (
    <div className="space-y-6">
      <SaveStats doc={doc} />

      {doc.issues.map((issue) => (
        <Notice
          key={issue.message}
          tone={issue.level === "error" ? "error" : "info"}
          title={
            issue.level === "error"
              ? "Không bóc được dữ liệu"
              : issue.level === "warn"
                ? "Cần lưu ý"
                : "Ghi chú"
          }
        >
          {issue.message}
        </Notice>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabBar
          tabs={TABS}
          active={tab}
          onChange={onTab}
          group="save-reader"
          ariaLabel="Các lớp dữ liệu trong file save"
        />
        <ExportButtons doc={doc} />
      </div>

      <TabPanel tabKey={tab}>
      {tab === "players" ? (
        players && players.length > 0 ? (
          <PlayerTable players={players} />
        ) : (
          <Notice tone="error" title="Không đọc được danh sách cầu thủ">
            Không định vị được bảng cầu thủ trong file này. File có thể thuộc phiên
            bản FC khác, hoặc không phải save Career Mode. Các tab còn lại vẫn dùng
            được.
          </Notice>
        )
      ) : null}
      {tab === "fields" ? (
        <SaveFieldTable fields={doc.fields} fieldStats={doc.fieldStats} />
      ) : null}
      {tab === "names" ? <SaveNameList stats={doc.fieldStats} /> : null}
      {tab === "strings" ? (
        <SaveStringList tokens={doc.stringTokens} strings={doc.looseStrings} />
      ) : null}
      {tab === "unknown" ? <SaveUnknownList regions={doc.unknownRegions} /> : null}
      </TabPanel>
    </div>
  );
}

/**
 * Hai mức xuất khác nhau vì kích thước chênh nhau hàng trăm lần: bản tóm tắt
 * vài trăm KB để đọc và chia sẻ, bản đầy đủ có thể hàng trăm MB nếu save nhiều
 * field. Gộp thành một nút sẽ khiến người dùng vô tình tải bản khổng lồ.
 */
function ExportButtons({ doc }: { doc: SaveDocument }) {
  function download(data: unknown, suffix: string) {
    const base = doc.meta.fileName.replace(/[^\w.-]+/g, "_") || "save";
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${base}.${suffix}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() =>
          download(
            {
              meta: doc.meta,
              counters: doc.counters,
              issues: doc.issues,
              fieldStats: doc.fieldStats,
              unknownRegions: doc.unknownRegions,
              looseStrings: doc.looseStrings,
            },
            "tom-tat",
          )
        }
        className="tab"
      >
        Tải JSON tóm tắt
      </button>
      <button type="button" onClick={() => download(doc, "day-du")} className="tab">
        Tải JSON đầy đủ ({formatCount(doc.counters.fieldCount)} field)
      </button>
    </div>
  );
}

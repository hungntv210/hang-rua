"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Notice } from "@/components/Notice";
import { PlayerTable } from "@/components/save/PlayerTable";
import { CareerExportDrop } from "@/components/save/CareerExportDrop";
import { SaveDropZone } from "@/components/save/SaveDropZone";
import { SaveFieldTable } from "@/components/save/SaveFieldTable";
import { SaveNameList } from "@/components/save/SaveNameList";
import { SaveStats } from "@/components/save/SaveStats";
import { SaveStringList } from "@/components/save/SaveStringList";
import { SaveUnknownList } from "@/components/save/SaveUnknownList";
import { SquadHub } from "@/components/save/SquadHub";
import { YouthList } from "@/components/save/YouthList";
import { TabBar, TabPanel, type TabItem } from "@/components/TabBar";
import { loadFc26Database } from "@/lib/fc26/db";
import { loadFc26Squads, type ClubMatch } from "@/lib/fc26/squads";
import { findYouthPlayers, type YouthResult } from "@/lib/fc26/youth";
import { loadFc26Formations } from "@/lib/fc26/formations";
import { buildLineup, lineupFromSheets, pickSquad, type Lineup } from "@/lib/fc26/lineup";
import { bestGate, gateSheets, type CareerExport, type GateResult } from "@/lib/fc26/career-export";
import { loadFc26Names } from "@/lib/fc26/names";
import {
  diagnosticsToJson,
  playersToCsv,
  playersToJson,
} from "@/lib/save/career/export";
import { formatBytes, formatCount } from "@/lib/save/format";
import { FILE_LIMITS } from "@/lib/save/heuristics";
import type { SaveDocument, SavePlayer, WorkerResponse } from "@/lib/save/types";

type Tab = "lineup" | "youth" | "players" | "fields" | "names" | "strings" | "unknown";

const TABS: TabItem<Tab>[] = [
  { id: "lineup", label: "Đội hình", labelJp: "布陣" },
  { id: "youth", label: "Cầu thủ trẻ", labelJp: "育成" },
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
  const [tab, setTab] = useState<Tab>("lineup");
  const [players, setPlayers] = useState<SavePlayer[] | null>(null);
  const [lineup, setLineup] = useState<Lineup | null>(null);
  /** Bản export career người dùng nạp thêm. `null` là bình thường, không phải lỗi. */
  const [careerExport, setCareerExport] = useState<CareerExport | null>(null);
  /** Kết quả đối chiếu export với save — hiển thị nguyên văn cho người dùng. */
  const [exportGate, setExportGate] = useState<GateResult | null>(null);
  /** CLB nhận ra từ roster gốc — cho số áo và tên đội. `null` với CLB tự tạo. */
  const [club, setClub] = useState<ClubMatch | null>(null);
  /** Cầu thủ trẻ do career sinh ra, lọc từ chính save. */
  const [youth, setYouth] = useState<YouthResult | null>(null);
  const [iconCount, setIconCount] = useState(0);
  const workerRef = useRef<Worker | null>(null);

  // Tải DB tên ngay khi trang mở, song song với việc người dùng chọn file: 1,5MB
  // tải xong trước cả khi thả xong file, nên bảng không phải chờ thêm nhịp nào.
  useEffect(() => {
    void loadFc26Database();
    void loadFc26Names();
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
    void Promise.all([loadFc26Database(), loadFc26Names()]).then(([db, names]) => {
      if (!alive || !db) return;
      /*
       * Bỏ nội dung Ultimate Team khỏi danh sách.
       *
       * Icon và hero có trong roster của game nên có trong save, nhưng không
       * thuộc career. Trước đây chúng được gắn nhãn và vẫn hiển thị; nhưng vì
       * bảng sắp theo chỉ số nên một loạt huyền thoại 44 tuổi chỉ số 91 vẫn nằm
       * ngay đầu danh sách, che mất cầu thủ thật. Bỏ hẳn, và BÁO SỐ LƯỢNG —
       * danh sách hụt vài nghìn người mà không nói gì thì trông như parser sót.
       */
      let icons = 0;
      setPlayers(
        career.players
          .filter((p) => {
            if (!db.isUltimateTeam(p.playerId)) return true;
            icons += 1;
            return false;
          })
          .map((p) => {
          // Quốc tịch tra được cho MỌI cầu thủ vì mã quốc gia đọc thẳng từ save.
          // Với nhóm không có tên, đây là mẩu nhận dạng duy nhất còn lại.
          const nation = db.nation(p.nationalityId);
          if (p.nameSource === "newgen") return { ...p, nation };
          const entry = db.get(p.playerId);
          if (!entry) {
            /*
             * Không có trong DB thì tra KHO TÊN bằng chỉ số đọc từ save.
             *
             * Đây là cách duy nhất lấy được tên cầu thủ do career sinh ra: save
             * chỉ lưu chuỗi tên cho 22/55 nhóm này, còn lại thì tên không có
             * trong file dưới dạng chữ. Đo trên career thật: 55/55 giải được.
             */
            const fromPool = names?.resolve(p.firstNameId, p.lastNameId, p.commonNameId);
            if (fromPool) {
              return { ...p, nation, name: fromPool, nameSource: "namePool" as const };
            }
            return { ...p, nation };
          }
          return {
            ...p,
            name: entry.name,
            nameSource: "database" as const,
            // `|| null` chứ không gán thẳng: từ khi DB gộp theo từng trường, một
            // cầu thủ có thể có tên mà không có CLB (nguồn Live Editor cố ý không
            // góp CLB). Giá trị khi đó là chuỗi rỗng, và chuỗi rỗng KHÔNG kích
            // hoạt `?? "—"` ở bảng — ô hiện ra trắng trơn, trông như lỗi giao diện
            // thay vì "không có dữ liệu".
            club: entry.club || null,
            league: entry.league || null,
            nation: entry.nation || nation,
          };
        }),
      );
      setIconCount(icons);
    });
    return () => {
      alive = false;
    };
  }, [doc]);

  /**
   * Đối chiếu đội hình đọc từ save với bảng sơ đồ đã dựng sẵn.
   *
   * Tách khỏi effect ghép tên vì hai việc độc lập: mất bảng sơ đồ thì vẫn còn
   * bảng cầu thủ, và ngược lại.
   */
  useEffect(() => {
    const career = doc?.career;
    if (!career || career.squads.length === 0) {
      setLineup(null);
      return;
    }
    let alive = true;
    void Promise.all([
      loadFc26Formations(),
      import("@/lib/save/career/schema"),
      loadFc26Squads(),
      loadFc26Database(),
    ]).then(([table, schema, squadDb, db]) => {
        if (!alive || !table) return;
        // Cần chỉ số và vị trí sở trường của MỌI cầu thủ đọc được, không chỉ
        // của đội — `pickSquad` phải nhận ra khối nào là một đội bóng thật.
        const byId = new Map(
          career.players.map((p) => [
            p.playerId,
            { playerId: p.playerId, position: p.position, overall: p.overall },
          ]),
        );
        const squad = pickSquad(career.squads, byId);
        if (!squad) {
          setLineup(null);
          setExportGate(null);
          setClub(null);
          setYouth(null);
          return;
        }

        /*
         * Nhận CLB từ roster gốc, để có số áo và tên đội.
         *
         * Số áo là hằng số theo phiên bản game nên bake được — khác hẳn đội
         * hình xuất phát. Trả `null` với CLB người chơi tự tạo, và đó là hành
         * vi đúng: đoán bừa từng khớp nhầm một CLB tự tạo với "AFC Bournemouth"
         * chỉ vì chín cầu thủ trong đội vốn từ đó.
         */
        const matched = squadDb?.matchClub(squad) ?? null;
        setClub(matched);

        /*
         * Cầu thủ trẻ: lọc từ chính save, không cần bản export.
         *
         * Dấu hiệu là "không có trong DB nhúng" — tức do career sinh ra. Ngưỡng
         * ID không dùng được: career này dùng dải 9xxx, career trước dùng
         * 460xxx, hai dải không liên quan gì nhau.
         */
        if (db) {
          setYouth(findYouthPlayers(career.players, db.ids(), new Set(squad)));
        } else {
          setYouth(null);
        }

        /*
         * Có bản export thì thử đội hình THẬT trước, nhưng chỉ khi nó qua cổng
         * chặn thời điểm. Trượt cổng thì lùi về đội hình gợi ý và GIỮ LẠI lý do
         * để nói ra — im lặng lùi về sẽ khiến người dùng tưởng export của họ
         * không được đọc, rồi đi chạy lại script một cách vô ích.
         */
        if (careerExport) {
          const inSave = new Set(squad);
          const passed = gateSheets(careerExport, inSave);
          setExportGate(bestGate(careerExport, inSave));
          if (passed.length > 0) {
            const built = lineupFromSheets(
              passed.map((p) => p.sheet),
              squad,
              byId,
              careerExport.slotCodeOf,
              table.shapes,
              schema.positionName,
            );
            if (built) {
              setLineup(built.lineup);
              return;
            }
          }
        } else {
          setExportGate(null);
        }

        setLineup(buildLineup(squad, byId, table.shapes, schema.positionName));
    });
    return () => {
      alive = false;
    };
  }, [doc, careerExport]);

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
      setTab("lineup");
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

      {doc ? (
        <SaveResult
          doc={doc}
          tab={tab}
          onTab={setTab}
          players={players}
          lineup={lineup}
          iconCount={iconCount}
          careerExport={careerExport}
          onCareerExport={setCareerExport}
          exportGate={exportGate}
          club={club}
          youth={youth}
        />
      ) : null}
    </div>
  );
}

function SaveResult({
  doc,
  tab,
  onTab,
  players,
  lineup,
  iconCount,
  careerExport,
  onCareerExport,
  exportGate,
  club,
  youth,
}: {
  doc: SaveDocument;
  tab: Tab;
  onTab: (tab: Tab) => void;
  players: SavePlayer[] | null;
  lineup: Lineup | null;
  careerExport: CareerExport | null;
  onCareerExport: (data: CareerExport | null) => void;
  exportGate: GateResult | null;
  club: ClubMatch | null;
  youth: YouthResult | null;
  iconCount: number;
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
        <ExportButtons doc={doc} players={players} />
      </div>

      <TabPanel tabKey={tab}>
      {tab === "lineup" ? (
        <div className="space-y-4">
          {/* Ô nạp export nằm NGOÀI nhánh điều kiện: trong nhánh thì nó bị gỡ
              khỏi cây mỗi khi đội hình tạm thời không dựng được, và người dùng
              mất luôn thông báo vì sao. */}
          <CareerExportDrop
            data={careerExport}
            onLoad={onCareerExport}
            gate={exportGate}
            inUse={lineup?.source === "export"}
          />
          {lineup && players ? (
            <SquadHub
              lineup={lineup}
              players={players}
              jerseyOf={careerExport?.jerseyOf ?? club?.jerseyOf}
              wageOf={careerExport?.wageOf}
              clubName={club?.name ?? null}
            />
          ) : (
            <Notice title="Chưa dựng được sơ đồ đội hình">
            Không tìm thấy khối đội hình nào trong file này trông như một đội bóng
            thật — cần ít nhất 16 cầu thủ và hai thủ môn. Save chứa nhiều khối
            danh sách cầu thủ, trong đó có cả danh sách theo dõi chuyển nhượng, và
            vẽ một danh sách theo dõi thành sơ đồ đội hình thì sai hẳn nghĩa. Bảng
              cầu thủ ở tab bên cạnh vẫn đầy đủ.
            </Notice>
          )}
        </div>
      ) : null}
      {tab === "youth" ? (
        youth ? (
          <YouthList
            players={youth.players}
            stats={youth.stats}
            jerseyOf={careerExport?.jerseyOf ?? club?.jerseyOf}
          />
        ) : (
          <Notice title="Chưa đọc được danh sách cầu thủ trẻ">
            Cần cả bảng cầu thủ trong save lẫn cơ sở dữ liệu FC 26 nhúng — thiếu
            một trong hai thì không phân biệt được ai do career sinh ra.
          </Notice>
        )
      ) : null}
      {tab === "players" ? (
        players && players.length > 0 ? (
          <PlayerTable
            players={players}
            skipped={{ icons: iconCount, women: doc.career?.womenCount ?? 0 }}
          />
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
 * Ba bản xuất, mỗi bản một lý do tồn tại rõ ràng và không chồng lên nhau.
 *
 * Bản trước có hai nút, "tóm tắt" và "đầy đủ", và cả hai đều hỏng theo cùng một
 * cách: chúng chỉ nhận `doc`, trong khi tên cầu thủ được ghép vào state `players`
 * riêng ở component cha. Nên "đầy đủ" xuất ra 21.000 cầu thủ `name: null`, còn
 * "tóm tắt" thì không có danh sách cầu thủ nào cả — tức là thứ chính của trang
 * không xuất ra được bằng cách nào.
 *
 * Giờ `players` là tham số bắt buộc, và CSV đứng trước JSON vì phần lớn người
 * dùng trang này muốn mở bằng Excel chứ không muốn đọc JSON.
 */
function ExportButtons({
  doc,
  players,
}: {
  doc: SaveDocument;
  players: SavePlayer[] | null;
}) {
  function download(text: string, suffix: string, mime: string) {
    const base = doc.meta.fileName.replace(/[^\w.-]+/g, "_") || "save";
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${base}.${suffix}`;
    link.click();
    // Thu hồi ở nhịp sau: Safari đọc blob bất đồng bộ sau `click()`, thu hồi
    // ngay trong cùng nhịp thì file tải về rỗng.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const count = players?.length ?? 0;

  return (
    <div className="flex flex-wrap gap-2">
      {players && count > 0 ? (
        <>
          <button
            type="button"
            onClick={() =>
              download(playersToCsv(players), "cau-thu.csv", "text/csv;charset=utf-8")
            }
            className="tab"
            title="Mở được bằng Excel hoặc Google Sheets"
          >
            Cầu thủ (CSV, {formatCount(count)})
          </button>
          <button
            type="button"
            onClick={() =>
              download(
                JSON.stringify(playersToJson(doc, players), null, 2),
                "cau-thu.json",
                "application/json",
              )
            }
            className="tab"
          >
            Cầu thủ (JSON)
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={() =>
          download(
            JSON.stringify(diagnosticsToJson(doc), null, 2),
            "chan-doan.json",
            "application/json",
          )
        }
        className="tab"
        title="Mọi thứ trừ danh sách cầu thủ — để gửi kèm khi báo lỗi đọc file"
      >
        Chẩn đoán (JSON)
      </button>
    </div>
  );
}

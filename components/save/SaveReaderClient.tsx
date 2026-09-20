"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { loadFc26World, type ClubMatch } from "@/lib/fc26/world";
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
  /** Mọi playerId có trong roster xuất xưởng — để nhận ra ai do career sinh ra. */
  const [shippedIds, setShippedIds] = useState<Set<number> | null>(null);
  const [iconCount, setIconCount] = useState(0);
  const workerRef = useRef<Worker | null>(null);

  // Tải DB tên ngay khi trang mở, song song với việc người dùng chọn file: 1,5MB
  // tải xong trước cả khi thả xong file, nên bảng không phải chờ thêm nhịp nào.
  useEffect(() => {
    void loadFc26World();
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
    void Promise.all([loadFc26World(), loadFc26Names()]).then(([world, names]) => {
      if (!alive || !world) return;
      setShippedIds(world.shippedIds());
      /*
       * Bỏ nội dung Ultimate Team khỏi danh sách.
       *
       * Chúng là bản ghi thật, đọc ra đúng — nhưng bảng sắp theo chỉ số nên một
       * loạt người 44 tuổi chỉ số 91 nằm ngay đầu danh sách, che mất cầu thủ thật.
       * Bỏ hẳn, và BÁO SỐ LƯỢNG: danh sách hụt người mà không nói gì thì trông
       * như parser sót.
       */
      let icons = 0;
      setPlayers(
        career.players
          .filter((p) => {
            if (!world.isUltimateTeam(p.playerId)) return true;
            icons += 1;
            return false;
          })
          .map((p) => {
            // Quốc tịch tra được cho MỌI cầu thủ vì mã quốc gia đọc thẳng từ save.
            const nation = world.nation(p.nationalityId);
            const club = world.clubOf(p.playerId);
            const base = {
              ...p,
              nation,
              club: club?.name ?? null,
              league: club?.league ?? null,
            };
            if (p.nameSource === "newgen") return base;
            /*
             * Tên LUÔN tra từ kho, kể cả cầu thủ có sẵn.
             *
             * Trước đây bậc này chỉ chạy khi `players.json` không có bản ghi. Giờ
             * kho tên là bảng gốc của game nên nó đúng cho mọi người, và bậc kia
             * đã bỏ.
             */
            const fromPool = names?.resolve(p.firstNameId, p.lastNameId, p.commonNameId);
            return fromPool ? { ...base, name: fromPool, nameSource: "namePool" as const } : base;
          }),
      );
      setIconCount(icons);
    });
    return () => {
      alive = false;
    };
  }, [doc]);

  /**
   * Cầu thủ trẻ, suy từ danh sách ĐÃ GHÉP TÊN.
   *
   * Phải là `players` chứ không phải `doc.career.players`. Danh sách thô chỉ
   * mang tên đọc thẳng từ save; tên tra từ DB nhúng và từ kho tên được ghép ở
   * effect phía trên. Bản đầu dùng danh sách thô và hệ quả là tab này hiện
   * `#804279` cho một cầu thủ mà kho tên thừa sức tra ra "James Maddison".
   */
  const youth: YouthResult | null = useMemo(() => {
    if (!players || !shippedIds) return null;
    /*
     * Bảng học viện đọc thẳng từ save nếu tìm được — nó nói ai thuộc đội CỦA
     * BẠN. Không có thì rơi về cách suy luận, vốn gom học viện của mọi câu lạc
     * bộ trong save. `YouthList` nói rõ đang ở chế độ nào.
     */
    const academy = new Set(doc?.career?.academyIds ?? []);
    return findYouthPlayers(
      players,
      shippedIds,
      new Set(lineup?.squadIds ?? []),
      academy.size > 0 ? academy : undefined,
    );
  }, [players, shippedIds, lineup, doc]);

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
      loadFc26World(),
    ]).then(([table, schema, world]) => {
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
        const matched = world?.matchClub(squad) ?? null;
        setClub(matched);

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

        /*
         * Sơ đồ đọc thẳng từ save — thôi đoán khi nhận ra được.
         *
         * `matchByCoords` là lưới an toàn: bộ dò trong `lib/save` chỉ kiểm dải
         * giá trị, còn phép đối chiếu tập toạ độ mới phân biệt được sơ đồ thật.
         * Không khớp thì `null`, và trang rơi về phép đoán như trước.
         */
        const readShape = table.matchByCoords(doc.career?.formationCoords);
        setLineup(buildLineup(squad, byId, table.shapes, schema.positionName, readShape));
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

      /*
       * Gui kem tap id roster goc.
       *
       * Worker can no de dinh vi bang hoc vien: bang do chi nhan ra duoc khi
       * biet ai la cau thu do career sinh ra, ma dieu do song o `lib/fc26`.
       * `world.json` da duoc tai san tu luc mo trang nen cho o day gan nhu
       * khong ton thoi gian; hong thi gui undefined va tab Cau thu tre roi ve
       * cach suy luan cu.
       */
      void loadFc26World().then((world) => {
        worker.postMessage({
          kind: "parse",
          file,
          shippedIds: world ? [...world.shippedIds()] : undefined,
        });
      });
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
            source={youth.source}
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

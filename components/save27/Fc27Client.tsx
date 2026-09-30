"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Notice } from "@/components/Notice";
import { SaveDropZone } from "@/components/save/SaveDropZone";
import { TabBar, TabPanel, type TabItem } from "@/components/TabBar";
import { loadFc26Names, type Fc26Names } from "@/lib/fc26/names";
import { Fc27Names, type Fc27Ref } from "@/lib/fc27/names";
import type { Fc27WorkerRequest, Fc27WorkerResponse } from "@/lib/fc27/parse.worker";
import { isCurrentCareer, type Fc27Career } from "@/lib/fc27/read";
import { scoutPool, toLineup, toSavePlayers } from "@/lib/fc27/view";
import { clearSave, getSave, putSave } from "@/lib/save/store";

import { LoansTab } from "./LoansTab";
import { ResultBoundary } from "./ResultBoundary";
import { ScoutTab } from "./ScoutTab";
import { SquadTab } from "./SquadTab";
import { YouthTab } from "./YouthTab";

type Tab = "squad" | "youth" | "loans" | "scout";

const TABS: TabItem<Tab>[] = [
  { id: "squad", label: "Đội hình", labelJp: "布陣" },
  { id: "youth", label: "Cầu thủ trẻ", labelJp: "育成" },
  { id: "loans", label: "Cho mượn", labelJp: "貸出" },
  { id: "scout", label: "Scout cầu thủ", labelJp: "発掘" },
];

/** Khoá IndexedDB riêng: file FC27 không được đè file FC26 của trang bên cạnh. */
const STORE_KEY = "fc27";

let refPending: Promise<Fc27Ref | null> | null = null;
function loadRef(): Promise<Fc27Ref | null> {
  refPending ??= fetch("/fc27/ref.json")
    .then((r) => (r.ok ? (r.json() as Promise<Fc27Ref>) : null))
    .catch(() => null);
  return refPending;
}

export function Fc27Client() {
  const [career, setCareer] = useState<Fc27Career | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; notFc27: boolean } | null>(null);
  const [saved, setSaved] = useState<{ name: string; at: number } | null>(null);
  // `undefined` = đang tải, `null` = tải hỏng. Hỏng thì vẫn hiển thị, tên thành #id.
  const [ref, setRef] = useState<Fc27Ref | null | undefined>(undefined);
  const [fc26, setFc26] = useState<Fc26Names | null | undefined>(undefined);
  const workerRef = useRef<Worker | null>(null);
  /** Số lượt đọc đã bắt đầu; kết quả của lượt cũ (đã bị lượt mới hoặc "Xoá" thay thế) bị bỏ. */
  const runRef = useRef(0);

  useEffect(() => {
    void loadRef().then(setRef);
    void loadFc26Names().then(setFc26);
    return () => workerRef.current?.terminate();
  }, []);

  /** `keepOnError`: file người dùng vừa thả mà hỏng thì giữ nguyên kết quả đang hiển thị. */
  const parse = useCallback(async (file: File, keepOnError: boolean): Promise<boolean> => {
    const run = (runRef.current += 1);
    const current = (): boolean => runRef.current === run;
    setBusy(true);
    setError(null);
    const nationNames = Object.values((await loadRef())?.nations ?? {});
    if (!current()) return false;
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../../lib/fc27/parse.worker.ts", import.meta.url));
    workerRef.current = worker;
    return new Promise<boolean>((resolve) => {
      const fail = (message: string, notFc27: boolean): void => {
        worker.terminate();
        if (!current()) return resolve(false);
        setBusy(false);
        if (!keepOnError) {
          setCareer(null);
          setSaved(null);
        }
        setError({ message, notFc27 });
        resolve(false);
      };
      worker.onmessage = (event: MessageEvent<Fc27WorkerResponse>) => {
        const msg = event.data;
        if (msg.kind !== "done") return fail(msg.message, msg.notFc27);
        if (!isCurrentCareer(msg.career)) {
          return fail(
            "Bộ đọc file trong trình duyệt là bản cũ, không khớp với giao diện hiện tại (thường xảy ra ngay sau khi cập nhật code). Nhấn Ctrl+Shift+R để tải lại sạch rồi thả file lại.",
            false,
          );
        }
        worker.terminate();
        if (!current()) return resolve(false);
        setBusy(false);
        setCareer(msg.career);
        resolve(true);
      };
      worker.onerror = () =>
        fail(
          "Không chạy được bộ đọc file (Web Worker). Nếu máy chủ dev vừa khởi động lại hoặc vừa build, hãy tải lại trang bằng Ctrl+Shift+R rồi thử lại.",
          false,
        );
      const request: Fc27WorkerRequest = { kind: "parse", file, nationNames };
      worker.postMessage(request);
    });
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      void parse(file, true).then((ok) => {
        if (!ok) return;
        void putSave(file, STORE_KEY).then((stored) => {
          if (stored) setSaved({ name: file.name, at: Date.now() });
        });
      });
    },
    [parse],
  );

  // Khôi phục file của lần trước — bỏ qua nếu người dùng đã thả file khác trong lúc chờ IndexedDB.
  useEffect(() => {
    void getSave(STORE_KEY).then((got) => {
      if (!got || runRef.current !== 0) return;
      setSaved({ name: got.fileName, at: got.savedAt });
      void parse(new File([got.blob], got.fileName), false);
    });
  }, [parse]);

  const clear = useCallback(() => {
    runRef.current += 1;
    workerRef.current?.terminate();
    void clearSave(STORE_KEY);
    setBusy(false);
    setSaved(null);
    setCareer(null);
    setError(null);
  }, []);

  return (
    <div className="space-y-6">
      <SaveDropZone onFile={handleFile} busy={busy} progress={null} folder="settings của EA SPORTS FC 27" />

      {saved ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mist">
          <span>
            Đang giữ <strong className="text-ghost">{saved.name}</strong> · lưu lúc{" "}
            {new Date(saved.at).toLocaleString("vi-VN")}
          </span>
          <span className="text-mist-dim">— nằm trên máy bạn, không gửi đi đâu.</span>
          <button
            type="button"
            className="tab"
            onClick={clear}
          >
            Xoá
          </button>
        </p>
      ) : null}

      {busy ? <p className="text-xs text-mist-dim">Đang giải nén và đọc file…</p> : null}

      {error ? (
        <Notice tone="error" title="Không đọc được file">
          {error.message}
          {error.notFc27 ? (
            <>
              {" "}Nếu đây là save FC 26, hãy dùng{" "}
              <Link href="/save-reader" className="underline">
                Save Reader FC 26
              </Link>
              .
            </>
          ) : null}
        </Notice>
      ) : null}

      {career ? (
        <ResultBoundary resetKey={career}>
          <Fc27Result career={career} refData={ref} fc26={fc26} />
        </ResultBoundary>
      ) : null}
    </div>
  );
}

/**
 * Toàn bộ phần dựng dữ liệu hiển thị và vẽ kết quả nằm ở ĐÂY, bên trong
 * `ResultBoundary`. Biểu thức JSX của component cha được tính ở lần vẽ của cha,
 * nên một lỗi như `career.excluded.women` thiếu trường sẽ văng ra NGOÀI khung nếu
 * còn nằm ở cha — đã tái hiện đúng như vậy.
 */
function Fc27Result({
  career,
  refData,
  fc26,
}: {
  career: Fc27Career;
  refData: Fc27Ref | null | undefined;
  fc26: Fc26Names | null | undefined;
}) {
  const [tab, setTab] = useState<Tab>("squad");
  const names = useMemo(
    () => (refData !== undefined && fc26 !== undefined ? Fc27Names.fromRef(refData, fc26, career.players) : null),
    [career, refData, fc26],
  );
  const players = useMemo(
    () => (names ? toSavePlayers(career, names, refData?.nations ?? {}) : null),
    [career, names, refData],
  );
  const byId = useMemo(() => new Map((players ?? []).map((p) => [p.playerId, p])), [players]);
  const lineup = useMemo(() => toLineup(career), [career]);
  const scoutPlayers = useMemo(() => (players ? scoutPool(players, career) : []), [career, players]);
  const jerseyOf = useMemo(() => new Map(career.squad.map((l) => [l.playerId, l.jersey])), [career]);

  if (!players) return <p className="text-xs text-mist-dim">Đang nạp kho tên…</p>;

  return (
    <div className="space-y-6">
      {refData === null || fc26 === null ? (
        <Notice title="Không tải được kho tên">
          Dữ liệu đọc từ save vẫn đầy đủ, nhưng tên cầu thủ hiện dưới dạng #mã. Tải lại trang để thử lại.
        </Notice>
      ) : null}
      <TabBar tabs={TABS} active={tab} onChange={setTab} group="save-reader-fc27" ariaLabel="Các phần của save FC27" />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist-dim">
        {players.length.toLocaleString("vi-VN")} cầu thủ · giải nén {career.timings.unzipMs}ms · đọc{" "}
        {career.timings.readMs}ms
      </p>
      <p className="text-xs text-mist-dim">
        Chỉ gồm cầu thủ nam dùng được trong career — đã bỏ {career.excluded.women.toLocaleString("vi-VN")} cầu thủ nữ,{" "}
        {career.excluded.icons.toLocaleString("vi-VN")} icon/hero (nội dung Ultimate Team, không dùng được trong
        career) và {career.excluded.junk.toLocaleString("vi-VN")} bản ghi giữ chỗ.
      </p>
      <TabPanel tabKey={tab}>
        {tab === "squad" ? (
          <SquadTab career={career} lineup={lineup} players={players} byId={byId} jerseyOf={jerseyOf} />
        ) : tab === "youth" ? (
          <YouthTab career={career} byId={byId} />
        ) : tab === "loans" ? (
          <LoansTab career={career} byId={byId} />
        ) : (
          <ScoutTab players={scoutPlayers} career={career} />
        )}
      </TabPanel>
    </div>
  );
}

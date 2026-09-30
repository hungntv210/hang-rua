"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Notice } from "@/components/Notice";
import { SaveDropZone } from "@/components/save/SaveDropZone";
import { TabBar, TabPanel, type TabItem } from "@/components/TabBar";
import { loadFc26Names, type Fc26Names } from "@/lib/fc26/names";
import { Fc27Names, type Fc27Ref } from "@/lib/fc27/names";
import type { Fc27WorkerRequest, Fc27WorkerResponse } from "@/lib/fc27/parse.worker";
import type { Fc27Career } from "@/lib/fc27/read";
import { toLineup, toSavePlayers } from "@/lib/fc27/view";
import { clearSave, getSave, putSave } from "@/lib/save/store";

import { SquadTab } from "./SquadTab";

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
  const [tab, setTab] = useState<Tab>("squad");
  const [ref, setRef] = useState<Fc27Ref | null>(null);
  const [fc26, setFc26] = useState<Fc26Names | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    void loadRef().then(setRef);
    void loadFc26Names().then(setFc26);
    return () => workerRef.current?.terminate();
  }, []);

  const parse = useCallback(async (file: File): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const nationNames = Object.values((await loadRef())?.nations ?? {});
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../../lib/fc27/parse.worker.ts", import.meta.url));
    workerRef.current = worker;
    return new Promise<boolean>((resolve) => {
      worker.onmessage = (event: MessageEvent<Fc27WorkerResponse>) => {
        const msg = event.data;
        worker.terminate();
        setBusy(false);
        if (msg.kind === "done") {
          setCareer(msg.career);
          resolve(true);
        } else {
          setCareer(null);
          setError({ message: msg.message, notFc27: msg.notFc27 });
          resolve(false);
        }
      };
      worker.onerror = () => {
        worker.terminate();
        setBusy(false);
        setError({ message: "Worker đọc file gặp lỗi bất ngờ.", notFc27: false });
        resolve(false);
      };
      const request: Fc27WorkerRequest = { kind: "parse", file, nationNames };
      worker.postMessage(request);
    });
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      void parse(file).then((ok) => {
        if (!ok) return;
        void putSave(file, STORE_KEY).then((stored) => {
          if (stored) setSaved({ name: file.name, at: Date.now() });
        });
      });
    },
    [parse],
  );

  // Khôi phục file của lần trước.
  useEffect(() => {
    void getSave(STORE_KEY).then((got) => {
      if (!got) return;
      setSaved({ name: got.fileName, at: got.savedAt });
      void parse(new File([got.blob], got.fileName));
    });
  }, [parse]);

  const names = useMemo(
    () => (career && ref && fc26 ? Fc27Names.fromRef(ref, fc26, career.players) : null),
    [career, ref, fc26],
  );
  const players = useMemo(
    () => (career && names && ref ? toSavePlayers(career, names, ref.nations) : null),
    [career, names, ref],
  );
  const byId = useMemo(() => new Map((players ?? []).map((p) => [p.playerId, p])), [players]);
  const lineup = useMemo(() => (career ? toLineup(career) : null), [career]);
  const jerseyOf = useMemo(() => new Map((career?.squad ?? []).map((l) => [l.playerId, l.jersey])), [career]);

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
            onClick={() => {
              void clearSave(STORE_KEY);
              setSaved(null);
              setCareer(null);
            }}
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

      {career && players ? (
        <div className="space-y-6">
          <TabBar tabs={TABS} active={tab} onChange={setTab} group="save-reader-fc27" ariaLabel="Các phần của save FC27" />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist-dim">
            {players.length.toLocaleString("vi-VN")} cầu thủ · giải nén {career.timings.unzipMs}ms · đọc{" "}
            {career.timings.readMs}ms
          </p>
          <TabPanel tabKey={tab}>
            {tab === "squad" ? (
              <SquadTab career={career} lineup={lineup} players={players} byId={byId} jerseyOf={jerseyOf} />
            ) : (
              <Notice title="Đang hoàn thiện">Phần này sẽ có ở bước tiếp theo.</Notice>
            )}
          </TabPanel>
        </div>
      ) : career ? (
        <p className="text-xs text-mist-dim">Đang nạp kho tên…</p>
      ) : null}
    </div>
  );
}

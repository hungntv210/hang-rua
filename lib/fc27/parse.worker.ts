/**
 * Web Worker: đọc save FC27 ngoài main thread.
 *
 * Vỏ mỏng quanh `readFc27` — mọi logic ở `lib/fc27/*` để cùng đoạn code chạy
 * được trong Node (`scripts/check-fc27.ts`). `File` đi nguyên vào worker, blob
 * 17 MB giải nén không bao giờ chạm main thread; chỉ `Fc27Career` quay về.
 */

import { Fc27FormatError } from "./container";
import { readFc27, type Fc27Career } from "./read";

export type Fc27WorkerRequest = { kind: "parse"; file: File; nationNames: string[] };
export type Fc27WorkerResponse =
  | { kind: "done"; career: Fc27Career }
  | { kind: "error"; message: string; notFc27: boolean };

const ctx = self as unknown as {
  postMessage: (message: Fc27WorkerResponse) => void;
  onmessage: ((event: MessageEvent<Fc27WorkerRequest>) => void) | null;
};

ctx.onmessage = async (event: MessageEvent<Fc27WorkerRequest>) => {
  const request = event.data;
  if (request?.kind !== "parse") return;
  try {
    const raw = new Uint8Array(await request.file.arrayBuffer());
    const career = readFc27(raw, { nationNames: new Set(request.nationNames) });
    ctx.postMessage({ kind: "done", career });
  } catch (error) {
    ctx.postMessage({
      kind: "error",
      message: error instanceof Error ? error.message : "Không đọc được nội dung file trong worker.",
      notFc27: error instanceof Fc27FormatError,
    });
  }
};

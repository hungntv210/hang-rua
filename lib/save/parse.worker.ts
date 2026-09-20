/**
 * Web Worker: đọc file save ngoài main thread.
 *
 * Chỉ là lớp vỏ mỏng quanh `parseSaveBuffer` — mọi logic nằm trong `lib/save/*`
 * để cùng đoạn code đó chạy được cả trong Node (`scripts/probe-save.ts`).
 *
 * `File` được truyền nguyên vẹn vào worker rồi mới gọi `arrayBuffer()` Ở ĐÂY:
 * nhờ vậy vài chục MB không bao giờ đi qua main thread, và tab không đứng hình
 * trong lúc quét.
 */

import { parseSaveBuffer } from "./index";
import type { WorkerRequest, WorkerResponse } from "./types";

// `self` trong worker không phải Window; ép kiểu tối thiểu để dùng postMessage
// mà không phải bật lib "webworker" cho toàn dự án trong tsconfig.
const ctx = self as unknown as {
  postMessage: (message: WorkerResponse) => void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request?.kind !== "parse") return;

  try {
    const buffer = await request.file.arrayBuffer();
    const doc = parseSaveBuffer(buffer, {
      fileName: request.file.name,
      onProgress: (ratio) => ctx.postMessage({ kind: "progress", ratio }),
      // Tap id roster goc do main thread gui sang: can no de dinh vi bang hoc
      // vien. Gui dang mang roi dung Set o day, vi `structuredClone` cua Set
      // khong duoc moi trinh duyet ho tro deu.
      shippedIds: request.shippedIds ? new Set(request.shippedIds) : undefined,
    });
    ctx.postMessage({ kind: "done", doc });
  } catch (error) {
    ctx.postMessage({
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Không đọc được nội dung file trong worker.",
    });
  }
};

export {};

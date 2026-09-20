/**
 * Giữ lại file save gần nhất ngay trên máy người dùng.
 *
 * ─── LƯU BYTE THÔ, KHÔNG LƯU KẾT QUẢ ────────────────────────────────────────
 *
 * Lưu `SaveDocument` đã phân tích thì mở trang nhanh hơn, nhưng kết quả đó sẽ
 * đóng băng theo phiên bản parser lúc lưu. Dự án này đã dính đúng cái bẫy ảnh
 * chụp nướng sẵn hai lần: bảng team sheet trong `formations.json` phát lại
 * trạng thái cũ khi người dùng xếp lại đội hình, và seed nhiễm 55 cầu thủ học
 * viện từ một bản dump ngoài career. Một giây đọc lại là giá rẻ để không gặp
 * lại chuyện đó.
 *
 * ─── LƯU BLOB, KHÔNG LƯU ArrayBuffer ────────────────────────────────────────
 *
 * `SaveReaderClient` có một bất biến ghi rõ ngay đầu file: main thread KHÔNG
 * bao giờ giữ ArrayBuffer vài chục MB — đó là lý do việc đọc nằm trong worker.
 * Một kho lưu nhận `ArrayBuffer` sẽ buộc người gọi phá bất biến đó ngay ở lời
 * gọi (`file.arrayBuffer()`), và với trần 128MB của trang thì hai bản sao cùng
 * sống một lúc là đủ giết tab.
 *
 * Blob thì không: nó là một THAM CHIẾU tới byte, IndexedDB lưu được thẳng, và
 * `new File([blob], tên)` cũng không sao chép. Không lúc nào có mảng byte nào
 * nằm trong đống của main thread.
 *
 * ─── HỎNG THÌ BỎ QUA, NHƯNG PHẢI NÓI RA LÀ ĐÃ HỎNG ──────────────────────────
 *
 * Chế độ ẩn danh, hết dung lượng, trình duyệt chặn — mọi lối đều có thật và
 * không lối nào đáng làm trang chết. Nhưng `putSave` phải TRẢ VỀ việc nó có
 * lưu được hay không: một hàm nuốt mọi lỗi rồi trả `void` buộc người gọi phải
 * đoán, và giao diện sẽ nói "đang giữ file của bạn" trong khi chẳng giữ gì.
 *
 * Tầng này không biết gì về career hay cầu thủ. Nó chỉ giữ byte.
 */

const DB_NAME = "hang-rua-save";
const DB_VERSION = 1;
const STORE = "file";
/** Chỉ giữ một file: file mới ghi đè file cũ. */
const KEY = "latest";

export interface SavedFile {
  /** Tham chiếu tới byte, không phải bản sao. Xem chú thích đầu file. */
  blob: Blob;
  fileName: string;
  savedAt: number;
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      /*
       * Tab khác đang giữ phiên bản cũ của DB. Không chờ vô hạn — nhưng cũng
       * phải đóng kết nối nếu nó mở được SAU khi ta đã bỏ cuộc, nếu không nó
       * treo lơ lửng và chính nó lại chặn lần nâng phiên bản tiếp theo.
       */
      req.onblocked = () => {
        req.onsuccess = () => req.result.close();
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Chạy một giao dịch và LUÔN đóng kết nối, dù đi ra bằng lối nào.
 *
 * Bản trước chỉ đóng trong `tx.oncomplete`, nên mọi lối lỗi đều rò một kết
 * nối — kể cả `tx.onabort`, đúng cái lối mà quá dung lượng đi vào. Kết nối rò
 * còn chặn lần nâng `DB_VERSION` sau này, biến một rò rỉ âm thầm thành lỗi
 * "không lưu được nữa" mà không ai lần ra nguyên nhân.
 */
function run<T>(
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<{ ok: boolean; value: T | null }> {
  return open().then(
    (db) =>
      new Promise<{ ok: boolean; value: T | null }>((resolve) => {
        if (!db) {
          resolve({ ok: false, value: null });
          return;
        }
        let done = false;
        const finish = (ok: boolean, value: T | null) => {
          if (done) return;
          done = true;
          try {
            db.close();
          } catch {
            // Đóng hỏng thì cũng không còn gì làm được.
          }
          resolve({ ok, value });
        };
        try {
          const tx = db.transaction(STORE, mode);
          const req = body(tx.objectStore(STORE));
          // Chờ `oncomplete` chứ không chờ `req.onsuccess`: với ghi thì chỉ khi
          // giao dịch hoàn tất mới chắc byte đã nằm trên đĩa.
          tx.oncomplete = () => finish(true, req.result ?? null);
          tx.onabort = () => finish(false, null);
          tx.onerror = () => finish(false, null);
          req.onerror = () => finish(false, null);
        } catch {
          finish(false, null);
        }
      }),
  );
}

/** Trả `false` khi không lưu được — người gọi PHẢI xử lý, xem chú thích đầu file. */
export async function putSave(file: File): Promise<boolean> {
  const value: SavedFile = { blob: file, fileName: file.name, savedAt: Date.now() };
  const { ok } = await run("readwrite", (s) => s.put(value, KEY));
  return ok;
}

export async function getSave(): Promise<SavedFile | null> {
  const { value } = await run<SavedFile>("readonly", (s) => s.get(KEY));
  /*
   * Bản ghi của phiên bản cũ lưu `bytes: ArrayBuffer` và không có `blob`. Coi
   * như không có: người dùng tải lại file một lần, rẻ hơn nhiều so với việc
   * mang theo một nhánh đọc định dạng cũ mãi mãi.
   */
  if (!value || !(value.blob instanceof Blob) || value.blob.size === 0) return null;
  if (typeof value.fileName !== "string" || value.fileName === "") return null;
  return value;
}

export async function clearSave(): Promise<void> {
  await run("readwrite", (s) => s.delete(KEY));
}

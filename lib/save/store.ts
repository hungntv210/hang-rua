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
 * ─── HỎNG THÌ BỎ QUA, KHÔNG BAO GIỜ NÉM ─────────────────────────────────────
 *
 * Chế độ ẩn danh, hết dung lượng, trình duyệt chặn — mọi lối đều có thật và
 * không lối nào đáng làm trang chết. Lưu hỏng thì lần sau không nhớ; đọc hỏng
 * thì hiện ô thả file. Người dùng mất tiện ích, không mất chức năng.
 *
 * Tầng này không biết gì về career hay cầu thủ. Nó chỉ giữ byte.
 */

const DB_NAME = "hang-rua-save";
const DB_VERSION = 1;
const STORE = "file";
/** Chỉ giữ một file: file mới ghi đè file cũ. */
const KEY = "latest";

export interface SavedFile {
  bytes: ArrayBuffer;
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
      // Tab khác đang giữ phiên bản cũ của DB. Không chờ vô hạn.
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(STORE, mode);
          const req = body(tx.objectStore(STORE));
          req.onsuccess = () => resolve(req.result ?? null);
          // Quá dung lượng rơi vào đây, không vào `req.onerror`.
          tx.onabort = () => resolve(null);
          req.onerror = () => resolve(null);
          tx.oncomplete = () => db.close();
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function putSave(bytes: ArrayBuffer, fileName: string): Promise<void> {
  const value: SavedFile = { bytes, fileName, savedAt: Date.now() };
  await run("readwrite", (s) => s.put(value, KEY));
}

export async function getSave(): Promise<SavedFile | null> {
  const got = await run<SavedFile>("readonly", (s) => s.get(KEY));
  // Bản ghi của phiên bản cũ có thể thiếu trường. Thà coi như không có.
  if (!got || !(got.bytes instanceof ArrayBuffer) || got.bytes.byteLength === 0) return null;
  return got;
}

export async function clearSave(): Promise<void> {
  await run("readwrite", (s) => s.delete(KEY));
}

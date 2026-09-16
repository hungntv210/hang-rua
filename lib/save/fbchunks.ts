/**
 * Phần đầu container.
 *
 * Chỉ đọc những gì đã xác nhận được bằng hex dump: magic `FBCHUNKS` và vị trí
 * chuỗi `cmBNRY`. Bố cục version/metadata sau magic CHƯA giải mã được, nên vài
 * uint32 kế tiếp được xuất ra nguyên trạng cho người dùng tự đối chiếu, thay vì
 * đặt tên bừa cho chúng.
 *
 * Không có gì ở đây được phép chặn việc quét: file thiếu magic vẫn quét bình
 * thường, chỉ kèm cảnh báo.
 */

import { ByteReader } from "./reader";
import type { RawContainer } from "./types";

export const FBCHUNKS_MAGIC = "FBCHUNKS";
export const CM_BNRY_TAG = "cmBNRY";

/** Số uint32 đọc sau magic để trưng ra — thuần chẩn đoán. */
const HEADER_WORD_COUNT = 6;

/**
 * Phạm vi tìm `cmBNRY`. Khảo sát cho thấy tag nằm "gần đầu file"; 1MB đã rất
 * rộng rãi mà vẫn rẻ. Không tìm thấy trong khoảng này thì tìm nốt cả file —
 * chậm hơn nhưng chỉ chạy một lần.
 */
const CM_BNRY_FAST_WINDOW = 1024 * 1024;

export function readContainer(reader: ByteReader): RawContainer {
  const magic = reader.ascii(0, FBCHUNKS_MAGIC.length) ?? "";
  const hasFbchunksMagic = magic === FBCHUNKS_MAGIC;

  const headerWords: number[] = [];
  for (let i = 0; i < HEADER_WORD_COUNT; i += 1) {
    const word = reader.u32(FBCHUNKS_MAGIC.length + i * 4);
    if (word === null) break;
    headerWords.push(word);
  }

  let cmBnryOffset = reader.indexOfAscii(CM_BNRY_TAG, 0, CM_BNRY_FAST_WINDOW);
  if (cmBnryOffset < 0) {
    cmBnryOffset = reader.indexOfAscii(CM_BNRY_TAG, CM_BNRY_FAST_WINDOW);
  }

  return {
    magic,
    hasFbchunksMagic,
    headerWords,
    cmBnryOffset: cmBnryOffset >= 0 ? cmBnryOffset : null,
  };
}

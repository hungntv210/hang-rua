# Save Reader — đọc file save Career Mode EA FC 26

Ngày: 2026-08-04. Trạng thái: đã chốt thiết kế, đang dựng.

## Mục tiêu

Thêm module `save-reader` vào Hang Rùa: người dùng thả file save Career Mode
(`CmMgrC...`, 15–50MB) vào trang, trang bóc toàn bộ cấu trúc tự mô tả trong file
thành bảng field tìm kiếm được.

Đây là **explorer thuần**, không phải bản sao cmtracker. Ưu tiên: parser tổng
quát, không crash, xuất đủ dữ liệu để sau này diễn giải nghiệp vụ. Không cố dựng
bảng "cầu thủ" / "chuyển nhượng" ở phiên bản này — quan hệ giữa các record chưa
được xác nhận, dựng sớm sẽ phải viết lại.

## Định dạng — đã xác minh trên file thật

Dò bằng `scripts/hex-probe.ts` trên `CmMgrC20260730232114046` (14,6MB). Ba điểm
trong khảo sát ban đầu **sai**, đã sửa lại theo byte thật:

| Khảo sát ban đầu | Thực tế |
| --- | --- |
| Không rõ byte đánh dấu | Tag **2 byte `01 01`** trước độ dài tên |
| Tên có NUL kết thúc (độ dài 20) | Tên **không** có NUL — `"Sold Player Overall"` dài đúng 19 (0x13); khảo sát đếm dư một |
| Vùng entropy cao, nghi đã nén | Entropy cao nhất trong cả file là **4,5 bit/byte** — không có vùng nào bị nén |

Cấu trúc đúng:

```
Field có tên:      01 01 [uint32 len] [tên ASCII] [giá trị 4 byte]
Chuỗi đứng một mình: 01 [uint32 len] [chuỗi ASCII]
Đầu bản ghi:       01 [uint32 số field]
```

Ví dụ nguyên văn từ file (offset 9046439):

```
01 01 | 0E 00 00 00 | "Purchase Value"      | 40 78 7D 01   → 25.000.000
01 01 | 13 00 00 00 | "Sold Player Overall" | 48 00 00 00   → 72
```

Bản ghi chuyển nhượng mở đầu bằng `01 09 00 00 00` và theo sau đúng **9** field
— con số trong header khớp số field, đây là căn cứ cho việc gom bản ghi sau này.

Những gì còn lại:

- Magic `FBCHUNKS` ở byte 0, tag `cmBNRY` ở offset 1432. ✓
- Giá trị luôn 4 byte. `InjuryName` = 46 là **ID chấn thương**, không phải chuỗi.
- Tên đội là chuỗi **NUL-pad trong bảng cố định** ("Fluminense" + toàn byte 00),
  nằm ngoài cấu trúc token nên chỉ dò được bằng cách vét ASCII.
- 8,2MB đầu file không chứa token nào — đó là bảng nhị phân cầu thủ/đội.

Kết quả trên file thật: **855 field, 369 tên khác nhau, độ phủ 0,2%**. Độ phủ
thấp là bản chất định dạng, không phải lỗi parser: lớp field có tên chỉ chứa
phần sự kiện Career Mode. UI phải nói rõ điều này, nếu không người dùng sẽ tưởng
trang hỏng.

## Quyết định kiến trúc

### Parse ở client, trong Web Worker

Route handler của Next 14 khi deploy lên Vercel giới hạn body ~4.5MB; file
15–50MB hỏng ở tầng hạ tầng trước khi chạm parser. Save Career Mode là dữ liệu
cá nhân, không có lý do gửi lên server. Worker giữ main thread rảnh nên UI không
đứng hình khi quét vài chục MB.

Đánh đổi đã chấp nhận: không dùng được `zlib` native của Node cho các vùng nén.
Chấp nhận được vì thuật toán nén còn chưa xác định. Nếu sau này cần giải nén
native, thêm route handler cho **một vùng byte**, không phải cả file.

### `lib/save/*` không chạm DOM

Toàn bộ engine là TypeScript thuần, nhận `ArrayBuffer`. Nhờ vậy chạy được bằng
Node trên file save thật để kiểm chứng — dự án chưa có test framework nên đây là
cách verify duy nhất có thật.

### Hai tầng kiểu, đúng convention hiện có

`lib/save/types.ts` giữ hai tầng như `lib/types.ts` đang làm với `Fd*`:

1. `Raw*` — bám sát byte: `RawField`, `RawUnknownRun`, `RawScanResult`.
2. `Save*` — chuẩn hoá cho UI: `SaveDocument`, `SaveField`, `SaveFieldStat`,
   `SaveUnknownRegion`, `SaveLooseString`.

`lib/save/adapter.ts` chuyển tầng 1 sang tầng 2, đúng vai trò
`lib/football-data.ts` đang đảm nhiệm.

## Thuật toán quét & tái đồng bộ

Parser **không** đọc tuần tự theo ngữ pháp toàn cục — ngữ pháp đó chưa biết. Ở
mỗi offset nó thử khớp hai mẫu, **theo đúng thứ tự này**:

1. Field có tên: `01 01 [uint32 len ∈ [2,64]] [tên ASCII in được, có chữ cái]`
2. Chuỗi đứng một mình: `01 [uint32 len] [chuỗi ASCII]`

Thứ tự bắt buộc vì mẫu 1 = một byte `01` rồi đến mẫu 2; thử ngược lại thì mọi
field sẽ bị đọc thành chuỗi trơ và mất giá trị.

Khớp → phát ra field, `pos` nhảy tới sau giá trị. Không khớp → `pos += 1`, byte
đó gom vào unknown run đang mở.

Hệ quả: parser không thể mất đồng bộ vĩnh viễn, và một vùng nén chỉ khiến nó
trượt từng byte rồi bắt lại field kế tiếp. Không có đường nào dẫn tới ngoại lệ
làm hỏng cả lượt parse.

Mỗi field ghi kèm 4 byte đứng **ngay trước** tag (`markerHex`) — thường là giá
trị của field liền trước hoặc phần đầu bản ghi. Giữ lại để soi ranh giới bản ghi
khi giải mã tiếp.

## Suy đoán kiểu giá trị

Giá trị trong file luôn 4 byte và file **không** khai báo kiểu, nên kiểu là suy
đoán. Theo thứ tự tại vị trí giá trị:

1. Token chuỗi (`01` + độ dài + ASCII) → `string`. Chưa gặp trong file thật,
   giữ nhánh này phòng khi có.
2. `|int32| < 2^24` → `int32`.
3. Ngược lại, `float32` trong dải `[1e-3, 1e7]` → `float32`.
4. Còn lại → `int32`.

Vế 2–3 là điểm dễ sai nhất, nên ghi rõ lý do: một float32 "người đọc được" (7.4)
LUÔN có bit pattern đọc thành int rất lớn (1.088.841.421), nên int nhỏ không thể
là float đội lốt. Ngược lại 25.000.000 đọc theo float ra 4,6e-38 — vô nghĩa, nên
giữ nguyên int. Ngưỡng `2^24` ban đầu đặt sai (cắt mất giá trị chuyển nhượng
trên 16,7 triệu) và đã được sửa sau khi fixture bắt lỗi.

Mỗi field lưu 8 byte `rawHex`. UI đổi cách diễn giải (int / uint / float) từ
rawHex mà không phải parse lại file. Không lưu sẵn mọi cách diễn giải vì với vài
trăm nghìn field thì chi phí bộ nhớ không đáng.

## Vùng chưa giải mã

Mỗi unknown run xuất ra: offset, độ dài, entropy Shannon trên mẫu, 32 byte hex
đầu, và magic nén dò được (`28 B5 2F FD` zstd, `78 01/5E/9C/DA` zlib,
`04 22 4D 18` LZ4 frame, `1F 8B` gzip). Trong run vẫn vét chuỗi ASCII rời ≥ 4 ký
tự — đây là chỗ tên đội lộ ra.

Trên file thật không có magic nén nào khớp và entropy cao nhất là 4,5 bit/byte,
tức các vùng này là **bảng nhị phân không nén**, không phải dữ liệu đã nén. Việc
dò magic vẫn giữ lại vì save khác có thể khác.

Khe hở nhỏ hơn 8 byte không vào danh sách (vẫn tính vào tổng byte): mỗi field để
lại một khe vài byte, ghi hết thì danh sách toàn rác và trần bị chạm ngay đầu
file, làm mất đúng những blob lớn cần tìm. Khi danh sách đầy, parser tỉa nửa nhỏ
và tự nâng ngưỡng, nên vùng lớn nhất luôn còn lại bất kể nằm ở đâu trong file.

## Giới hạn tài nguyên

- `file.arrayBuffer()` gọi **bên trong worker**; buffer không bao giờ vào React
  state.
- Trần 300.000 field, 20.000 unknown run, 50.000 chuỗi rời; vượt thì dừng quét
  và bật cờ `truncated` (hiển thị rõ trên UI, không im lặng cắt).
- Trần file 128MB, cảnh báo từ 64MB.
- Progress đẩy về qua `postMessage` mỗi ~1MB; kết quả cuối chuyển một lần.
- Bảng dùng windowing tự viết (~60 dòng quanh vùng cuộn). Dự án đang
  zero-dependency, không thêm thư viện bảng ảo hoá.
- Nếu `new Worker` thất bại (bundler / trình duyệt cũ), fallback parse trên main
  thread — cùng một hàm `scanSave`, chỉ mất progress mượt.

## Cấu trúc file

```
lib/save/
  types.ts      Raw* và Save*
  reader.ts     ByteReader bounds-checked, read quá biên trả null
  fbchunks.ts   header FBCHUNKS + định vị cmBNRY
  tlv.ts        máy quét scan & resync
  infer.ts      suy đoán kiểu
  adapter.ts    Raw* -> Save*
  index.ts      parseSaveBuffer() — cửa vào duy nhất
app/save-reader/
  page.tsx           vỏ server component
  parse.worker.ts    worker entry
components/save/
  SaveReaderClient.tsx   điều phối drop -> worker -> state
  SaveDropZone.tsx
  SaveStats.tsx
  SaveFieldTable.tsx     bảng ảo hoá + tìm kiếm + lọc theo kiểu
  SaveUnknownList.tsx
```

`lib/modules.ts` thêm mục `save-reader` (`status: "live"`);
`components/ModuleIcon.tsx` thêm biến thể icon `"save"`.

## Xử lý lỗi

`parseSaveBuffer` không bao giờ throw. Kết quả luôn có `issues: SaveIssue[]`
(ví dụ "không thấy magic FBCHUNKS", "không thấy cmBNRY", "đã chạm trần field").
File không phải save FC vẫn parse được — chỉ ra ít field và nhiều unknown, kèm
cảnh báo magic không khớp. Worker bọc `try/catch`, lỗi hiển thị bằng `Notice`
tone `error`.

## Kiểm chứng — đã chạy

1. `npx tsx scripts/probe-save.ts` — tự kiểm trên fixture dựng theo đúng cấu
   trúc thật. 10/10 mục đạt, gồm cả field nằm SAU khối nhiễu 4KB (phép thử tái
   đồng bộ). Chính fixture này đã bắt được lỗi ngưỡng `2^24`.
2. `npx tsx scripts/probe-save.ts temp_fc26_upload/CmMgrC…` — 855 field, 369
   tên, 332ms. Đối chiếu tay với hex: `Buying Team ID` = 247 khớp `F7 00 00 00`,
   `Purchase Value` = 25.000.000 khớp `40 78 7D 01`.
3. `npm run typecheck` — sạch.
4. `npm run build` — xanh, `/save-reader` prerender tĩnh 6,77 kB.
5. Chạy thật trên trình duyệt: thả file qua cả input lẫn kéo-thả, worker parse,
   bảng và bảng diễn giải lại byte hiển thị đúng giá trị.

## Cần biết khi sửa tiếp

- `scripts/hex-probe.ts` là kính lúp để dò tiếp: `str "PlayerID"` xem ngữ cảnh
  quanh một chuỗi, `at <offset>` xem một vùng.
- Mọi hằng số phỏng đoán nằm trong `lib/save/heuristics.ts`. Phần lớn việc tinh
  chỉnh về sau là sửa file đó, không phải viết lại logic.
- Bước tiếp theo có giá trị nhất: dùng `01 [uint32 số field]` ở đầu bản ghi để
  gom field thành bản ghi, khi đó mới dựng được bảng chuyển nhượng đúng nghĩa.

## Ngoài phạm vi

Giải nén vùng entropy cao; bảng cầu thủ / chuyển nhượng theo nghiệp vụ; lưu kết
quả lên server; chỉnh sửa và ghi ngược file save.

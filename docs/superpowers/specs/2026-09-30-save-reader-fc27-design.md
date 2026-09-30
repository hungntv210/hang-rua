# Save Reader FC27 — thiết kế

Ngày: 2026-09-30 · Trạng thái: chờ duyệt spec

## 1. Mục tiêu

Một trang **riêng** `/save-reader/fc27` đọc save Career Mode EA Sports FC 27
ngay trong trình duyệt (không gửi byte nào lên server), tương đương trang FC26
nhưng đọc file theo cách tối ưu hơn: đọc thẳng cơ sở dữ liệu FIFA DB tự mô tả
trong save thay vì dò bit và suy luận.

Phạm vi v1 — bốn tab:

1. **Đội hình**: sơ đồ + 11 người ra sân **thật** (người chơi đã xếp) + cả đội.
2. **Cầu thủ trẻ**: học viện **của riêng CLB người chơi** — danh sách thật.
3. **Scout**: tìm/lọc toàn bộ cầu thủ thế giới.
4. **Cho mượn** (mới): cầu thủ của CLB đang cho mượn, đang ở đâu, hết hạn khi nào.

Tiêu chí thành công: tải save mẫu `CmMgrC20260926153118445` lên thì thấy
Man Utd, 4-2-3-1, 11 người ra sân đúng thứ tự, 39 cầu thủ, học viện
460003–460012, cho mượn Onana (→ Trabzonspor) và Koné (→ Lausanne-Sport).

Ngoài phạm vi: sửa đường FC26 (để nguyên), dump Lua FC27 (làm sau), bộ lọc
"chỉ cầu thủ do career sinh" (chưa phân biệt được khi chưa có roster gốc FC27).

## 2. Kiến thức định dạng (đã kiểm chứng 2026-09-27)

- File: vỏ `FBCHUNKS`; một khung **zstd** (magic `28 B5 2F FD`), 16 byte ngay
  trước là `[u32 cỡ giải nén][0][u32 cỡ nén][0]`. Mẫu: offset 2790, giải nén
  17.632.769 byte. FC26 không nén.
- Blob chứa 2 FIFA DB (`DB\0\x08`). Header DB: `+8 u32 size`, `+16 u32 nTables`,
  rồi `nTables × [4 ký tự tên][u32 offset]`, 4 byte CRC; offset bảng tính từ
  cuối danh sách. Header bảng: `+4 u32 recordSize`, `+16 u16 nRecords`,
  `+18 u16 nValid`, `+24 u8 nFields`, bộ mô tả bắt đầu ở `+36`, mỗi mục 16 byte
  `[u32 type][u32 bit][4 ký tự tên][u32 width]`; dữ liệu nằm ngay sau bộ mô tả.
  Kiểu: 0 chuỗi (width bit, NUL-pad), 3 số nguyên LSB-first, 4 float32.
- Mã 4 ký tự **ổn định giữa FC26 và FC27**, nên ánh xạ học trên cặp
  save + Live Editor FC26 (khớp 100%) dùng được cho FC27.
- Khối career ngoài FIFA DB: mục lục `[4 ký tự tag][u32 giá trị]` trong vỏ
  ngoài (mẫu: từ 0x4AA); offset thật trong blob = giá trị − Δ, với Δ suy ra
  động: Δ = giá trị của tag `gsbd` − (vị trí DB đầu tiên − 4). Mẫu: Δ = 1600.

Bảng và mã trường dùng tới (`schema.ts`):

| Bảng (mã) | Trường (mã → nghĩa, hằng số) |
|---|---|
| players `CZUM` | `ykFq` playerid (raw−1), `mpuH` potential (+1), `UERs` overall (+1), `wZQU` vị trí, `WVIU` ngày sinh (ngày DB), `enmm` quốc tịch, `tHlO`/`QCfa`/`HDYx` first/last/common nameid, `vTpl` ngày gia nhập CLB |
| teamplayerlinks `RrqT` | `ykFq` playerid (raw−1), `mCXg` teamid (raw−1), `JFiY` số áo (+1) |
| teams `lyxL` | `mCXg` teamid (raw−1), `AUsv` tên |
| formations `mDGw` | `LGsF` tên sơ đồ, toạ độ `offset0x..offset10y` (float) |
| cm_teamsheets `zdMM` | `mCXg` teamid (raw−1), `playerid0..10` = `MVLC zWHI SfCW Ncmk Povf wjrR RaOP OhyJ WCfU FJbC qhEx` (raw−1, 0 = trống), `FVzk` đội trưởng |
| team sheet sơ đồ `emmj` | `position0..10` = `ZzVx CEZz nNch cGsr aCho BBlW ksMI fvcy TMpL sPtx FuLD` (raw−1), toạ độ cùng mã với `formations` |
| career_youthplayers `IOmq` | `ykFq` playerid (**raw, không trừ**) |
| leagueteamlinks `qdZF`, leagues `onMQ` | dùng để phân biệt CLB với đội tuyển; mã trường ánh xạ trong bước triển khai bằng CSV nền FC26 |
| nations (`FMpz`, cần xác nhận) | tên quốc gia; nếu không xác nhận được thì dùng `nations.csv` FC26 theo nationid |

Khối cho mượn `msnl`: sau tag có 16 byte header, `u32` cuối là số mục; mỗi mục
20 byte `01 | u32 playerid | u32 teamid chủ quản | 01 | u32 YYYYMMDD | 00×5 | FF`
(11/733 mục mẫu có đuôi khác `FF…` — chưa rõ nghĩa, vẫn đọc ba trường chính).
ID trong `msnl` là ID thật (không lệch).

Hằng số cộng khác nhau theo bảng và theo phiên bản (FC26: teamid = raw+1,
playerid = raw) — không bao giờ chuyển hằng số sang phiên bản khác mà không đo lại.

## 3. Kiến trúc

```
lib/fc27/
  container.ts      FBCHUNKS → khung zstd → blob (fzstd)
  fifadb.ts         FIFA DB tổng quát; đọc cột theo mã, đọc lười. Không biết gì về FC27
  sections.ts       mục lục khối career → giải mã msnl
  schema.ts         DỮ LIỆU: mã bảng/trường, hằng số cộng FC27
  names.ts          tên cầu thủ (xem §5)
  read.ts           ghép → Fc27Career
  parse.worker.ts   chạy read.ts trong Web Worker
app/save-reader/fc27/page.tsx
components/save27/  Fc27Client, SquadTab, YouthTab, LoansTab, ScoutTab
                    (dùng lại components/save/Pitch.tsx qua Lineup source "export")
scripts/check-fc27.ts
```

- `lib/fc27` chỉ import từ `lib/fc26` những thứ trung lập: `positions.ts`,
  kiểu `SavePlayer`/`Lineup`. Không import logic suy luận của FC26.
- Dependency mới: `fzstd` (MIT, 0 dependency, không có script khi cài), khoá
  phiên bản chính xác. Node dùng được cả `zlib.zstdDecompressSync` cho script
  kiểm, nhưng mã trong `lib/fc27` chỉ dùng `fzstd` để một đường chạy cho cả hai.
- Lưu file vào IndexedDB để tải lại trang vẫn còn — dùng lại `lib/save/store.ts`
  nếu tham số hoá được khoá lưu; nếu không, một store tối giản riêng.
- Trang FC26 thêm một liên kết sang `/save-reader/fc27`.

## 4. Luồng dữ liệu từng mục

**CLB người chơi**: `teamid` của dòng hợp lệ trong `cm_teamsheets`. Nhiều dòng
thì chọn dòng có đội thuộc giải không phải quốc tế. Không chọn được thì báo lỗi,
không đoán.

| Mục | Nguồn |
|---|---|
| Đội hình ra sân | `playerid0..10` (`cm_teamsheets`) + `positionN` và toạ độ (`emmj`); đội trưởng `FVzk` |
| Sơ đồ | tập 22 toạ độ (làm tròn 3 chữ số, sắp xếp) khớp dòng `formations` trong save → `formationname` |
| Cả đội | `teamplayerlinks` teamid = CLB → số áo; `players` → vị trí, OVR, POT, ngày sinh |
| Học viện | `career_youthplayers` → `players` |
| Cho mượn | `msnl` lọc teamid chủ quản = CLB; CLB đang mượn từ `teamplayerlinks` (bỏ link đội tuyển); ngày hết hạn |
| Scout | toàn bộ `players` trừ đội người chơi; CLB **hiện tại** từ `teamplayerlinks`; quốc tịch; lọc tuổi/tuyến/OVR/POT/mức tăng |

**Tiềm năng (POT) — DYNAMIC POTENTIAL.** FC27 tính POT theo phong độ; giá trị
trong save là tiềm năng tại thời điểm lưu và thay đổi theo phong độ. Quy tắc:

- Hiển thị **đúng giá trị trong save**, không hiệu chỉnh theo tuổi hay theo bất
  kỳ suy luận nào.
- Nhãn trên giao diện: "POT tại thời điểm lưu — dynamic potential, thay đổi theo
  phong độ".
- Bộ lọc và "mức tăng" (POT − OVR) dùng giá trị gốc.
- Chỉ kiểm bất biến cấu trúc POT ≥ OVR (đo được 100% trên mẫu).

Ghi chú lịch sử: phân tích 2026-09-27 thấy 27,8% cầu thủ ≥ 33 tuổi có POT vượt
OVR > 5 (FC26: 0–0,9%) và đã phỏng đoán là "đỉnh lịch sử" — phỏng đoán đó sai;
nguyên nhân là dynamic potential.

**Tuổi**: save FC27 không còn lưu ngày hiện tại trong game. Mốc = ngày gia nhập
CLB muộn nhất (`vTpl`) trên toàn bảng `players` (ngày hiện tại ≥ mốc). Hiển thị
"tuổi ước tính, sai ±1".

## 5. Tên cầu thủ

Save chỉ lưu nameid trỏ vào kho tên của bản cài game; kho tên FC27 đã đánh số
lại so với FC26. v1:

1. Tra theo **playerId** sang dữ liệu FC26 (`public/fc26/*`), chỉ nhận khi ngày
   sinh trùng khít → tin cậy cao.
2. Còn lại: cầu nối nameid FC27 → tên, dựng lúc chạy từ các cầu thủ có ở cả hai
   phiên bản (bước 1) → hiển thị kèm "≈".
3. Không ra tên → `#playerId`.

`names.ts` nhận thêm một nguồn tên FC27 tuỳ chọn; khi có dump Lua FC27 thì build
asset `public/fc27/names.json` và nguồn này thắng mọi nguồn khác.

## 6. Xử lý lỗi

Từng phần hỏng độc lập; không bao giờ hiển thị số đoán như số đọc được.

| Tình huống | Xử lý |
|---|---|
| Không có zstd hoặc FIFA DB | dừng, "không phải save Career FC27", link sang trang FC26 |
| Thiếu bảng/mã trường | tab phụ thuộc báo lỗi kèm tên bảng/mã thiếu; tab khác vẫn chạy |
| Mục lục / `msnl` sai định dạng | tab Cho mượn báo không đọc được; dừng ở bản ghi lỗi đầu tiên |
| Không xác định CLB | Đội hình, Học viện, Cho mượn báo rõ; Scout vẫn chạy |
| Ngoại lệ trong `read.ts` | Worker gói thành lỗi có thông điệp, không trang trắng |

Cổng kiểm lúc đọc (cảnh báo trên tab khi vi phạm): 11 người ra sân nằm trong
đội và không lặp; mọi ID học viện có trong `players`; mọi CLB chủ quản trong
`msnl` tra được tên và khác CLB đang mượn; tập toạ độ khớp đúng một tên sơ đồ;
POT ≥ OVR.

## 7. Kiểm chứng

`scripts/check-fc27.ts <đường dẫn save>` (dự án không có test framework):

- Dương tính, đi hết đường ống từ file thô: tiêu chí thành công ở §1, kèm POT
  thô của vài cầu thủ làm hồi quy (Bruno 90, Mainoo 87, Lammens 88).
- Mỏ neo ngoài cho hằng số cộng: teamid Man Utd = 11, Newcastle = 13.
- Âm tính: một save FC26 và một file rác bị từ chối bằng lỗi "không phải FC27".
- In thời gian đọc FC27, kèm thời gian đọc FC26 trên cùng máy để so.

Giao diện: dev server, tải save mẫu lên `/save-reader/fc27`, kiểm bốn tab, tải
lại trang (khôi phục IndexedDB), thử file FC26 để xem thông báo từ chối.

Save mẫu không commit (15 MB, dữ liệu cá nhân); script nhận đường dẫn qua tham số.

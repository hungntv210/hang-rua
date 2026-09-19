# Asset FC 26 — ba file, một nguồn, một lệnh

| file | cỡ | nội dung |
| --- | --- | --- |
| `names.json` | 764KB | kho tên 46.813 mục, `nameid → chữ` |
| `world.json` | 312KB | CLB, giải, số áo, tên quốc gia, tập id roster gốc, danh sách Ultimate Team |
| `formations.json` | 5KB | hình học 26 sơ đồ thực sự có đội dùng |

Cả ba sinh từ **một** lệnh:

```bash
npm run build:fc26     # dataset_fc26/ -> public/fc26/
npm run check:fc26     # cổng kiểm đầu-cuối, chạy trên 4 file save thật
```

## Nguồn

Toàn bộ đến từ **bảng gốc của chính game**, chụp một lần bằng
`scripts/fc26-dump-base.lua` (FC 26 Live Editor) vào `dataset_fc26/base/`:

```
playernames   dcplayernames   players      teamplayerlinks   teams
leagues       leagueteamlinks nations      formations        default_teamsheets
teamkits
```

Ngoại lệ duy nhất: `dataset_fc26/ut-ids.json` — 3.944 id nội dung Ultimate Team,
**di sản** từ một dataset công khai. Bảng `players` của game là roster Career
thuần (không có Icon nào), nên game không nói được id nào là nội dung ngoài
Career. Không tái tạo được; nếu FC 27 đổi thì phải tìm nguồn khác.

Trang **không** tải kèm cơ sở dữ liệu cầu thủ bên thứ ba nào.

## Ranh giới không được vượt

**Asset chỉ cấp tên, CLB gốc, giải, quốc tịch, số áo, hình học sơ đồ.**
Chỉ số, tiềm năng, tuổi, hạn hợp đồng — đọc hoặc tính từ chính file save.

Lý do: chỉ số đổi theo từng career. Lấy chúng từ asset nghĩa là hiện số liệu
của career người khác. Đây là ranh giới đã phải gỡ bỏ một lần rồi (bảng đội hình
xuất phát từng bị nướng vào `formations.json`), nên `build-fc26-assets.ts` cố ý
**không** ghi cột `position` ra file, và `check-fc26-world.ts` có một phép kiểm
canh đúng điều đó.

## Chụp lại khi nào

Khi EA ra bản game mới hoặc bản cập nhật đội hình lớn. Một lần, và:

1. **Thoát về MENU CHÍNH** — không vào career nào.
2. Live Editor → Lua Engine → chạy `scripts/fc26-dump-base.lua`.
3. `npm run build:fc26` rồi `npm run check:fc26`.

Bước 1 là bắt buộc, không phải khuyến nghị. Bản chụp khởi tạo lấy *trong* career
đã làm 55 cầu thủ học viện của một người lọt vào `players.csv`, hai CLB người đó
tự tạo lọt vào `teams.csv`. Riêng 55 cầu thủ kia còn làm hỏng cả một tính năng:
chúng khiến `isShipped()` trả `true`, nên tab Cầu thủ trẻ loại nhầm đúng những
người nó phải tìm. Phải viết một bộ lọc ở khâu gieo để vá — chạy đúng chỗ thì
không có gì để vá.

`scripts/check-fc26-base.ts` canh điều này bằng ba bất biến theo **nội dung**
(không phải theo tên file): không playerId nào ở dải học viện, không CLB tự tạo
nào có cầu thủ, không còn CLB tự tạo nào. Nhưng chúng canh **một hình dạng
nhiễm bẩn đã biết** (dải id ≥460.000), không canh mệnh đề tổng quát — bảo đảm
thật sự vẫn là bước 1.

**Trên máy khác:** script Lua thử ghi vào
`D:\Claude\projects\hang-rua\dataset_fc26\base` trước tiên. Không ghi được thì
nó lùi về Desktop và vẫn chạy bình thường — khi đó phải **tự chép 11 file CSV**
vào `dataset_fc26/base/` trước khi build. Hộp thoại kết luôn in ra thư mục nó
đã ghi.

Hộp thoại kết cũng là thứ duy nhất báo **thiếu bảng**: một bảng trả `nil` thì
file CŨ của bảng đó ở lại trong `base/` và mọi cổng vẫn xanh (file tồn tại, đủ
dòng, đúng cột khoá), rồi bản dựng trộn 10 bảng phiên bản mới với một bảng
phiên bản cũ. Tiêu đề hộp thoại đổi thành `THIEU n BANG` khi việc đó xảy ra —
đọc nó trước khi chạy `build:fc26`.

## Vì sao cần asset tên

File save Career Mode **không chứa tên cầu thủ dạng chữ** cho cầu thủ có sẵn.
Đã tìm `Haaland`, `Bellingham`, `Saka`, `Foden`, `Kane` ở UTF-8, UTF-16 và chữ
hoa — không mục nào tồn tại. EA giữ tên trong file cài game (superbundle
Frostbite, nén Oodle); save chỉ lưu **chỉ số tên** (`firstNameId`, `lastNameId`,
`commonNameId`).

Ba chỉ số đó trỏ vào cùng một không gian id, trải trên **hai** bảng của game:
`playernames` phủ 0–41.189 và `dcplayernames` phủ từ 44.000. Bản dựng cũ chỉ đọc
bảng thứ nhất, nên 15% cầu thủ mất tên và phải nhờ một dataset công khai 1,9MB
tra bù theo `playerId`. Gộp hai bảng thì không cần nữa.

Đo trên bốn file save thật, chỉ dùng save + kho tên:

```
2026-07-04   19.421/19.421 = 100,00%
2026-07-29   19.468/19.469 =  99,99%   (người còn lại có firstNameId = 65535,
2026-09-17   19.472/19.472 = 100,00%    tức chính game đánh dấu "không có tên")
2026-09-19   19.448/19.448 = 100,00%
```

# DB tên cầu thủ FC 26

`players.json` sinh ra bằng `npx tsx scripts/build-fc26-db.ts <players.csv>`.

**Nguồn:** [EAFC26-DataHub](https://github.com/ismailoksuz/EAFC26-DataHub),
file `data/players.csv`, dữ liệu gốc từ sofifa.

## Vì sao cần nó

File save Career Mode **không chứa tên cầu thủ thật**. Đã tìm `Haaland`,
`Bellingham`, `Saka`, `Foden`, `Kane` ở UTF-8, UTF-16 và chữ hoa — không mục nào
tồn tại. EA giữ tên trong file cài game (superbundle Frostbite, nén Oodle); save
chỉ lưu `playerId`.

Tên cầu thủ **do career sinh ra** thì ngược lại: có sẵn trong save và không cần
DB này. Hai nguồn bù nhau.

## Ranh giới không được vượt

DB này chỉ cấp **tên, CLB gốc, giải, quốc tịch**.

**Mọi chỉ số hiển thị đều đọc hoặc tính từ file save của người dùng.** Dataset là
ảnh chụp lúc game phát hành; save đã qua nhiều title update và có thể có mod. Lấy
chỉ số từ đây sẽ hiện số của một phiên bản game mà người dùng không chơi.

Vì `playerId` của EA không đổi giữa các patch, phần tên vẫn đúng kể cả khi
dataset lệch phiên bản.

## Tỉ lệ phủ, và cách nâng nó

**81,1%** bản ghi trong save ghép được tên. Nhóm còn lại (~4.050) đã được xác
minh là **không thể lấy tên từ save** — chi tiết ba phép thử trong spec.

Nhóm còn thiếu chủ yếu là đội trẻ và đội dự bị: không trang thống kê nào liệt kê
họ, vì họ không thi đấu ở giải nào.

Đã đo từng nguồn công khai tìm được:

| Nguồn | Cầu thủ | Nữ | Phủ save |
| --- | --- | --- | --- |
| sofifa | 18.405 | không | 73,5% |
| Trang chính thức EA | 16.228 | không | 65,6% |
| **api.msmc.cc** | 17.873 | **1.645** | 72,5% |
| **Gộp cả ba** | **20.156** | có | **81,1%** |

`api.msmc.cc` là nguồn công khai **duy nhất có cầu thủ nữ** (Putellas, Bonmatí,
Graham Hansen). FC 26 có đội nữ trong Career Mode nên thiếu nhóm này là thiếu
hẳn một mảng. Riêng nó bù được ~1.500 cầu thủ mà sofifa không có.

Tải lại bằng `npx tsx scripts/fetch-msmc-db.ts dataset_fc26/msmc-fc26.csv`.
Script đó lọc sẵn hai cái bẫy của dữ liệu thô: endpoint trả lẫn cả `fc25`, và
mỗi cầu thủ có nhiều bản `update` — phải lấy bản mới nhất.

**Cách duy nhất phủ gần 100%: export thẳng từ game.** Xem
`scripts/fc26-export-players.lua` — script chạy bằng FC 26 Live Editor, đọc bảng
`players` trong bộ nhớ game nên có cả cầu thủ nữ, đội trẻ và đội dự bị mà không
trang nào liệt kê.

Script gộp nhận nhiều file, ưu tiên file đứng trước:

```bash
npx tsx scripts/build-fc26-db.ts <export-tu-game>.csv <sofifa>.csv public/fc26/players.json
```

Xếp export từ game lên **trước** vì nó khớp đúng phiên bản và mod bạn đang chạy;
sofifa đứng sau để bù các cột mà export không có.

Trong lúc chưa có, nhóm thiếu tên vẫn đọc được đầy đủ chỉ số và được nhận dạng
qua quốc tịch — mã quốc gia đọc thẳng từ save nên áp dụng cho mọi cầu thủ, kể cả
người không có trong DB.

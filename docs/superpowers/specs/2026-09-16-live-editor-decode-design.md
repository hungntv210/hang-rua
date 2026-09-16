# Hoàn thiện Save Reader bằng ground truth từ Live Editor

Ngày: 2026-09-16. Trạng thái: **đã duyệt thiết kế, chưa triển khai**.

Tiếp nối `2026-08-05-career-player-list-design.md`. Bản đó khoá lại bốn hạng mục
với lý do "không đủ ground truth". Bản này mở lại cả bốn bằng một nguồn ground
truth khác hẳn về chất: FC 26 Live Editor đọc **trạng thái sống của game**, thay
vì ảnh chụp dataset công khai.

## Vì sao lần này khác — và đây không phải "thêm một nguồn nữa"

Ba nguồn đã thử (sofifa, trang EA, api.msmc.cc) đều là ảnh chụp tại một thời
điểm nào đó, còn save của người dùng đã trôi đi so với thời điểm ấy. Hệ quả đo
được: **trường đã biết chắc (`finishing`, `reactions`) khi đo bằng chính các
nguồn đó cũng chỉ trúng 51–64%.** Tín hiệu của trường chưa biết chìm dưới mức
nhiễu đó, nên không thể phân biệt "không tìm thấy" với "không có mặt".

Live Editor gắn vào tiến trình game đang chạy và đọc thẳng bảng trong bộ nhớ.
Nếu export và save lấy cùng một thời điểm thì mốc so sánh lên ~100%, và khoảng
cách giữa tín hiệu thật với nhiễu mở rộng ra đủ để kết luận.

Toàn bộ giá trị của bản thiết kế này nằm ở câu điều kiện đó. Xem mục "Cổng chặn
thời điểm".

## Phạm vi

| Hạng mục | Hiện tại | Mục tiêu |
| --- | --- | --- |
| Tên cầu thủ | 81,1% (gộp 3 nguồn) | ~100% |
| `volleys`, `def_awareness`, `gk_positioning` | ❌ chưa dò ra | Giải mã từ save |
| CLB hiện tại trong career | ❌ đang hiện CLB **gốc** | Giải mã từ save, hoặc gỡ cột |
| Giá trị chuyển nhượng, hợp đồng | ❌ ngoài phạm vi | Giải mã từ save nếu có |

## Ba nguyên tắc chi phối

1. **Không bao giờ hiển thị dữ liệu sai.** Field không giải mã được thì gỡ cột,
   không thay bằng dữ liệu ảnh chụp. Ô sai trông như đúng thì tệ hơn ô trống —
   người dùng phát hiện được ô trống, không phát hiện được ô sai.

2. **Export là ground truth lúc phát triển, không phải nguồn dữ liệu lúc chạy.**
   Mọi thứ hiển thị phải đọc hoặc tính từ file save người dùng tải lên. Ngoại lệ
   duy nhất là tên cầu thủ — xem mục "Tên cầu thủ".

3. **Một lượt chạy game duy nhất.** Script Lua phải **tự liệt kê schema** chứ
   không đoán tên field. Script hiện tại (`fc26-export-players.lua`) đoán
   `defensiveawareness` hay `marking` — với ràng buộc một lượt thì đó là lỗi
   thiết kế, không phải sự thận trọng.

## Cổng chặn thời điểm

Export và save **phải cùng một thời điểm**. Quy trình bắt buộc cho người chạy:

```
vào career  →  chạy script Lua  →  lưu game NGAY  →  dùng đúng file save đó
```

Cổng chặn nằm trong `probe-fields.ts`: trước khi dò bất cứ trường chưa biết nào,
nó đo lại các trường **đã biết chắc** (`finishing` bit 601, `reactions` bit 551,
`potential` bit 520 — đối chiếu `lib/save/career/schema.ts`) bằng chính file CSV vừa nhận.

- Mốc đạt ≥ 98% → tiếp tục.
- Mốc dưới 98% → **dừng, không diễn giải tiếp**, báo rõ rằng export và save lệch
  thời điểm và cần chạy lại.

Không có cổng này thì một lượt dò cho ra "không tìm thấy" mà không ai phân biệt
được là do trường không tồn tại hay do dữ liệu lệch — đúng vết xe của ba lần
trước.

## Thành phần

### 1. `scripts/fc26-dump-db.lua` — thay thế `fc26-export-players.lua`

API đã xác minh có trong FC 26 Live Editor:

| Hàm | Dùng để |
| --- | --- |
| `GetDBTablesNames()` | liệt kê mọi bảng đọc được |
| `GetDBTableFields(tên)` | liệt kê mọi cột của một bảng |
| `LE.db:GetTable` + `GetFirstRecord` / `GetNextValidRecord` / `GetRecordFieldValue` | duyệt theo con trỏ, không nạp hết vào RAM |
| `GetDBTableRows(tên)` | nạp trọn một bảng nhỏ |
| `GetPlayerName` / `GetTeamName` / `GetTeamIdFromPlayerId` | tên và CLB hiện tại |

Ba giai đoạn, **ghi ra đĩa tăng dần**:

| GĐ | Nội dung | File ra |
| --- | --- | --- |
| 1 | Mọi bảng × mọi field | `fc26_manifest.csv` |
| 2 | Bảng `players`: mọi cột GĐ1 tìm được, cộng `GetPlayerName` và `GetTeamIdFromPlayerId` | `fc26_players.csv` |
| 3 | `teams`, `teamplayerlinks`, và mọi bảng có tên chứa `career` | `fc26_<tên bảng>.csv` |

Giai đoạn 1 chạy vài giây và ghi ra đĩa **trước** giai đoạn quét chậm. Đây là
bảo hiểm cho ràng buộc một lượt: kể cả giai đoạn 2 treo hay crash, ta vẫn có
schema đầy đủ và lượt chạy không mất trắng.

Chống hỏng:

- Mọi lời gọi API bọc `pcall`. Một field lỗi không được giết cả lượt.
- `LOGGER` ghi tiến độ theo mốc để biết treo ở đâu.
- Hộp thoại cuối liệt kê số dòng từng file và **những bảng đọc không được**.

### 2. Tuyến A — `scripts/probe-fields.ts` (dò trường bit)

Đầu vào: file save + `fc26_players.csv`. Mục tiêu: `volleys`, `def_awareness`,
`gk_positioning`, giá trị chuyển nhượng, hợp đồng.

Quét offset bit 0–1151 × độ rộng 1–16 trong bản ghi 144 byte, chấm điểm bằng
**khớp tuyệt đối**.

Hai bài học bắt buộc giữ, cả hai đều lấy từ lỗi đã mắc:

- **Không dùng tương quan Pearson để chốt trường.** Vòng dò đầu đặt `potential`
  ở bit 519 với r = 0,96 và `dob` ở bit 719 với r = 0,9998; cả hai đều **lệch
  một bit**. Đọc sớm một bit cho `v = rác + 2×thật`, và Pearson mù trước phép
  biến đổi affine đó.
- **Kiểm chéo bằng hình dạng phân bố.** `gk_positioning` từng báo khớp 100% ở
  bit 280. Nguyên nhân: cột đó để trống với cầu thủ ngoài sân, `Number("")` trả
  `0` chứ không phải `NaN` nên lọt bộ lọc, và "khớp" thực chất là `0 === 0` lặp
  12.559 lần. Một chỉ số thủ môn thật phải tách hai nhóm rõ rệt (`gk_diving`:
  thủ môn 65 / ngoài sân 10).

Tiêu chí thắng: khớp tuyệt đối ≥ 95% **và** phân bố hợp lý với ngữ nghĩa của
trường.

### 3. Tuyến B — `scripts/probe-squads.ts` (dò cấu trúc CLB)

CLB **không cùng loại** với các chỉ số. Chỉ số là trường bit trong bản ghi 144
byte đã biết; CLB là một *quan hệ*, trong DB game nằm ở bảng riêng
(`teamplayerlinks`). Đây là dò **cấu trúc bảng**, không phải dò trường bit.

Đầu vào: file save + `fc26_teamplayerlinks.csv` (ground truth playerId → teamId).

Đã biết từ khảo sát trước: có bảng dạng `01 [u32 playerId][u16 position]` ở vùng
8,6–9,4MB, cầu thủ trong đó **có gom nhóm**, nhưng tỉ lệ đội chiếm đa số chỉ
8/21 — nên nó là phần tử TLV chung chứ không phải squad list sạch.

**Giới hạn 6 giả thuyết**, liệt kê sẵn ở đây để sau này không tự nới ra:

| # | Giả thuyết | Cách bác bỏ |
| --- | --- | --- |
| 1 | Mỗi nhóm có header mang teamId ngay trước cầu thủ đầu nhóm | Đọc u16/u32 tại ranh giới nhóm, đối chiếu ground truth |
| 2 | teamId là trường thứ ba trong chính bản ghi `01 [playerId][position]` | Nới bản ghi, thử mọi offset còn lại |
| 3 | Có bảng thứ hai ánh xạ số thứ tự nhóm → teamId | Tìm bảng cùng số phần tử với số nhóm |
| 4 | teamId nằm trong bản ghi cầu thủ 144 byte | Chạy tuyến A với teamId làm mục tiêu |
| 5 | Thứ tự nhóm trùng thứ tự teamId tăng dần (nhóm thứ n = đội thứ n) | So dãy nhóm với dãy teamId đã sắp xếp |
| 6 | Quan hệ nằm ở vùng khác — dò `playerId` ở mọi nơi trong file, xem chỗ nào đứng cạnh một u16/u32 khớp teamId | Quét toàn file |

Tiêu chí thắng ≥ 95% khớp teamId. Hết 6 mà không đạt → ghi kết quả vào spec,
**gỡ cột CLB**, dừng.

Giới hạn này là có chủ ý. Ba lần thất bại trước cho thấy việc dò bit không có
tiêu chí dừng thì kéo dài vô hạn mà không ai biết lúc nào nên bỏ cuộc.

### 4. Tên cầu thủ — và cái bẫy newgen

Tên **không thể** giải mã từ save: đã chứng minh ba cách độc lập rằng save không
chứa tên cầu thủ thật. EA giữ tên trong file cài game. Nên tên là ngoại lệ của
nguyên tắc 2.

Ngoại lệ này chính đáng vì **tên là hằng số theo phiên bản game**, không phụ
thuộc career của ai. Nướng vào `public/fc26/players.json` là đúng đắn và dùng
chung được — khác hẳn CLB, thứ thay đổi theo từng career.

**Nhưng phải loại cầu thủ newgen ra.** Newgen trong career này mang ID mà career
của người khác gán cho một cầu thủ hoàn toàn khác. Nướng newgen vào DB dùng
chung là gieo dữ liệu sai cho mọi người dùng khác. Lọc bằng chính bảng tên
newgen đọc được từ save (`lib/save/career/newgen-names.ts`).

Chỉ lấy **tên và quốc tịch** từ export. Không lấy CLB.

Hệ quả người dùng cần biết: newgen trong career của bạn sẽ không có tên khi
người khác mở save của bạn. Tên newgen vẫn đọc được từ chính save đó, nên với
người mở save của mình thì không đổi gì.

### 5. Thay đổi trên web

- **`lib/save/career/schema.ts`** — thêm offset bit cho các trường tuyến A giải
  mã được. Đồng thời thống nhất tên: `schema.ts` đang gọi trường còn thiếu là
  `marking_awareness`, script Lua gọi `def_awareness`, spec cũ gọi cả hai. Chốt
  một tên trước khi thêm offset, nếu không thì bảng nhãn và bảng offset sẽ lệch
  nhau đúng kiểu đã có tiền lệ trong dự án này.
- **`lib/save/career/ovr-model.ts`** — huấn luyện lại với đủ chỉ số. Nhóm GK
  hiện khớp tuyệt đối 61,0%, thấp nhất trong 13 nhóm vị trí, vì thiếu
  `gk_positioning`.
- **`components/save/PlayerTable.tsx`** — cột CLB đổi nhãn theo kết quả tuyến B:
  giải mã được → `CLB`; không → gỡ cột. Thêm cột giá trị/hợp đồng nếu có.
- **`lib/save/career/export.ts`** — thêm cột mới vào CSV/JSON, cập nhật
  `PROVENANCE`.
- **`scripts/build-fc26-db.ts`** — nhận `fc26_players.csv` làm nguồn ưu tiên cao
  nhất, kèm bộ lọc newgen.

## Thứ tự thực hiện — chắc ăn trước, rủi ro sau

1. Viết `fc26-dump-db.lua` → người dùng chạy **một lần** → nhận file về
2. Cổng chặn thời điểm — nếu không qua, dừng và chạy lại
3. **Tuyến A** → cập nhật `schema.ts`, train lại `ovr-model.ts`
4. **Tên** → build lại `players.json` (81,1% → ~100%)
5. **Tuyến B** → CLB thật
6. UI, cột mới, export, tài liệu

Bước 3–4 gần như chắc chắn thành công. Bước 5 thì không. Đặt bước 5 cuối để nếu
nó trượt, phần lớn giá trị đã được giao xong.

## Kiểm chứng

- Cổng chặn thời điểm phải đạt ≥ 98% trước khi tin bất cứ kết quả dò nào.
- Ground truth đối chiếu tay: Ren Imada, ID 460021, sinh 31-07-2011, OVR 66,
  POT 94.
- `npx tsx scripts/check-export.ts` — mở rộng cho các cột mới.
- `npx tsx scripts/probe-save.ts <save>` — không được hồi quy.
- `npm run build` xanh, chạy thật trên trình duyệt với save 15,2MB.

## Rủi ro đã biết

| Rủi ro | Mức | Xử lý |
| --- | --- | --- |
| Export và save lệch thời điểm | Cao | Cổng chặn, dừng sớm và báo rõ |
| Bảng `players` của Live Editor đọc DB gốc chứ không phải trạng thái career | Trung bình | Kiểm bằng newgen: newgen không tồn tại trong DB gốc, nếu export có newgen thì nó đang đọc trạng thái career |
| 3 chỉ số không nằm trong bản ghi 144 byte | Trung bình | Kết luận âm tính cũng là kết quả — ghi lại và đóng hạng mục |
| CLB không nằm trong vùng đã khảo sát | Cao | Giới hạn 6 giả thuyết rồi gỡ cột |
| `GetDBTableFields` không có trong FC 26 | Thấp | Script có nhánh dự phòng dùng danh sách tên field ứng viên |
| Script Lua treo giữa chừng | Trung bình | Ghi tăng dần, manifest ra đĩa trước |

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

---

## Cập nhật 2026-09-16 — kết quả từ `base_players.csv`

Người dùng có sẵn `C:\Users\...\FC26\player_presets\base_players.csv`: **dump đầy
đủ bảng `players` của game**, 22.348 cầu thủ, 149 cột, bao gồm cả ba trường chưa
giải mã (đều điền 100%). Đây là nguồn thứ tư, và là nguồn **chính thống** — ba
nguồn trước đều là dataset bên thứ ba.

### Nó KHÔNG thay được export Live Editor

| Thứ cần | `base_players.csv` |
| --- | --- |
| Tên cầu thủ | ❌ bốn cột tên rỗng 100% — EA giữ tên ở bảng chuỗi riêng |
| CLB hiện tại | ❌ không có cột đội; CLB nằm ở bảng quan hệ |
| Trạng thái cùng thời điểm | ❌ đây là DB **đầu career**, save đã trôi |

Cổng chặn tuyệt đối trượt đúng như với dataset cũ: `finishing` 64,1% (dataset cũ
62,9%), `reactions` 53,2%, `potential` 40,4%. Xác nhận nó là ảnh chụp đầu career.

File `cards.csv` cùng thư mục có tên thật nhưng là bảng thẻ Ultimate Team: chỉ
phủ thêm **308** trong 4.228 cầu thủ chưa có tên (80,4% → 81,8%). Không đáng đổi
kiến trúc.

### Chế độ `--baseline` — dò được offset dù nguồn đã trôi

Thêm vào `probe-fields.ts`. Lập luận: thứ cần tìm là **vị trí bit**, không phải
giá trị. Một trường 7 bit đặt sai chỗ chỉ trúng ngẫu nhiên ~0,8%. Nếu `finishing`
ở đúng chỗ đạt 64% thì trường đúng khác cũng phải quanh đó — cao hơn nhiễu tám
chục lần. Ngưỡng co theo mốc thay vì cố định 95%.

**Phép thử dương tính bắt buộc** trước khi tin bất cứ kết quả âm tính nào:

| Trường đã biết | Bộ dò tìm ra | `schema.ts` |
| --- | --- | --- |
| `strength` | bit 701, rộng 7, add 1 → 71,0% | `f(701, 7, 1)` ✅ |
| `gkdiving` | bit 477, rộng 7, add 1 → 88,6% | `f(477, 7, 1)` ✅ |

Bộ dò tự tìm lại đúng offset đã biết, nên kết quả âm tính là đáng tin.

### Kết quả

| Trường | Kết quả |
| --- | --- |
| `volleys` | ❌ không ứng viên nào vượt ngưỡng |
| `defensiveawareness` | ❌ không ứng viên nào vượt ngưỡng |
| `gkpositioning` | ❌ không ứng viên nào vượt ngưỡng |
| `contractvaliduntil` | ⚠️ tốt nhất bit 590 rộng 12 → 35,0%, dưới ngưỡng. Chưa kết luận |
| **`playerjointeamdate`** | ✅ **bit 1057, rộng 18 → 82,7%**, 1.923 giá trị phân biệt |

**Ba chỉ số coi như đã đóng.** Bốn nguồn độc lập, nguồn thứ tư là DB chính thống
của game và có phép thử dương tính kèm theo. Kết luận: chúng **không nằm trong
bản ghi 144 byte**. Không thêm nguồn nào giải quyết được nữa.

**`playerjointeamdate` là trường mới giải mã được.** Trúng ngẫu nhiên của trường
18 bit là ~0,0004%, nên 82,7% không thể do may. Epoch suy từ chính save ra khoảng
**1582** — đúng quy ước lịch Gregory của DB FIFA/FC. Các mốc giải ra hợp lý: p25
2022-11, p50 2024-04, p75 2024-10.

CHƯA đưa vào `schema.ts`: kết quả chế độ `--baseline` là tạm theo đúng quy tắc tự
đặt. Epoch cần chốt chính xác bằng export cùng thời điểm, nơi cổng chặn tuyệt đối
chạy được.

### Hai lỗi ngưỡng bắt được khi kiểm

Cả hai đều là ngưỡng viết cứng cho lọt thứ đáng lẽ phải chặn:

1. **`chênh > 25` cho kiểm chéo phân bố** — cho lọt lại đúng ứng viên giả bit 280
   (chênh 31,2), trong khi chỉ số thủ môn thật chênh 53-55. Đã thay bằng mốc đo
   từ chính save.
2. **Phép kiểm thủ môn áp cho mọi trường** — gắn nhãn "hợp với chỉ số thủ môn"
   cho `playerjointeamdate` (giá trị ~161.000), vì chênh lệch của một trường ngày
   tháng đương nhiên vượt mọi mốc. Đã chặn: chỉ áp trong dải chỉ số 1-99.

### Ảnh hưởng tới kế hoạch

Tuyến A còn lại **chỉ `contractvaliduntil` và giá trị chuyển nhượng** cần export.
Ba chỉ số đã đóng. Vẫn cần export Live Editor cho: tên (~4.228 cầu thủ), CLB
(tuyến B), và xác nhận `playerjointeamdate`.

---

## Cập nhật 2026-09-16 (chiều) — đã có export Live Editor thật

### Lượt chạy: game crash, nhưng không mất gì

Script chạy tới bảng cuối (`transfers`) thì game thoát hẳn. Thiết kế **ghi ra đĩa
tăng dần** đã cứu toàn bộ: `fc26_players.csv` (9,5MB), `fc26_teamplayerlinks.csv`
(1,0MB), `fc26_manifest.csv`, `fc26_teams.csv` và 30+ bảng `career_*` đều đã nằm
trên đĩa. Chỉ `fc26_transfers.csv` (0 byte) và `fc26_log.txt` là mất.

Người dùng không kịp lưu game. Nhưng save mới nhất (12-08) hoá ra **khớp tuyệt
đối** với export — họ chưa chơi thêm kể từ đó.

### Cổng chặn thời điểm: 5/5 ở đúng 100%

```
finishing 100,0%   reactions 100,0%   potential 100,0%
height    100,0%   weight    100,0%
```

Đây là ground truth sạch mà toàn bộ bản thiết kế chờ đợi. Đối chiếu: cùng phép đo
trên dataset công khai chỉ đạt 51-64%.

### Tuyến A — kết luận cuối cùng

| Trường | Kết quả với ground truth 100% sạch |
| --- | --- |
| `volleys` | ❌ không ứng viên nào |
| `defensiveawareness` | ❌ không ứng viên nào |
| `gkpositioning` | ❌ không ứng viên nào |
| `contractvaliduntil` | ❌ tốt nhất 50,8%, dưới ngưỡng 95% |
| `current_teamid` (= GT4) | ❌ không ứng viên nào |

**Ba chỉ số đóng vĩnh viễn.** Phép thử mạnh nhất có thể có đã chạy: ground truth
từ chính game, cùng thời điểm, cổng chặn 100%, kèm phép thử dương tính. Chúng
không nằm trong bản ghi 144 byte.

### Tuyến B — tìm ra cấu trúc, nhưng không dùng được

GT1 (header đầu nhóm), GT2 (trong bản ghi đội hình), GT4 (trong bản ghi cầu thủ),
GT5 (thứ tự nhóm): tất cả ~0%.

**GT6 tìm ra thật.** Sau khi sửa hai lỗi của bản đầu (chỉ xét lần xuất hiện đầu
tiên; công thức nhiễu vô nghĩa) và thêm **nhóm đối chứng xáo trộn** để đo nhiễu
thay vì suy luận:

```
khoảng cách +0:  thật 1457 / đối chứng 23     (vượt nhiễu 63 lần)
khoảng cách ±14: thật  403 / đối chứng  6     (bước lặp bản ghi)
```

Có bảng `[u32 playerId][u16 teamId]`, bước 14 byte, ở vùng 8,63-9,35MB. Dải liên
tục dài nhất đọc ra **608/608 đúng, 0 sai**.

**Nhưng không dùng được, vì hai lý do độc lập:**

1. **Độ phủ 12,7%** — chỉ 2.729/21.437 cầu thủ, 384/818 đội.
2. **Không định vị được bằng cấu trúc.** Quy tắc thuần cấu trúc (dải ≥8 bản ghi
   bước 14, mỗi bản ghi có playerId hợp lệ và u16 khác 0) cho **0,2% chính xác**:
   nó bắt nhầm chính bảng cầu thủ và các vùng khác. Trong 40.302 vị trí có
   playerId hợp lệ ở vùng đó, chỉ 8,3% có teamId đúng kề sau.

Điểm 2 mới là điểm chết: tôi chỉ **nhận ra** bảng nhờ đã biết đáp án. Save của
người khác không có đáp án, nên không đọc được. Theo tiêu chí ≥95%: **tuyến B
thất bại**.

Cột CLB giữ nguyên nhãn "CLB gốc" đã sửa ở commit trước — nó nói đúng thứ nó là,
nên không rơi vào trường hợp "hiển thị dữ liệu sai" mà quy tắc gỡ cột nhắm tới.

### Tên cầu thủ — thành công

| | Trước | Sau |
| --- | --- | --- |
| Save 12-08 | 80,4% | **99,1%** (còn 196) |
| Save 30-07 | 80,4% | **98,9%** (còn 232) |

Đạt trên CẢ HAI save nên không phải khớp trùng một file. DB từ 20.156 lên 24.174
cầu thủ.

`build-fc26-db.ts` đổi sang **gộp theo từng trường** thay vì "file đứng trước
thắng toàn bộ". Nếu không, 21.417 cầu thủ lấy tên từ export Live Editor sẽ mất
luôn CLB gốc mà dataset công khai vẫn có — mất thông tin không vì lý do gì. Sau
khi sửa: 24.174 có tên, 20.067 giữ được CLB gốc.

Kèm một lỗi hiển thị do chính thay đổi đó sinh ra: cầu thủ có tên mà không có CLB
nhận chuỗi rỗng, và chuỗi rỗng không kích hoạt `?? "—"` nên ô hiện trắng trơn,
trông như lỗi giao diện. Đã ép về `null`.

---

## Cập nhật 2026-09-16 (tối) — rà lại bộ export đầy đủ

Bộ 45 bảng đã chép vào `dataset_fc26/Live Editor/`. Trước đó mới xem 4 bảng.

### Lỗi đang chạy trên web: cột Tuổi sai 1 tuổi với gần như mọi cầu thủ

`estimateCurrentDay()` ưu tiên neo vào lứa học viện với hằng số 15,5 năm. Nó cho
ra **13-03-2027**, trong khi career thật đang ở đầu tháng 11 năm 2025 — **lệch
511 ngày**, và 100% cầu thủ hiển thị sai tuổi.

Ngày thật xác định được nhờ các bảng career trong export:

| Nguồn | Giá trị | |
| --- | --- | --- |
| `playermatchratinghistory.date` | 20251028 | trận gần nhất |
| `managerinfo.bigwindate` | 20251028 | |
| `scoutmission.returningdate` | 20251213 | sự kiện **tương lai** |
| `presignedcontract.completedate` | 20260101 | sự kiện **tương lai** |
| `managerhistory` | mùa 1, 12 trận | |

Career "hôm nay" nằm giữa 28-10-2025 và 13-12-2025.

**Hai lý do nhánh học viện hỏng:**

1. Hằng số sai — cầu thủ học viện trẻ nhất trong save là 14,15 tuổi, không phải
   15,5. Học viện nhận từ 14.
2. Cỡ mẫu quá nhỏ — career mùa 1 mới có 20 newgen, nên `max(...)` của nhóm đó là
   ước lượng rất nhiễu. Phân vị của 21.608 cầu thủ thì không.

**Sửa:** bỏ hẳn nhánh học viện, chỉ dùng phân vị 99,9% ngày sinh toàn bảng với
hằng số **16,47 năm** (đo được, không đoán). Neo này tự chỉnh theo thời gian vì
game liên tục sinh cầu thủ 16 tuổi mới.

Kết quả: phân bố tuổi từ lệch hệ thống thành **trung vị 25** — đúng chuẩn một
CSDL bóng đá. Newgen hiện 14-16 thay vì 15-17. Khớp ground truth Ren Imada (sinh
31-07-2011 → 14 tuổi).

Hằng số hiệu chuẩn trên MỘT career mùa 1, ngày thật chỉ biết trong khoảng ba
tuần, nên vẫn còn lệch 1 tuổi với vài phần trăm cầu thủ có sinh nhật rơi đúng
khoảng đó — thay vì gần như toàn bộ như trước.

### Những bảng khác: xem rồi, không dùng được

| Bảng | Nội dung | Vì sao không dùng |
| --- | --- | --- |
| `career_firstnames` / `lastnames` / `commonnames` | 11.848 + 9.442 + 489 dòng | Cột tên chứa **mã số**, không phải chữ — đây là kho tên để sinh newgen |
| `career_playercontract` | 45 dòng | Chỉ hai CLB của người chơi, không đủ để giải mã hợp đồng cho mọi cầu thủ |
| `career_regenplayerattributes` | 66 dòng, có đủ `volleys`/`defensiveawareness`/`gkpositioning` | Chỉ 66 regen; tuyến A đã bác bỏ bằng 21.436 mẫu ở cổng 100% |
| `career_calendar` | `currdate = 20080101` | Hàng mẫu mặc định, không phải trạng thái thật |
| `transfers` | 0 byte | Bảng làm game crash; có `transferamount` nhưng không lấy được |

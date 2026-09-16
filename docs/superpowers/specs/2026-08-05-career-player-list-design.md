# Danh sách cầu thủ Career Mode — đọc từ file save FC 26

Ngày: 2026-08-05. Cập nhật 2026-08-06. Trạng thái: **đã dựng và chạy được**.

## Trạng thái triển khai

| Hạng mục | Trạng thái |
| --- | --- |
| Định vị bảng tự động, không hằng số cứng | ✅ `lib/save/career/locate.ts` |
| `playerId`, `potential`, `dob`, `height`, `weight` | ✅ Đọc thẳng |
| Vị trí thi đấu | ✅ bit 738 rộng 5, bảng mã FIFA chuẩn |
| `overall` | ✅ Tính từ 31 chỉ số, lệch ≤1 ở 99,7% |
| 31 chỉ số chi tiết, IR, skill moves, chân không thuận, quốc tịch | ✅ Đọc thẳng |
| Tên cầu thủ do career sinh ra | ✅ Đọc từ save |
| Bảng UI: lọc, sắp xếp, tìm kiếm | ✅ `components/save/PlayerTable.tsx` |
| Quốc tịch (tên) | ✅ Mã đọc từ save, tên tra qua DB — dùng được cho **mọi** cầu thủ |
| Bảng 31 chỉ số chi tiết theo nhóm | ✅ Bấm vào dòng để mở |
| Kỹ năng, chân không thuận, danh tiếng | ✅ Đọc thẳng, 97–99% |
| Tên cầu thủ có sẵn | ✅ Gộp 3 nguồn ngoài, phủ 81,1% |
| **Tên cho ~19% còn lại** | ❌ Không khả thi từ save; cần export từ game |
| **CLB hiện tại trong career** | ❌ Chưa giải mã |
| `volleys`, `def_awareness`, `gk_positioning` | ❌ Chưa dò ra — đã thử **ba** nguồn ground truth độc lập |
| Giá trị chuyển nhượng, hợp đồng | ❌ Ngoài phạm vi bản này |

### Tên cầu thủ: đã loại trừ hướng "lấy từ save"

Ba phép thử độc lập, đều âm tính:

1. **Không có tên thật dạng chuỗi.** Tìm `Haaland`, `Bellingham`, `Saka`,
   `Foden`, `Kane`, `Vinicius`, `Mainoo` ở UTF-8, UTF-16 và chữ hoa — không mục
   nào tồn tại.
2. **Chỉ có một khối bảng tên.** Quét toàn file theo định dạng
   `[4 ô × 45 byte][u32 playerId]`: đúng **1 khối, 21 bản ghi**.
3. **Kho tên 40 byte không được trỏ tới.** Bảng có 5.623 mục, lúc đó gần bằng số
   cầu thủ thiếu tên (5.590) nên đáng ngờ — nhưng không trường nào trong bản ghi
   trỏ vào đó cho riêng nhóm này. Chênh lệch cao nhất giữa hai nhóm chỉ 11,7%,
   đúng mức trúng ngẫu nhiên của trường 13 bit (5623/8192 = 68,6%). Trùng số là
   ngẫu nhiên — và sau khi gộp thêm nguồn, số thiếu tụt xuống ~4.050 trong khi
   bảng vẫn 5.623 mục, xác nhận hai con số không liên quan gì nhau.

Nhóm thiếu tên phân bố: 2.866 ở dải playerId 50k–100k, 2.639 ở dải 200k–300k.

**Cách duy nhất để phủ tiếp là gộp nhiều nguồn ngoài.** Đã đo từng nguồn:

| Nguồn | Cầu thủ | Nữ | Phủ save |
| --- | --- | --- | --- |
| sofifa | 18.405 | không | 73,5% |
| Trang chính thức EA | 16.228 | không | 65,6% |
| api.msmc.cc | 17.873 | **1.645** | 72,5% |
| **Gộp cả ba** | **20.156** | có | **81,1%** |

Bài học ở đây: **không nguồn nào một mình tốt hơn hẳn**, nhưng chúng phủ những
mảng khác nhau. Nguồn phủ ít nhất (msmc, 72,5%) lại là nguồn **duy nhất có cầu
thủ nữ** — bỏ nó vì con số tổng thấp hơn thì mất trắng 1.500 cầu thủ. Vì vậy
`build-fc26-db.ts` nhận nhiều file và gộp theo thứ tự ưu tiên, thay vì bắt chọn
một nguồn "tốt nhất".

~4.050 cầu thủ còn lại chủ yếu là đội trẻ và đội dự bị: không trang thống kê nào
liệt kê họ vì họ không thi đấu ở giải nào. Chỉ export thẳng từ game
(`scripts/fc26-export-players.lua`) mới phủ được nhóm này.

Trong lúc chưa có, nhóm này vẫn **đọc được đầy đủ chỉ số** và được nhận dạng qua
quốc tịch, vị trí, tuổi, thể hình. Hiển thị "Cầu thủ Brazil · CB · 24 tuổi ·
71/78" hữu ích hơn hẳn một dòng ID trần trụi.

Kiểm chứng: `npx tsx scripts/probe-career.ts` cho 21.612 cầu thủ, khoá duy nhất
99,58%, 516ms; `npm run build` xanh; chạy thật trên trình duyệt với save 14,6MB.

### Hai lỗi chỉ lộ ra khi chạy thật, không phép đo nào bắt được

1. **Bảng bị nới thừa 370 bản ghi rác.** Tiêu chí "khoá `playerId` duy nhất" quá
   lỏng — dữ liệu ngẫu nhiên cũng cho khoá duy nhất. Triệu chứng chỉ thấy ở đầu
   ra: năm sinh trải 1941–2030, chiều cao 130–240cm. Sửa: bắt **bốn** trường cùng
   hợp lệ (id, chiều cao, tiềm năng, năm sinh).
2. **Bảng bị cắt còn 6.298 bản ghi.** Sau khi siết, vòng quét dừng ở ô hỏng đầu
   tiên — nhưng bảng thật có ô trống xen kẽ. Sửa: cho phép tối đa 64 ô hỏng liên
   tiếp trước khi kết luận hết bảng.

Cả hai đều là bài học chung: **một tiêu chí lọc không đủ chặt thì nới quá tay,
đủ chặt thì cắt quá tay.** Chỉ nhìn số lượng đầu ra và dải giá trị mới phát hiện.

### Tuổi phải neo vào dữ liệu, không vào ngày thật

Lịch trong game chưa giải mã được. Dùng ngày thật thì tuổi sai dần theo số mùa
đã chơi. Neo bằng **lứa học viện** — nhóm luôn 15–18 tuổi bất kể career chạy bao
lâu — cho kết quả đúng: Haaland 26, Yamal 19, Pedri 24.

Bản ghi có tuổi ngoài dải 14–45 bị loại hẳn (98 bản ghi trên save thử nghiệm).
Chúng không phải cầu thủ: đã thấy "cầu thủ" 65 tuổi chỉ số 94 lọt vào bảng.

Nối tiếp [save-reader](2026-08-04-save-reader-design.md), bản đó cố ý để lại phần
"bảng cầu thủ theo nghiệp vụ" ngoài phạm vi vì quan hệ giữa các bản ghi chưa xác
nhận được. Spec này gỡ đúng chỗ đó.

## Mục tiêu

Trang `/save-reader` hiển thị **danh sách cầu thủ của save career mode**: tên,
CLB, tuổi, vị trí, chỉ số hiện tại và tiềm năng — tương tự cmtracker.net. Lọc,
sắp xếp, tìm kiếm được.

Bản save-reader hiện tại chỉ bóc lớp field có tên (855 field, độ phủ 0,2%) —
phần sự kiện Career Mode. Lớp đó giữ nguyên, không viết đè. Spec này thêm một
tầng đọc **bảng nhị phân cầu thủ**, thứ chiếm phần lớn dung lượng file.

## Khảo sát — đã xác minh trên save thật

Đo trên `temp_fc26_upload/CmMgrC20260730232114046` (14,6MB).

### Bảng bản ghi cố định 144 byte

Tự tương quan bit trên vùng 2,62–5,50MB cho chu kỳ **1152 bit = 144 byte**, tỉ
lệ bit trùng 78,25% so với nền 61,36%, và mọi bội số (2304, 3456, 4608, …) đều
nổi lên ngay sau. Tính từ đầu bảng thật (offset 2.621.344), vùng này chứa
**20.025 bản ghi**.

Entropy vùng này là 5,8–6,0 bit/byte với ~32% byte 0. Đây là chữ ký của dữ liệu
**đóng gói theo bit**, không phải dữ liệu đã nén — dữ liệu nén thật sẽ ở ~7,99.

### Trường đã định vị

Bảng bắt đầu ở offset 2.621.344 (phase 0). Mọi vị trí tính theo bit trong bản
ghi, **LSB-first**.

| Trường | Vị trí | Phép cộng | Kiểm chứng |
| --- | --- | --- | --- |
| `playerId` | bit 1126, rộng 20 | — | 20.025 bản ghi, **0 ID trùng lặp**, ghép 73,2% |
| `potential` | bit 520, rộng 7 | **+1** | 100% trùng squad file; khớp ground truth từ game |
| `overall` | **KHÔNG LƯU — phải tính** | — | Hồi quy từ 31 chỉ số, sai số ±1. Xem bên dưới |
| 31 chỉ số chi tiết | nhiều vị trí, rộng 7 | **+1** | Khớp tuyệt đối 61–96% trên squad file |
| `dob` | bit 718, rộng 15 | −10356 | **100%** trùng squad file. Số ngày kể từ 1941-08-25 |
| `height` | bit 675, rộng 7 | +130 | **100%** trùng squad file, đơn vị cm |
| `weight` | bit 812, rộng 7 | +30 | **100%** trùng squad file, đơn vị kg |

### `overall` không được lưu — nó được TÍNH

bit 551 từng bị nhận nhầm là `overall`: tương quan 0,87, dải 29–95, ổn định
82,4% so với squad file. Nhưng khớp tuyệt đối chỉ 5,7%, và ground truth từ game
bác bỏ nó (Ren Imada OVR 66, bit 551 cho 55).

Quét 31 chỉ số chi tiết đã giải thích tất cả: **bit 551 là `movement_reactions`**
(khớp 64,3%). Trong FC, Reactions gần như tỉ lệ thuận với OVR — đó chính là
nguồn gốc của tương quan 0,87 đánh lừa. Một chỉ số thành phần bị nhận nhầm thành
chỉ số tổng.

Quét toàn bộ 1.152 vị trí không tìm được trường nào khớp `overall`. Kết luận:
**overall không có trong bản ghi.** Nó không được lưu vì không cần lưu.

Cách dựng lại: hồi quy tuyến tính `overall ~ 31 chỉ số`, huấn luyện theo 8 nhóm
vị trí trên chính dataset (nơi có sẵn cả hai vế). Tái tạo trên tập huấn luyện:

| Nhóm | Mẫu | Đúng | Lệch ≤1 |
| --- | --- | --- | --- |
| CAM | 1.137 | 93,0% | 100% |
| CM | 2.214 | 91,2% | 100% |
| ATT | 2.534 | 88,0% | 100% |
| FB | 2.790 | 79,2% | 100% |
| WIDE | 2.909 | 76,2% | 99,3% |
| CDM | 1.433 | 75,4% | 100% |
| CB | 3.326 | 71,8% | 99,3% |
| GK | 2.062 | 61,0% | 97,3% |

Lệch ≤1 đạt 97–100% ở mọi nhóm — overall là **hàm tất định của các chỉ số**, đúng
như giả thuyết. Áp mô hình lên chỉ số đọc từ save, Ren Imada ra 65 so với ground
truth 66: nằm trong sai số mô hình, và khác hẳn con số 55 của bit 551.

Hệ quả cho UI: cột OVR là **giá trị tính**, không phải giá trị đọc. Phải ghi rõ
điều đó và chấp nhận sai số ±1. Không được trình bày nó như số lấy thẳng từ file.

### Khối 31 chỉ số chi tiết

Tất cả rộng 7 bit, LSB-first, **đều cộng 1** — quy ước lưu 0-based dùng chung
với `potential`. Khớp tuyệt đối trên squad file 61–96%.

```
crossing 513  finishing 601  heading 984  shortpass 915  dribbling 608
curve 360  fkacc 922  longpass 445  ballctrl 758  accel 970  sprint 667
agility 368  reactions 551  balance 865  shotpower 772  jumping 1107
stamina 1119  strength 701  longshots 470  aggression 963  interceptions 501
positioning 397  vision 583  penalties 452  composure 558  standtackle 432
slidetackle 615  gkdiving 477  gkhandling 1019  gkkicking 892  gkreflexes 527
```

Chưa tìm được: `volleys`, `def_awareness`, `gk_positioning`. Ba trường này không
chặn việc tính OVR (mô hình đạt ±1 mà không có chúng).

Đã thử **ba nguồn ground truth độc lập** (sofifa, trang EA, api.msmc.cc), tất cả
đều thất bại. Cách đọc kết quả: trường **đã biết chắc** khi đo bằng cùng nguồn
chỉ đạt 51–64% (do save đã trôi so với ảnh chụp), nên đó là mốc so sánh — không
phải 100%.

| Trường | Tốt nhất | So mốc 51–64% |
| --- | --- | --- |
| `volleys` | 2,5% | Không có mặt |
| `def_awareness` | 11,1% (bit 899) | Không có mặt |
| `gk_positioning` | không ứng viên nào qua kiểm chứng | Không có mặt |

`def_awareness` cho ra **cùng bit 899 ở cả ba nguồn** — thoạt nhìn như một tín
hiệu, nhưng 11% quá xa mốc nên đó là một trường *tương quan* chứ không phải
trường thật. Kết luận: ba chỉ số này nhiều khả năng **không nằm trong bản ghi
144 byte**. Thêm dataset nữa sẽ không giải quyết được; cần hướng khác.

Một dương tính giả đáng ghi lại: vòng đo đầu báo `gk_positioning` khớp **100%**
ở bit 280. Nguyên nhân là lỗi trong phép đo — cột đó **để trống** với cầu thủ
ngoài sân, `Number("")` trả `0` chứ không phải `NaN` nên lọt qua bộ lọc, và
"khớp" thực chất là `0 === 0` lặp 12.559 lần. Bắt được nhờ kiểm chéo bằng hình
dạng phân bố: một chỉ số thủ môn thật phải thấp hẳn ở cầu thủ ngoài sân
(`gk_diving`: thủ môn 65 / ngoài sân 10), còn ứng viên kia không tách hai nhóm.

### Tương quan không đủ để chốt trường — phải dùng trùng khít tuyệt đối

Vòng dò đầu đặt `potential` ở bit 519 rộng 8 với r = 0,96 và `dob` ở bit 719
rộng 17 với r = 0,9998. **Cả hai đều lệch một bit.** Giá trị đọc ra bị nhân đôi:
potential ra 173–184 thay vì 87–92, ngày sinh hồi quy ra hệ số 1,999 thay vì 1,0.

Tương quan Pearson **mù trước lỗi này**: đọc sớm một bit cho `v = rác + 2×thật`,
vẫn tuyến tính với `thật` nên r vẫn ~0,96. Chỉ khi in giá trị thật ra và so tuyệt
đối mới lộ.

Vì vậy `discover-fields.ts` chốt trường bằng **tỉ lệ trùng khít tuyệt đối** sau
khi ước lượng phép tịnh tiến bằng trung vị, tuyệt đối không bằng tương quan.
Tương quan chỉ dùng để **thu hẹp ứng viên**, không bao giờ để kết luận.

### Squad file đầu career là ground truth đúng, không phải dataset

Đo `potential` bằng dataset công khai chỉ ra 38,7% trùng khít — nhìn như parser
sai. Đo bằng squad file lưu lúc bắt đầu chính career đó thì ra **100%**.

Sai lệch nằm ở thước đo: dataset là ảnh chụp lúc game phát hành, còn save đã qua
nhiều title update và có mod Youth Academy Redux. So career save với squad file
trên 18.170 cầu thủ chung:

| Trường | Trùng khít | Lệch TB | Lệch lớn nhất |
| --- | --- | --- | --- |
| `potential` | 100,0% | 0,00 | 3 |
| `dob` | 100,0% | 0,00 | 0 |
| `height` | 100,0% | 0,00 | 0 |
| `weight` | 100,0% | 0,00 | 0 |
| `overall` | 82,4% | 0,20 | 4 |

Bốn trường bất biến trùng 100% là bằng chứng schema đúng. `overall` lệch 82,4%
với sai số trung bình 0,20 chính là **quá trình phát triển cầu thủ sau một mùa**
— đúng thứ một career tracker cần hiển thị, không phải lỗi.

**Nguyên tắc rút ra: đo một trường bằng nguồn không cùng phiên bản thì đang đo
cả độ lệch phiên bản lẫn độ đúng của parser, và không tách được hai thứ đó.**

Ứng viên `bit 371` từng trúng tập ID tới 90,4% nhưng chỉ có 2% giá trị khác nhau
— loại. **Tính duy nhất là tiêu chí phân biệt playerId, không phải tỉ lệ trúng.**

Đối chiếu tay sau khi ghép, hợp lý cả tên lẫn CLB lẫn vị trí:

```
rec    0  Barrachina      61/81  18t  CB, LB        Real Zaragoza
rec    3  M. Yalcouyé     71/82  19t  CM, RM, CAM   Swansea City
rec    9  R. Schewe       52/58  23t  GK            Sporting Kansas City
```

### Phase phải neo bằng trường ID, không bằng entropy

Lần dò đầu tiên chọn phase bằng heuristic entropy cột và lệch **108 byte**. Hậu
quả: mọi trường nằm sau bit 288 bị tràn sang bản ghi kế tiếp, tương quan bị phá
sạch. `potential` và `dob` "biến mất" hoàn toàn — kết luận sai là chúng nằm ở
bảng khác. `playerId` và một trường overall sống sót chỉ vì chúng không tràn.

Đây là cái bẫy đắt nhất của định dạng đóng gói bit: **phase sai không gây lỗi,
nó chỉ lặng lẽ trả về dữ liệu vô nghĩa.** Vì vậy `locate.ts` neo phase bằng
trường ID (xem phần Định vị bảng), tuyệt đối không bằng entropy.

### Squad file dùng chung layout

Thư mục save thật là `%LOCALAPPDATA%\EA SPORTS FC 26\settings\`. Ngoài file
career còn có **`Squads…` (10,4MB)** — squad file của game.

Vùng 4,98–7,60MB của file này có **cùng chu kỳ 1152 bit** và **cùng bộ offset
trường** với career save: `playerId` @1126, `potential` @519 (r = 0,9607),
`dob` @719 (r = 0,9996), `overall` @551 (r = 0,8779). 18.203 bản ghi.

Đây là xác nhận độc lập mạnh nhất có được: cùng một schema đọc đúng trên **hai
định dạng file khác nhau**, do hai đường ghi khác nhau sinh ra. Trùng hợp không
tạo ra được điều đó.

Hệ quả cho việc kiểm chứng: squad file lưu lúc bắt đầu career là **ground truth
hoàn hảo** cho chính career đó — cùng bản patch, cùng mod, cùng đúng tập cầu
thủ. Tốt hơn dataset công khai. Dùng nó để tinh chỉnh `overall`, trường duy nhất
còn dưới 0,90.

### Các bảng khác đã đọc được

| Vùng | Nội dung | Cấu trúc |
| --- | --- | --- |
| 6.963.709 – 6.967.757 | **Tên cầu thủ do career sinh ra**, 22 bản ghi | stride 184: `[4 ô × 45 byte NUL-pad][u32 playerId]` — khoá đứng **SAU** tên. Ô0 tên, ô1 rỗng, ô2 họ, ô3 tên áo |
| 7.260.191 – 7.485.071 | **Kho tên** để bộ sinh rút ra — KHÔNG phải bảng gán tên | stride 40: `[u16 id][38 byte NUL-pad]`, id liên tục 1…5623 |
| 1,53 – 1,69MB | Tên CLB, giải, quốc gia | chuỗi NUL-pad trong bản ghi ~188 byte |
| 7,56 – 7,82MB | Tên HLV + index băm | `[hash 4B][độ dài][kiểu][offset tích luỹ]`, 16 byte/mục |
| ~1,37MB | Bảng có **con trỏ 64-bit** | Xác nhận file là ảnh bộ nhớ được serialize |

### Điều đã loại trừ

File save **không chứa tên cầu thủ thật**. Đã tìm `Haaland`, `Bellingham`,
`Saka`, `Foden`, `Kane`, `Vinicius`, `Mainoo` ở UTF-8, UTF-16 và chữ hoa — không
mục nào tồn tại. EA giữ tên cầu thủ trong file cài game; save chỉ lưu player ID.

Dữ liệu trong thư mục game cũng **không lấy trực tiếp được**: nằm trong
superbundle Frostbite (`Data/Win32/*.toc`/`.sb`/`.cas`) nén bằng Oodle. Cache
28MB của FIFA Editor Tool giải nén ra 195MB nhưng chỉ là **index asset**
(365.626 đường dẫn), không có nội dung DB và không có tên file legacy.

## Nguồn dữ liệu ngoài

Dùng dataset công khai [EAFC26-DataHub](https://github.com/ismailoksuz/EAFC26-DataHub)
(`data/players.csv`, 18.407 dòng, 110 cột, nguồn sofifa). Cột `player_id` chính
là **EA player ID** — cùng không gian ID với save, đã kiểm chứng bằng tỉ lệ ghép
73,2% và 0 ID trùng lặp.

Dataset đảm nhiệm đúng hai việc:

1. **Bảng tra tên** — player ID của EA không đổi giữa các patch, nên tên lấy từ
   dataset luôn đúng kể cả khi lệch phiên bản.
2. **Ground truth để dò trường** — chỉ cần tương quan, không cần trùng khít. Một
   dataset lệch vài điểm rating vẫn cho r ≈ 0,97 ở đúng vị trí bit và ≈ 0 ở mọi
   vị trí khác. Tín hiệu vẫn dứt khoát.

**Chỉ số hiển thị cho người dùng luôn đọc từ save, không lấy từ dataset.** Đây là
ranh giới quan trọng: dataset lệch patch không làm sai số liệu người dùng nhìn
thấy, vì nó không tham gia vào đường dữ liệu đó.

27% bản ghi không ghép được **không phải đều là regen** — đây là chỗ khảo sát ban
đầu đoán sai. Đo lại: chỉ **22 bản ghi** (playerId 460010–460033, đúng một lứa
học viện) có tên trong bảng newgen. Phần còn lại nằm ở dải playerId thấp
(70.834–73.000), tức cầu thủ có sẵn của game mà dataset công khai thiếu.

Vì vậy nguồn tên phải xếp theo thứ tự, không phải nhị phân regen/thật:

1. Bảng newgen khoá theo playerId trong save (chính xác nhất, có bao nhiêu dùng
   bấy nhiêu).
2. Dataset nhúng, tra theo playerId.
3. Không có cả hai → hiển thị playerId và **đánh dấu rõ là chưa có tên**, không
   bịa và không ẩn đi.

Tỉ lệ nhóm 3 hiện chưa đo được chính xác; phải đo trước khi chốt UI, vì nếu nó
lớn thì bảng cầu thủ sẽ đầy ID trần trụi.

Chỉ đóng gói tập cột cần dùng (id, tên, vị trí, quốc tịch, ảnh) chứ không bê cả
110 cột: 11MB CSV rút còn ~1,5MB JSON gzip. Ghi rõ nguồn và giấy phép trong
`public/fc26/README.md`.

## Kiến trúc

```
File save (client)  ─►  Web Worker  ─┬─►  bảng 144B      ─┐
                                     ├─►  bảng tên newgen ├─►  ghép theo playerId
                                     └─►  bảng CLB/giải   ─┘         │
                                                                      ▼
public/fc26/players.json.gz  ────────────────────────────────────────┘
```

Giữ nguyên hai quyết định của bản trước, vì lý do vẫn còn nguyên giá trị:

- **Parse ở client trong Web Worker.** Route handler Next 14 trên Vercel giới hạn
  body ~4,5MB; file 15–50MB hỏng ở tầng hạ tầng trước khi chạm parser. Save là dữ
  liệu cá nhân, không có lý do gửi lên server.
- **`lib/save/*` không chạm DOM.** Nhờ vậy chạy được bằng Node trên save thật để
  kiểm chứng — dự án chưa có test framework nên đây là cách verify duy nhất có
  thật.

DB nhúng tải song song với lúc người dùng chọn file, cache bằng HTTP. Không có gì
rời khỏi máy người dùng.

## Định vị bảng — không hằng số cứng

Offset `2621452` là của **riêng file save này**. Save khác sẽ khác. Hằng số cứng
ở đây là lỗi chờ xảy ra, nên `locate.ts` tìm lại bảng mỗi lần parse, hai bước:

1. **Tự tương quan bit** trên các vùng entropy cao để tìm chu kỳ bản ghi. Chạy
   dưới một giây trên vùng 3MB.
2. **Neo bằng chính trường ID**: trượt pha, chọn pha cho ra dãy giá trị 20 bit
   **duy nhất** và rơi vào dải ID hợp lệ ở tỉ lệ cao nhất. Mở rộng hai đầu chừng
   nào bản ghi còn thoả. Bảng tự xác nhận chính nó, không cần biết trước biên.

Bước 2 quan trọng hơn bước 1: nó biến việc định vị thành một phép đo có tiêu chí
đúng/sai rõ ràng, thay vì tin vào một đỉnh tự tương quan.

## Quy trình dò trường

`scripts/discover-fields.ts` — công cụ lặp lại được, không phải script dùng một
lần. Nhận save + dataset, xuất bảng ánh xạ:

1. Ghép bản ghi với dataset qua `playerId`.
2. Với mỗi vị trí bit (0…1151), mỗi độ rộng (5…24), mỗi thứ tự bit, tính tương
   quan Pearson với từng cột dataset.
3. Nhận trường khi r ≥ 0,90 **và** ứng viên kế tiếp (không chồng lấn bit) có r
   thấp hơn ít nhất 0,15. Ngưỡng cách biệt là phần quan trọng: `overall` đạt
   0,968 trong khi ứng viên kế là 0,718, cách 0,25 — một trường thật luôn tách
   hẳn khỏi đám bóng của nó.
4. Ghi kết quả vào `lib/save/career/schema.ts`.

`schema.ts` cố ý là **dữ liệu thuần chứ không phải code**: khi FC ra patch đổi
layout, sửa một bảng ánh xạ, không phải viết lại parser.

Bước tiếp theo có giá trị nhất là **quét nốt các trường còn lại** (vị trí, quốc
tịch, CLB, chân thuận, 35 chỉ số chi tiết) bằng đúng quy trình trên với dataset
làm ground truth, và **tinh chỉnh `overall`** bằng squad file lúc bắt đầu career
thay vì dataset công khai.

## Cấu trúc file

```
lib/save/
  reader.ts, fbchunks.ts, tlv.ts, infer.ts, adapter.ts   giữ nguyên
  bitreader.ts        MỚI  đọc trường bit, có kiểm biên, hỗ trợ cả hai thứ tự bit
  career/
    locate.ts         MỚI  định vị bảng (tự tương quan + neo bằng trường ID)
    schema.ts         MỚI  ánh xạ bit → trường. Dữ liệu thuần, do script sinh
    players.ts        MỚI  bản ghi → RawPlayer
    strings.ts        MỚI  bảng tên newgen + bảng CLB/giải/quốc gia
    join.ts           MỚI  RawPlayer + DB nhúng → SavePlayer
lib/fc26/
  db.ts               MỚI  tải và tra cứu DB nhúng
public/fc26/
  players.json.gz     MỚI  DB nhúng đã rút gọn cột
  README.md           MỚI  nguồn, giấy phép, ngày cập nhật
components/save/
  PlayerTable.tsx     MỚI  bảng cầu thủ: lọc, sắp xếp, cột tuỳ chọn
  PlayerFilters.tsx   MỚI  lọc theo CLB / giải / vị trí / tuổi / OVR
scripts/
  discover-fields.ts  MỚI  dò bit layout bằng ground truth
  build-fc26-db.ts    MỚI  CSV → JSON tĩnh đã rút gọn
```

Hai tầng kiểu, đúng convention `lib/types.ts` và spec trước:

1. `RawPlayer` — bám sát bit trong file.
2. `SavePlayer` — đã chuẩn hoá và ghép tên, dành cho UI.

`join.ts` giữ vai trò adapter, đúng như `lib/football-data.ts` đang làm.

## Giao diện

Tab mới "Cầu thủ" cạnh các tab hiện có. Bảng dùng đúng cơ chế windowing tự viết
của `SaveFieldTable.tsx` (dự án đang zero-dependency, không thêm thư viện bảng
ảo hoá).

Cột mặc định: tên, CLB, tuổi, vị trí, OVR, POT. Nguồn tên hiển thị bằng dấu hiệu
phân biệt — cầu thủ do career sinh ra phải nhìn ra được là newgen, và cầu thủ
chưa tra được tên phải nhìn ra được là chưa có tên. Không nhóm nào được trộn lẫn
im lặng với cầu thủ gốc.

**Trường chưa giải mã thì không hiển thị.** Cột nào chưa dò ra thì bỏ khỏi bảng,
không hiện ô trống cũng không hiện số đoán. Một chỉ số sai còn tệ hơn một chỉ số
thiếu, vì người dùng không có cách nào biết nó sai.

## Giới hạn tài nguyên

Kế thừa nguyên trạng từ bản trước: trần file 128MB (cảnh báo từ 64MB),
`file.arrayBuffer()` gọi bên trong worker và buffer không bao giờ vào React
state, progress đẩy về mỗi ~1MB, fallback parse trên main thread nếu
`new Worker` thất bại.

Thêm: trần 100.000 bản ghi cầu thủ. Vượt thì dừng và bật cờ `truncated` hiển thị
rõ trên UI, không im lặng cắt.

## Xử lý lỗi

Giữ nguyên hợp đồng cũ: `parseSaveBuffer` không bao giờ throw, kết quả luôn có
`issues: SaveIssue[]`.

Thêm các issue mới: không định vị được bảng cầu thủ, không tải được DB nhúng, tỉ
lệ ghép thấp bất thường (< 40% — dấu hiệu save thuộc phiên bản FC khác). Cả ba
đều làm suy giảm chức năng chứ không làm hỏng trang: tab field sự kiện vẫn chạy.

## Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| Chọn sai phase → số vô nghĩa mà không báo lỗi | Neo phase bằng trường ID; bật issue khi tỉ lệ ID duy nhất < 95% hoặc tỉ lệ ghép < 40% |
| Save của FC bản khác có layout khác | `locate.ts` tự dò; tỉ lệ ghép thấp bật issue thay vì hiện số sai |
| Dataset lệch patch | Không ảnh hưởng: chỉ số đọc từ save, dataset chỉ cấp tên và làm ground truth |
| Trường lệch một bit mà vẫn cho r cao | Chốt bằng trùng khít tuyệt đối, không bằng tương quan. Đã bắt được đúng lỗi này ở `potential` và `dob` |
| Bảng phụ có khoá đứng SAU dữ liệu | Đã gặp ở bảng tên newgen. Khi dò bảng mới, luôn kiểm cả hai chiều bằng ground truth trước khi chốt |
| playerId dải 460.0xx bị tái sử dụng qua các lứa học viện | Không dùng playerId newgen làm danh tính bền vững giữa các save. Ngày sinh của cùng ID đổi qua 3 file save — đã đo |
| Đo bằng nguồn lệch phiên bản → tưởng parser sai | Ground truth là squad file cùng career, dataset chỉ dùng để thu hẹp ứng viên |

Rủi ro "mới kiểm trên một file save" đã gỡ: thư mục save có **3 file career**
(04/07, 29/07, 30/07) cộng squad file, đủ để kiểm chứng chéo cả theo thời gian
lẫn theo định dạng.

## Ngoài phạm vi

Giải nén superbundle Frostbite; chỉnh sửa và ghi ngược file save; ảnh mặt cầu
thủ; lưu kết quả lên server; bảng chuyển nhượng theo nghiệp vụ.

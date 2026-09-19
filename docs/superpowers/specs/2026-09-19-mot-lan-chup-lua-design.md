# Một lần chụp Lua, dùng cho mọi save

Ngày 2026-09-19 · trạng thái: đã duyệt thiết kế, chờ kế hoạch triển khai

## Vấn đề

Save Reader hiện cần Lua như công cụ gỡ lỗi: thiếu dữ liệu gì thì mở game chạy
Lua lấy thứ đó. Hệ quả là mỗi lần phát hiện sai sót lại phải mở game một lần
nữa, và người dùng không thể chỉ thả một file save vào trang mà xong việc.

Yêu cầu: **một file Lua chạy một lần, lấy đủ mọi thứ cần thiết, để một chức năng
tổng quát phục vụ được càng nhiều save càng tốt.**

## Đo đạc

Mọi con số dưới đây đo trên **bốn** file save thật trong
`%LOCALAPPDATA%\EA SPORTS FC 26\settings` (`CmMgrC2026-07-04`, `2026-07-29`,
`2026-09-17`, `2026-09-19`). Một save không chứng minh được tính tổng quát.

### Gốc rễ của việc thiếu tên

Game có **hai** bảng tên, không phải một:

| bảng | dải `nameid` | số mục |
| --- | --- | --- |
| `playernames` | 0 – 41.189 | 41.190 |
| `dcplayernames` | 44.000 trở lên | 5.624 |

`scripts/build-fc26-namepool.ts` chỉ đọc bảng thứ nhất. Nhóm cầu thủ trượt tra
tên đều có `lastNameId` quanh 44.0xx — nằm gọn trong bảng thứ hai. Phân nhóm
theo nguyên nhân trên save `2026-09-19` (19.448 cầu thủ):

```
 14003 (72,00%)  tra được (first + last)
  2916 (14,99%)  chỉ số CÓ nhưng vắng trong kho   ← toàn bộ là dải 44.000+
  2529 (13,00%)  tra được (common)
```

### Hệ quả: `players.json` là thừa

Ghép hai bảng rồi tra bằng chính `nameId` mà save mang theo, **không** dùng
`players.json`:

| save | phủ | ghi chú |
| --- | --- | --- |
| `2026-07-04` | 19.421/19.421 = 100,00% | |
| `2026-07-29` | 19.468/19.469 = 99,99% | người còn lại có `f=65535`, tức dấu "không có tên" |
| `2026-09-17` | 19.472/19.472 = 100,00% | |
| `2026-09-19` | 19.448/19.448 = 100,00% | |

So sánh: kho tên hiện tại một mình phủ 85%; chuỗi hiện tại **có**
`players.json` phủ 99,98%. Nghĩa là file 1,9MB ghép từ ba dataset công khai —
nguồn của cả tật tên lặp lẫn các lỗ hổng — thay được bằng khoảng 100KB CSV gốc
của game.

### Bảng gốc là roster Career thuần

Tìm Pelé, Maradona, Zidane, Cruyff, Ronaldinho, Eusébio trong `players`: không
có ai. Đội đông nhất 38 người, "Free Agents" 147. Bảng `players` của game không
chứa nội dung Ultimate Team.

Nhưng cờ `isUltimateTeam` hiện tại **vẫn đúng và vẫn cần**:

```
2026-09-19: 19.448 cầu thủ, bị lọc 112 — trong đó có trong bảng gốc: 0
2026-09-17: 19.472 cầu thủ, bị lọc  67 — trong đó có trong bảng gốc: 0
```

Không người nào bị lọc oan. Cờ này thật sự đánh dấu nội dung ngoài Career, và
bảng gốc không có cách nào tự phân biệt — nên phải giữ danh sách id.

### Vì sao bản dump cũ chậm

Bản dump đầy đủ có 248 bảng. Bốn bảng lưới mặt và xương chiếm khoảng 68MB và
hoàn toàn vô dụng với dự án: `flesh` 22.590KB, `skeletal` 21.300KB, `fat`
18.176KB, `skins` 6.330KB.

## Quyết định

**Chụp rộng một lần, chọn hẹp khi build.** Một file Lua dump 11 bảng hằng số
phiên bản, **giữ nguyên mọi cột**, chạy **ngoài career mode**. Cần thêm trường
về sau thì chạy lại bước build, không mở lại game.

Giá phải trả: khoảng 11,5MB CSV nằm trong repo. Đây là con số một lần, không
tăng theo số save, và nó chính là thứ mua được điều kiện "không chạy lại Lua".

Đã cân nhắc và loại:

- **Chụp hẹp chỉ cột đang dùng** — repo chỉ tốn ~1,5MB, nhưng mỗi lần cần
  trường mới lại phải mở game. Đúng thứ cần bỏ.
- **Chỉ vá thêm `dcplayernames`** — tên lên 100% ngay, nhưng `players.json`
  1,9MB công khai vẫn còn cùng tật của nó, và lần thiếu dữ liệu sau vẫn phải
  chạy Lua.

## Kiến trúc

Ba tầng, mỗi tầng một trách nhiệm, nối nhau bằng thư mục và file:

```
   game (một lần, ngoài career)
        │  scripts/fc26-dump-base.lua
        ▼
   dataset_fc26/base/*.csv          ← hằng số phiên bản, an toàn để nướng
        │  npm run build:fc26
        ▼
   public/fc26/*.json               ← asset trình duyệt tải
        │  lib/fc26/*
        ▼
   một file save bất kỳ  →  trang đầy đủ
```

### Tầng 1 — `scripts/fc26-dump-base.lua`

Ra `dataset_fc26/base/<tên bảng>.csv`, giữ nguyên mọi cột:

| bảng | dòng | dùng cho |
| --- | --- | --- |
| `playernames` | 41.190 | tên, id 0–41.189 |
| `dcplayernames` | 5.624 | tên, id 44.000+ |
| `players` | 21.437 | tập id roster gốc, vị trí sở trường |
| `teamplayerlinks` | 23.809 | số áo, CLB |
| `teams` | 818 | tên CLB |
| `leagues` | 48 | tên giải |
| `leagueteamlinks` | 818 | CLB thuộc giải nào |
| `nations` | 218 | tên quốc gia |
| `formations` | 871 | hình học sân |
| `default_teamsheets` | 818 | sơ đồ nào thực sự có đội dùng |
| `teamkits` | 4.144 | màu áo (để dành) |

> **Sửa sau khi lập kế hoạch:** bản đầu của spec liệt kê mười bảng và thiếu
> `default_teamsheets`. Phát hiện khi đọc `build-fc26-formations.ts`:
> `formations.json` chỉ nhỏ được 5KB nhờ **lọc** 871 sơ đồ xuống vài chục sơ đồ
> thật sự có đội dùng, và thứ cho biết điều đó là bảng team sheet mặc định.
> Thiếu nó thì file phình lại khoảng 130KB.

Cả mười một bảng đều là **hằng số phiên bản**, tức giống nhau ở mọi career của cùng
một bản game. Tiêu chí phân biệt đã dùng từ trước: bảng có tiền tố `career_`
hoặc `cm_` là trạng thái của một career cụ thể và không bao giờ được nướng vào
asset dùng chung. Trong 248 bảng của bản dump đầy đủ có 48 bảng thuộc nhóm đó;
không bảng nào trong danh sách trên nằm trong nhóm đó, kể cả `dcplayernames` —
tên thêm qua bản cập nhật đội hình là dữ liệu toàn cục, không theo người chơi.

**Cổng tiền kiểm đảo chiều.** `scripts/fc26-dump-career.lua` hiện có dừng khi
bảng `career_*` **rỗng**. Script mới dừng khi chúng **không rỗng**, và dừng
trước khi mở bất kỳ file nào để không ghi đè bản dump tốt. Cùng cơ chế, ngược
nghĩa.

Đây không phải quy ước mà là tính chất cấu trúc: chạy ngoài career mode thì
bảng career rỗng, nên dữ liệu của một người chơi không có đường lọt vào asset
mà mọi người dùng chung.

**Không** dùng API con trỏ (`LE.db:GetTable`) — nó là đường gây crash native mà
`pcall` không bắt được. Chỉ dùng `GetDBTablesNames`, `GetDBTableFields`,
`GetDBTableRows` như script career hiện có.

### Tầng 2 — `scripts/build-fc26-assets.ts`

Một lệnh `npm run build:fc26` đọc `dataset_fc26/base/` và sinh toàn bộ
`public/fc26/`:

| ra | cỡ | nội dung |
| --- | --- | --- |
| `names.json` | ~750KB | kho ghép 46.814 tên, `nameid → chữ` |
| `world.json` | ~300KB | CLB, giải, số áo, tên quốc gia, tập id gốc, danh sách UT |
| `formations.json` | 5KB | hình học sân, không đổi |
| ~~`players.json`~~ | −1,9MB | xoá |
| ~~`squads.json`~~ | −245KB | xoá, nội dung chuyển vào `world.json` |

Tổng tải về của trang giảm từ khoảng 2,8MB xuống khoảng 1MB.

`world.json` gộp `squads.json` hiện có với phần còn lại của `players.json`. Cấu
trúc:

```
names        : { mã đội: tên }
squads       : { mã đội: [playerId, số áo, …] }     ← mảng phẳng
leagueOfTeam : { mã đội: mã giải }                  ← CHỈ giải trong nước
leagueNames  : { mã giải: tên }
nationNames  : { mã quốc gia: tên }
shippedIds   : 21.437 id roster gốc, mã hoá delta
utIds        : 3.944 id Ultimate Team, mã hoá delta
```

Mảng phẳng `[playerId, số áo, …]` thay cho mảng đối tượng: tránh lặp tên khoá
23.000 lần, và đó là hình dạng `squads.json` đang dùng nên phía đọc không đổi.

`leagueOfTeam` chỉ chứa giải **trong nước** (`isinternationalleague = 0`), nên
có mặt trong đó chính là dấu hiệu "đây là CLB, không phải đội tuyển quốc gia".
`teamplayerlinks` nối cầu thủ với cả hai, và dataset công khai trước đây không
có cách nào phân biệt — nên tra "CLB của người này" đôi khi ra "Brazil" thay vì
"Real Madrid".

`utIds` bê nguyên từ `players.json` hiện tại một lần rồi thôi. Đó là thứ duy
nhất còn lại từ dataset công khai, vì bảng gốc không phân biệt được nội dung
ngoài Career. Ghi rõ nguồn gốc trong chú thích để lần sau không ai tưởng nó suy
ra được từ bảng game.

Các script build cũ (`build-fc26-db.ts`, `build-fc26-names.ts`,
`build-fc26-namepool.ts`, `build-fc26-squads.ts`, `build-fc26-formations.ts`)
gộp vào một script. Lý do gộp chứ không giữ rời: chúng chỉ tồn tại rời vì được
viết ở những thời điểm khác nhau, và việc phải nhớ chạy đúng thứ tự năm lệnh
với đúng đối số là nguyên nhân của chính sự lộn xộn đang phải sửa.

### Tầng 3 — đường đọc trong app

`lib/fc26/db.ts` xoá. Thay bằng `lib/fc26/world.ts`, phơi ra:

```
clubOf(playerId)      → { name, league } | null
jerseyOf(playerId)    → số | null
nation(nationalityId) → tên | null
isShipped(playerId)   → có trong roster gốc không  (dùng cho tab cầu thủ trẻ)
isUltimateTeam(id)    → nội dung ngoài Career
```

**Chuỗi tra tên rút từ 4 bậc xuống 3:**

1. tên do career sinh ra, đọc thẳng chuỗi trong save
2. `nameId` → kho tên (`commonNameId`, nếu không thì `firstNameId` + `lastNameId`)
3. `#playerId`

Bậc `players.json` tra theo `playerId` biến mất. Bậc 2 vốn xếp sau nó vì bản ghi
ở đó là chuỗi nguyên văn game trả về; giờ kho tên cũng là bảng gốc của game, nên
lý do xếp sau không còn.

`collapseDoubledName` **giữ lại**, nhưng viết lại chú thích. Tật tên lặp đến từ
quy ước của chính game — cầu thủ một tên có `firstnameid == lastnameid`, ví dụ
`#81379` là `first=40399 last=40399` ra "Zothanpuia Zothanpuia". Nó là chuẩn
hoá vĩnh viễn, không phải bản vá cho một dataset cụ thể.

Sửa trong `components/save/SaveReaderClient.tsx`:

| cũ | mới |
| --- | --- |
| `loadFc26Database()` | `loadFc26World()` |
| `db.ids()` | `world.shippedIds` |
| `db.nation(id)` | `world.nation(id)` |
| `db.isUltimateTeam(id)` | `world.isUltimateTeam(id)` |
| `db.get(id)` → tên | bỏ; tên luôn từ kho |
| `entry.club` / `entry.league` | `world.clubOf(id)` |

## Kiểm chứng

`scripts/check-fc26-assets.ts` chạy trên **cả bốn** save và khẳng định:

1. **Tên đạt 100%** trên từng save, trừ bản ghi mang dấu `65535` (không có tên).
2. **Không rò career** — không id nào trong asset đến từ bảng có tiền tố
   `career_` hoặc `cm_`. Kiểm bằng cách đối chiếu mọi id trong asset với danh
   sách 10 bảng đã dump.
3. **Số áo và CLB phủ đúng** đội người dùng đang cầm, ở mức không thấp hơn bản
   hiện tại.
4. **Không mất người** — số cầu thủ hiển thị sau khi lọc UT bằng đúng con số
   hiện tại (19.336 và 19.405 trên hai save mới).

Các script đo đã viết khi khảo sát giữ lại làm bằng chứng và để chạy lại về
sau: `diag-coverage.ts`, `diag-pool-only.ts`, `diag-pool-gap.ts`,
`diag-pool-merged.ts`, `diag-ut-flag.ts`.

## Ngoài phạm vi

- **Lương** — chỉ nằm trong bảng 45 dòng của riêng đội người dùng cầm, quá nhỏ
  để định vị trong file 15MB. Đã đóng, không mở lại trong lần này.
- **Đội hình xuất phát đã xếp** — đã dò sáu hướng, mức khớp cao nhất đúng bằng
  mức ngẫu nhiên. Trang tiếp tục dựng đội hình gợi ý từ vị trí sở trường và chỉ
  số, ghi rõ là gợi ý.
- **Màu áo từ `teamkits`** — bảng có chụp nhưng chưa dùng. Chụp rộng chính là để
  lần sau muốn dùng thì không phải mở game.
- **Bốn bảng lưới mặt và xương** — không chụp. 68MB không phục vụ gì.

## Rủi ro

| rủi ro | xử lý |
| --- | --- |
| Bản cập nhật đội hình của EA thêm tên mới ngoài dải 44.000+ | Cổng kiểm báo tỉ lệ phủ trên từng save; tụt dưới 100% là dấu hiệu cần chụp lại. Chụp lại là một lệnh, không phải một cuộc điều tra. |
| 11,5MB CSV trong repo | Chấp nhận có chủ đích, là giá của việc không phải chạy lại Lua. Con số một lần. |
| `utIds` không tái tạo được từ bảng gốc | Ghi rõ trong chú thích rằng đây là di sản từ dataset công khai và không suy ra được. Nếu FC 27 đổi, phải tìm nguồn khác. |
| Gộp năm script build thành một làm mất lịch sử lý do | Chuyển nguyên các khối chú thích giải thích "vì sao" sang script mới, không viết lại từ đầu. |

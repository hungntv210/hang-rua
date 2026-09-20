# Save Reader gọn lại: nhớ file, ba tab, Scout

Ngày 20-09-2026.

## Muốn gì

Trang Save Reader hiện bắt người dùng tải lại file save mỗi lần vào, và dành
gần một màn hình đầu cho phần mô tả chức năng. Bên dưới là bảy tab, bốn trong
số đó là công cụ chẩn đoán định dạng — hữu ích khi còn đang giải mã, vô nghĩa
với người chỉ muốn xem đội bóng của mình.

Sau thay đổi này, vào trang là thấy ngay đội bóng của lần trước, và chỉ còn ba
tab trả lời ba câu hỏi thật:

- **Đội hình** — đội tôi đang thế nào?
- **Cầu thủ trẻ** — học viện của tôi có ai đáng giữ?
- **Scout cầu thủ** — ngoài kia có ai đáng mua?

Thành công đo được: tải một save, đóng tab, mở lại trang — thấy đúng đội bóng
đó mà không phải làm gì.

## Không làm trong lần này

**Cột CLB vẫn là "CLB gốc".** Người dùng muốn nó là CLB *hiện tại*, và điều đó
đúng đắn: đo trên save thật, 14 trong 23 cầu thủ của đội người chơi đã KHÔNG
còn ở câu lạc bộ mà roster xuất xưởng ghi. Cột hiện tại sai 61%.

Nhưng đó là một bài giải mã, không phải sửa giao diện. Đã dò bốn hướng:

| Hướng | Kết quả |
| --- | --- |
| Khối `[count][playerId…]` cho từng CLB | chỉ 3 khối trong cả file, phủ 37 người |
| teamId đóng gói bit trong bản ghi 144 byte | 8,8% (phép thử dương tính đạt 100%) |
| Bảng liên kết rời | **có thật**: 4.321 chỗ playerId kề đúng teamId ở `+4`, dồn trong 8,6–9,2MB |
| Bắt cặp thô (playerId hợp lệ, teamId có tên) | ra rác — 12/23 cầu thủ thành "Arsenal" |

Dữ liệu chắc chắn nằm trong save. Thứ còn thiếu là phân tích đúng khung bản
ghi: chúng nằm trong luồng tuần tự hoá `01 01` có độ dài thay đổi (14 và 18
byte), nên phép bắt cặp thô nhận nhầm mọi số nhỏ như `1`, `3`, `5` là teamId.

Việc đó có spec riêng, với cổng nghiệm thu riêng: **23/23 cầu thủ của đội người
chơi phải ra đúng một câu lạc bộ**. Không đạt thì không ship — một ô sai mà
trông như đúng thì tệ hơn ô trống.

Tách ra vì phần dưới đây không có ẩn số nào, còn phần kia thì có.

## 1. Nhớ file save

### Lưu byte thô, đọc lại mỗi lần vào

Lưu chính nội dung file vào IndexedDB. Vào lại trang thì đọc nó bằng worker như
một lần tải bình thường, mất khoảng một giây.

Đã cân nhắc lưu *kết quả đã phân tích* để khỏi đọc lại. Bác bỏ: kết quả đó sẽ
đóng băng theo phiên bản parser lúc lưu, và dự án này đã dính đúng cái bẫy ảnh
chụp nướng sẵn hai lần — bảng team sheet trong `formations.json` phát lại trạng
thái cũ khi người dùng xếp lại đội hình, và seed nhiễm 55 cầu thủ học viện từ
một bản dump ngoài career. Một giây là giá rẻ để không gặp lại chuyện đó.

Đã cân nhắc File System Access API (giữ "tay cầm" file gốc). Bác bỏ: Firefox và
Safari không có, và vẫn phải đọc lại file.

### Chỉ giữ một file

File mới ghi đè file cũ. Người dùng đã chọn phương án này thay vì danh sách
nhiều save.

### Phải nói ra là đang giữ file

Trang quảng cáo "không byte nào được gửi lên server" — điều đó vẫn đúng,
IndexedDB nằm trên máy người dùng. Nhưng *giữ lại* file là thay đổi mà người
dùng phải thấy, không được im lặng làm.

Nên có một dòng trạng thái: tên file, dung lượng, thời điểm lưu, và **nút Xoá**.
Bấm Xoá thì trang về ô thả file.

### Hỏng thì bỏ qua, không chặn

Chế độ ẩn danh, hết dung lượng, hoặc trình duyệt chặn — mọi thao tác IndexedDB
đều bọc trong `try/catch`. Lưu hỏng thì trang vẫn chạy đúng như hôm nay, chỉ là
lần sau không nhớ. Đọc hỏng thì hiện ô thả file. Không bao giờ ném lỗi ra ngoài.

### Giao diện

`lib/save/store.ts`, ba hàm, không có lớp nào:

```ts
interface SavedFile { bytes: ArrayBuffer; fileName: string; savedAt: number }

putSave(bytes: ArrayBuffer, fileName: string): Promise<void>
getSave(): Promise<SavedFile | null>
clearSave(): Promise<void>
```

Tầng này không biết gì về career hay cầu thủ — nó chỉ giữ byte.

## 2. Trang gọn lại

`app/save-reader/page.tsx`: bỏ toàn bộ khối mô tả, còn một dòng —
*"Đọc file save Career Mode của FC 26 ngay trên máy bạn."*

Bỏ bốn thẻ thống kê lớn và khối Ghi chú. Thay bằng **một dòng mảnh** dưới thanh
tab: *"19.349 cầu thủ · đọc trong 995ms"*. Giữ lại vì đó là phản hồi tốc độ
thật, và vì nó cho biết trang đọc được bao nhiêu người.

## 3. Ba tab

### Đội hình — giữ nguyên

Sơ đồ thật đọc từ save, cách xếp người là gợi ý. Không đổi gì.

Người dùng có hỏi liệu có đọc được **cầu thủ xuất phát** không. Không. Đã dò
thêm hai hướng nữa trong lần này:

- vùng ±8KB quanh khối team sheet: **0** playerId nào của đội xuất hiện
- 12 cụm id của đội trong cả file: **cụm nào cũng là cả 23 người**, không cụm nào 11
- 4 byte đi kèm trong bảng bước 8: chia 18/4/1 và 6/5/5/3 — không chỗ nào chia 11/12

Cộng với kết quả dò bit trước đó (không có trường ô đá trong bản ghi cầu thủ,
phép thử dương tính đạt 100%). Save biết *ai trong đội* và *sơ đồ gì*, nhưng
không nối hai thứ đó lại. Nhãn hiện tại — "sơ đồ thật · xếp người là gợi ý" —
là đúng và giữ nguyên.

### Cầu thủ trẻ — giữ nguyên

Đã đọc đúng bảng học viện của riêng đội người chơi từ save.

### Scout cầu thủ

Chính là tab "Cầu thủ" hiện tại (`PlayerTable`), bỏ đi những người đã ở trong
đội người dùng, và thêm bộ lọc.

Bộ lọc — bốn cái đầu đã có, ba cái sau là mới:

| Lọc | Trạng thái |
| --- | --- |
| tên | đã có |
| sắp xếp | đã có |
| chỉ cầu thủ career sinh ra | đã có |
| tuổi tối đa | đã có, **mở rộng thành khoảng từ–đến** |
| vị trí (chọn nhiều) | mới |
| tiềm năng tối thiểu | mới |
| chỉ số tối thiểu | mới |
| còn tăng tối thiểu (TN − CS) | mới |

Cột CLB giữ nguyên nhãn "CLB gốc" và giữ nguyên cảnh báo hiện có, cho tới khi
spec phần hai xong.

## 4. Xoá

Bốn tab chẩn đoán và năm component chỉ phục vụ chúng:

- `components/save/SaveFieldTable.tsx`
- `components/save/SaveNameList.tsx`
- `components/save/SaveStringList.tsx`
- `components/save/SaveUnknownList.tsx`
- `components/save/SaveStats.tsx`

Cả ba nút xuất — "Cầu thủ (CSV)", "Cầu thủ (JSON)", "Chẩn đoán (JSON)" — bỏ
hết. Bộ lọc trong tab Scout thay được việc xuất ra Excel lọc tay, và "Chẩn đoán
(JSON)" chỉ có nghĩa khi còn các tab chẩn đoán.

Parser không đụng tới. Nó vẫn đọc field, chuỗi và vùng chưa giải mã như cũ —
chỉ là giao diện thôi hiển thị. Cắt phần đó khỏi parser là việc khác, và chưa
có lý do nào bắt phải làm bây giờ.

## 5. Chỗ dễ sai và cách chặn

### Bộ lọc Scout tách thành hàm thuần

`lib/fc26/scout.ts` → `filterPlayers(players, criteria)`. Lọc sai mà kết quả
vẫn trông hợp lý là loại lỗi không ai phát hiện bằng mắt — một bảng 200 cầu thủ
thiếu mất 30 người trông y hệt một bảng đúng.

Cổng kiểm `scripts/check-scout.ts`, chạy trên save thật, trong `check:fc26`:

- lọc chặt phải ra **tập con** của lọc lỏng: `{tuổi 16–21, TN≥80}` ⊂ `{TN≥80}`
- không lọc gì thì phải ra đúng `tổng số cầu thủ − quân số đội người chơi`
- **không ai trong đội người chơi lọt vào kết quả**, với mọi bộ lọc
- mọi người trong kết quả phải thoả mọi điều kiện đang bật

Điều kiện thứ ba là điều kiện chính: nó là lời hứa của cả tab.

### IndexedDB kiểm bằng tay

Không chạy được ngoài trình duyệt, nên không có cổng tự động. Kiểm tay và chụp
lại:

1. tải save → tải lại trang → phải tự mở lại đúng save đó
2. bấm Xoá → tải lại trang → phải về ô thả file
3. tải save khác → phải ghi đè, không cộng dồn

## 6. File đụng tới

Thêm:

- `lib/save/store.ts`
- `lib/fc26/scout.ts`
- `scripts/check-scout.ts`

Sửa:

- `app/save-reader/page.tsx` — cắt mô tả
- `components/save/SaveReaderClient.tsx` — ba tab, khôi phục lúc mở, dòng trạng thái file
- `components/save/PlayerTable.tsx` — thêm bộ lọc, nhận `excludeIds`
- `scripts/check-fc26-all.ts` — thêm cổng Scout

Xoá: năm component ở mục 4.

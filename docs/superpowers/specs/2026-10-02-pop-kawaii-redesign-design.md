# Thiết kế lại Hang Rùa: pop-art kawaii xanh dương

Ngày: 2026-10-02 · Branch: `redesign/pop-kawaii`

## Mục tiêu
Thay toàn bộ giao diện (kể cả Save Reader) bằng phong cách pop-art kawaii Nhật, có bản sắc riêng, không trông "do AI làm". **Chỉ đổi giao diện; không đổi logic.** Cảm hứng bố cục từ kitan.jp (menu khối màu, slider, thẻ pastel); không dùng hình, nhân vật hay nội dung của họ.

## Quyết định đã được người dùng chốt
1. **Logo và mascot: giữ nguyên** `public/brand/logo.webp` và `kame-mascot.webp` của site hiện tại, chưa thay. Chỉ đổi màu toàn site theo bảng xanh lấy từ logo huy hiệu mới vẽ. (Logo "Squirtle Squad" gửi làm tham khảo là nhân vật của Nintendo/The Pokémon Company nên không dùng.)
2. Menu và trang chỉ trên những gì có sẵn (12 route hiện có), không thêm trang mới.
3. Chỉ giao diện **sáng**, dựa trên các sắc xanh dương của logo mẫu. Bỏ hẳn nền tối/HUD/neon.

## Phạm vi
Route: `/`, `/football`, `/football/league/[slug]`, `/football/standings[/slug]`, `/football/bracket[/slug]`, `/save-reader`, `/save-reader/fc26`, `/save-reader/fc27`, `error`, `not-found`, 5 file `loading`.
**Không đụng:** `lib/**`, `scripts/**`, worker, parse, đối chiếu, dữ liệu. Component Save Reader chỉ sửa JSX/className, giữ nguyên hook, props, luồng state.
**Không thêm thư viện.** `framer-motion` giữ nơi đang dùng; ưu tiên CSS.

## Design system
Màu lấy mẫu từ logo tham chiếu (nền `#36538B`, mặt `#A6D4E3`, miệng `#E89796`, chữ `#F6FBFE`). Hạn chế 6 màu chủ đạo:

| Token | Hex | Vai trò | Chữ trên nó (tương phản đã tính) |
|---|---|---|---|
| `ink` | `#0A1428` | chữ, viền, bóng cứng | — |
| `navy` | `#36538B` | khối menu, nhấn đậm | ice 7.28 |
| `royal` | `#2563C9` | khối menu, nút chính | ice 5.44 |
| `aqua` | `#4FC3D9` | khối menu, nhấn tươi | ink 8.87 |
| `sky` | `#A6D4E3` | khối menu, thẻ pastel | ink 11.50 |
| `salmon` | `#E89796` | **màu nhấn duy nhất ấm**: NEW, sticker, khối menu Save Reader | ink 8.13 |
| `ice` | `#F6FBFE` | nền giấy, chữ trên nền đậm | — |

Pastel của thẻ = bản nhạt của chính các màu trên (`sky-100 #DCEFF6`, aqua-100, salmon-100, royal-100), không thêm hue mới. Cặp chữ/nền dưới 4.5 bị cấm; mọi cặp sẽ được kiểm lại bằng script khi dựng token.

Khác: viền `2–3px ink`; bóng cứng lệch `4px 4px 0 ink` (không blur); bo góc có chủ đích 2 cỡ (nhỏ cho bảng, lớn cho thẻ/sticker); chấm bi halftone bằng `radial-gradient` CSS; xoay sticker 1–3°.

Font: **Baloo 2** (subset vietnamese) cho tiêu đề/nút/menu; **Be Vietnam Pro** giữ cho số liệu và bảng dày. Bỏ Chakra Petch, Charmonman, JetBrains Mono. Kiểm thực tế dấu ư ơ ặ ỡ trên trình duyệt trước khi chốt.

## Logo và mascot
Giữ ảnh hiện có. Việc cần làm trong giai đoạn 2: đặt ảnh vào khung phù hợp nền sáng (huy hiệu tròn viền ink, bóng cứng) và dùng lại chính mascot cho trạng thái loading/trống/lỗi bằng chuyển động và nhãn, chưa vẽ biến thể mới. Thay logo/mascot bằng SVG là việc sau, làm khi bạn quyết. Bản nháp trong `logo-rua/` (chưa commit) chỉ là tham khảo bảng màu.

## Component
Button (nhấn lún), Tab, Card (đầu pastel, thân trắng), Badge/Sticker, Table, Tooltip, Modal, Loading/Empty/Error. Viết lại `Notice`, `Skeletons`, `TabBar`, `TeamBadge`, `ModuleCard`. Xoá `Sidebar`, `HudFrame`, `BrushWordmark`, `Scute` khi không còn nơi dùng.

## Khung trang
Menu trên cùng 5 khối ngang bằng nhau: **Trang chủ** (navy) · **Lịch đấu** (royal) · **Xếp hạng** (aqua) · **Cúp** (sky) · **Save Reader** (salmon). Chữ đậm, căn giữa; mobile thu thành nút menu. Chuyển trang: cắt khối màu + nảy nhẹ 150–400ms, chỉ `transform`/`opacity`, tắt khi `prefers-reduced-motion`.

## Trang chủ
Banner slider lệch trục (3 slide: Save Reader, Football, mascot) có chấm điều hướng, bằng CSS scroll-snap + một hook nhỏ, bàn phím và nút tạm dừng. Lưới thẻ 2 cột mobile / 4–5 cột desktop, kích cỡ xen kẽ, nhãn NEW. Giọng văn tiếng Việt riêng, không khẩu hiệu chung chung.

## Save Reader
- Sân cỏ hoạt hình nhiều tông cỏ; cầu thủ là sticker/huy hiệu có số áo và tên, đúng formation team sheet.
- Hover/focus một vị trí: tooltip danh sách dự bị cùng vị trí; mặc định ẩn hoàn toàn, **gỡ khỏi DOM khi đóng** (có lỗi cũ do để lại phần tử `opacity:0`).
- Danh sách 4 nhóm GK/DF/MF/FW: avatar, OVR/POT badge màu, tuổi, hợp đồng, giá trị, lương. Khung Substitute dưới sơ đồ.
- Áp dụng cho cả FC26 và FC27, trang chọn phiên bản.

## Thứ tự và kiểm chứng
1. Token + font + `/_styleguide` (dev) → 2. component → 3. khung/menu/motion → 4. trang chủ → 5. Football → 6. Save Reader → 7. rà soát.
Sau **mỗi** giai đoạn: `npm run typecheck`, `npm run build`, `check:fc26`, `check:fc27` (logic phải xanh như trước), duyệt thật trong trình duyệt. Kiểm giao diện bằng ảnh **và** đo DOM: tooltip còn sót sau mở/đóng, chữ bị cắt (`scrollWidth > clientWidth`), ô chồng nhau, tràn ngang ở 375px, tab bằng bàn phím, tương phản.

## Gợi ý chức năng (chỉ đề xuất, chưa làm)
Xử lý save hoàn toàn trên trình duyệt kèm cam kết trên UI (dễ, cao) · Viên ngọc ẩn POT cao lương thấp (dễ–vừa, cao) · Lịch hợp đồng (vừa, cao) · Gacha khi upload (vừa, vui) · Thẻ sưu tập + xuất ảnh đội hình (vừa–khó, cao) · So sánh 2 cầu thủ (vừa) · So sánh 2 save theo mùa (khó, rủi ro) · Đội hình mùa sau, ước OVR theo tuổi (vừa, cao).

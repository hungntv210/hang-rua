# Thiết kế lại Hang Rùa (pop-art kawaii xanh dương) — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay toàn bộ giao diện 12 route (kể cả Save Reader FC26/FC27) bằng phong cách pop-art kawaii sáng, màu xanh dương, không đổi logic.

**Architecture:** Thêm token mới (Tailwind + CSS) **song song** token cũ để build luôn xanh giữa chừng; viết bộ primitive `components/ui/*`; chuyển từng nhóm trang sang token/primitive mới; task cuối xoá token cũ và có script chặn còn sót. Chỉ sửa JSX/className/CSS, không đụng `lib/fc26`, `lib/fc27`, `lib/save`, `scripts/build-*`, `scripts/check-fc*`.

**Tech Stack:** Next.js 14.2 (App Router), React 18, Tailwind 3.4, `framer-motion` (đã có, giữ chỗ đang dùng), `next/font/google`, `next/image`. **Không thêm dependency.**

**Spec:** `docs/superpowers/specs/2026-10-02-pop-kawaii-redesign-design.md`

## Global Constraints

- Chỉ giao diện **sáng**; bỏ nền tối, HUD, neon, kính mờ, quầng sáng, gradient.
- Bảng màu: `ink #0A1428`, `navy #36538B`, `royal #2563C9`, `aqua #4FC3D9`, `sky #A6D4E3`, `salmon #E89796` (màu ấm duy nhất), `ice #F6FBFE`. Pastel = bản nhạt của các màu đó. Ngoại lệ chức năng duy nhất: `win/warn/lose` chỉ cho thang chỉ số cầu thủ và vùng xếp hạng (người chơi đọc xanh-vàng-đỏ bằng phản xạ).
- Mọi cặp chữ/nền ≥ 4.5:1 (đã tính: ice/navy 7.28, ice/royal 5.44, ink/aqua 8.87, ink/sky 11.50, ink/salmon 8.13).
- Viền `2–3px ink`; bóng cứng lệch `4px 4px 0 ink`, không blur; sticker xoay 1–3°.
- Font: Baloo 2 (subset `vietnamese`) cho tiêu đề/nút/menu; Be Vietnam Pro cho số liệu và bảng. Bỏ Chakra Petch, Charmonman, JetBrains Mono.
- Chuyển động 150–400ms, chỉ `transform`/`opacity`; tôn trọng `prefers-reduced-motion`; **không đổi cây DOM theo `useReducedMotion()`** (gây hydration mismatch, đã từng xảy ra).
- Phía sau bảng số liệu luôn là mặt phẳng đặc: không `backdrop-filter`, không họa tiết.
- Logo/mascot giữ nguyên `public/brand/logo.webp` và `kame-mascot.webp`. Ảnh dùng `next/image`.
- Menu 5 khối: Trang chủ (navy) · Lịch đấu (royal) · Xếp hạng (aqua) · Cúp (sky) · Save Reader (salmon). Mobile thu thành nút menu.
- Không chạy `next build` khi dev server đang chạy cùng thư mục (ghi đè `.next`, trang dev báo 404 tài nguyên).
- Mọi `m.*` dùng `m`, không dùng `motion` (LazyMotion strict).
- Commit message kết thúc bằng `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Tên cầu thủ** dài, `null` (hiện `#id`), chữ có dấu trong sticker/bảng: không cắt chữ, không tràn ở 375px (Task 8, 9).
2. **Tooltip dự bị**: ô không có dự bị cùng vị trí thì không hiện bảng rỗng; Esc và blur đóng; sau mở/đóng cả 11 ô DOM còn đúng 0 tooltip (Task 8).
3. **Bảng ~21.000 dòng**: nền đặc, header dính đúng mốc sau khi bỏ thanh `FootballNav`/sidebar (`--header-h`) (Task 3, 6, 10).
4. **`prefers-reduced-motion`**: slider không tự chạy, chuyển trang không nảy, không mismatch hydrate (Task 3, 4).
5. **Dữ liệu football lỗi / thiếu token / slug sai**: trang vẫn dựng, `ErrorNotice` và 404 hiện mascot, không sập (Task 2, 6).

---

### Task 0: Mốc chuẩn trước khi sửa

**Files:** Create `docs/superpowers/plans/2026-10-02-redesign-baseline.txt`

- [ ] **Step 1:** Dừng dev server nếu đang chạy. Chạy `npm run typecheck`, `npm run build`, `npm run check:fc26`, `npm run check:fc27`.
- [ ] **Step 2:** Ghi vào file baseline: lệnh nào pass/fail, số dòng tổng kết của hai script check, và cột *First Load JS* của `/`, `/football`, `/save-reader/fc26`, `/save-reader/fc27`. Nếu lệnh nào đã fail sẵn, ghi rõ — không sửa trong kế hoạch này.
- [ ] **Step 3:** Commit `docs: mốc chuẩn trước redesign`.

Chuẩn so sánh cho mọi task sau: 4 lệnh trên phải ra kết quả giống baseline, First Load JS không tăng quá +15 kB mỗi route.

---

### Task 1: Token, font, script kiểm tương phản

**Files:**
- Modify: `tailwind.config.ts` (thêm màu mới, KHÔNG xoá màu cũ), `app/layout.tsx`, `app/globals.css`, `package.json`
- Create: `scripts/check-design.ts`

**Interfaces — Produces:**
- Tailwind colors: `ink` (`DEFAULT #0A1428`, `soft #3A4A6B`, `mute #51607F`), `navy #36538B`, `royal` (`DEFAULT #2563C9`, `100 #DCE6F8`), `aqua` (`DEFAULT #4FC3D9`, `100 #D3F1F7`), `sky` (`DEFAULT #A6D4E3`, `100 #DCEFF6`), `salmon` (`DEFAULT #E89796`, `100 #FBE3E2`), `ice #F6FBFE`, `win` (`DEFAULT #17794B`, `wash #D9F2E4`), `warn` (`DEFAULT #8A5B00`, `wash #FBEBC4`), `lose` (`DEFAULT #B4361E`, `wash #FADBD3`).
- `boxShadow`: `pop` = `4px 4px 0 #0A1428`, `pop-sm` = `2px 2px 0 #0A1428`, `pop-press` = `0 0 0 #0A1428`.
- `fontFamily.display` → `var(--font-baloo)`; `fontFamily.sans` giữ `var(--font-body)`.
- Export `TOKEN_PAIRS: Array<{fg: string; bg: string; label: string}>` trong `scripts/check-design.ts`.

- [ ] **Step 1: Viết script thất bại trước.** `scripts/check-design.ts` đọc `tailwind.config.ts` (import mặc định), tính tỉ lệ tương phản WCAG cho `TOKEN_PAIRS` (ít nhất: ice/navy, ice/royal, ink/aqua, ink/sky, ink/salmon, ink/ice, ink.soft/ice, ink.mute/ice, ink.mute/sky.100, win/win.wash, warn/warn.wash, lose/lose.wash, win/ice, warn/ice, lose/ice), in từng cặp, `process.exit(1)` nếu cặp nào < 4.5. Thêm `"check:design": "npx tsx scripts/check-design.ts"` vào `package.json`.
- [ ] **Step 2:** Chạy `npm run check:design`. Expected: FAIL (màu chưa có trong config).
- [ ] **Step 3:** Thêm màu, shadow, font vào `tailwind.config.ts`; trong `layout.tsx` thêm `Baloo_2({ subsets: ["latin","vietnamese"], weight: ["600","800"], variable: "--font-baloo", display: "swap" })` bên cạnh các font cũ; trong `globals.css` đổi `color-scheme: light` và `body` thành `bg-ice text-ink` (giữ nền lưới cũ KHÔNG còn: xoá `background-image` lưới).
- [ ] **Step 4:** `npm run check:design` → PASS (mọi cặp ≥ 4.5). `npm run typecheck && npm run build`.
- [ ] **Step 5: Kiểm font thật.** Chạy dev server, mở trang bất kỳ, `javascript_tool`: đo bề rộng chuỗi `"ưởỡặầỉ"` ở `font-family: var(--font-baloo)` so với fallback `sans-serif`; hai số phải khác nhau (font có glyph Việt, không rơi về fallback). Chụp một ảnh dòng chữ để xem dấu.
- [ ] **Step 6:** Commit `design: token màu, shadow, font Baloo 2, script kiểm tương phản`.

---

### Task 2: Primitive và trạng thái

**Files:**
- Create: `components/ui/Button.tsx`, `Badge.tsx`, `Card.tsx`, `Tooltip.tsx`, `MascotState.tsx`, `Sticker.tsx`
- Modify: `app/globals.css` (thêm lớp `.pop-*` dưới mục "POP"), `components/Notice.tsx`, `components/Skeletons.tsx`, `components/TabBar.tsx`, `components/TeamBadge.tsx`, `app/error.tsx`, `app/not-found.tsx`, các `loading.tsx`

**Interfaces — Produces:**
- `Button({ variant?: "royal"|"salmon"|"ghost"; as?: "button"|"a"; ...rest })`: viền 2px ink, `shadow-pop`, nhấn thì `translate(3px,3px)` + `shadow-pop-press`, 120ms.
- `Badge({ tone: "navy"|"royal"|"aqua"|"sky"|"salmon"|"win"|"warn"|"lose"; children })`.
- `Sticker({ tilt?: -3|-2|-1|1|2|3; tone; children })`: nhãn dán xoay, dùng cho NEW.
- `Card({ tone: "sky"|"aqua"|"royal"|"salmon"; title: string; href?: string; size?: "sm"|"lg"; children? })`: đầu pastel (`*.100`) + chấm bi halftone, thân trắng, tiêu đề đậm.
- `Tooltip({ id: string; open: boolean; children })`: **gỡ khỏi DOM khi `open=false`** (trả `null`), `role="tooltip"`; hiện bằng animation CSS 150ms, không `AnimatePresence`.
- `MascotState({ kind: "loading"|"empty"|"error"; title: string; children? })`: ảnh `public/brand/kame-mascot.webp` qua `next/image` trong khung tròn viền ink; `loading` = lắc nhẹ chậm, `error` = nghiêng 12°, `empty` = nhìn xuống; `role="status"` (loading/empty) hoặc `role="alert"` (error).
- `TabBar`, `Notice`, `ErrorNotice`, skeleton giữ **nguyên props và export** hiện có.
- **Không làm `Modal`:** spec liệt kê nhưng site hiện không có chỗ nào dùng modal (YAGNI); thêm khi có nhu cầu thật.

- [ ] **Step 1:** Trang dev-only `app/_styleguide/page.tsx` (404 khi `process.env.NODE_ENV === "production"`) liệt kê mọi primitive ở mọi biến thể và 3 `MascotState`.
- [ ] **Step 2:** Cài đặt các primitive theo Interfaces; viết lại `Notice` (error → `MascotState kind="error"` bên trong), `Skeletons` (khối `sky.100` + vệt quét `transform` chậm, bỏ gradient/`electric`), `TabBar` (tab = viền 2px, active = nền `royal` chữ ice; giữ `layoutId` indicator và `springFor`), `TeamBadge`.
- [ ] **Step 3:** `error.tsx` dùng `MascotState error` + `Button`; `not-found.tsx` dùng `MascotState empty`; các `loading.tsx` dùng `MascotState loading` cộng skeleton hiện có.
- [ ] **Step 4:** `npm run typecheck && npm run build`. Mở `/_styleguide` ở 1280px và 375px: chụp ảnh; chạy `scripts/dom-audit.js` (tạo ở Task 4 — nếu chưa có, bỏ qua bước này và chạy lại ở Task 4).
- [ ] **Step 5:** Commit `ui: primitive pop-art và trạng thái mascot`.

---

### Task 3: Khung trang và menu 5 khối

**Files:**
- Create: `lib/nav.ts`, `components/SiteMenu.tsx`, `scripts/check-ui-logic.ts`
- Modify: `app/layout.tsx`, `app/football/layout.tsx`, `app/globals.css` (biến sticky), `package.json`, `components/StandingsTable.tsx:55`
- Delete (cuối task, sau khi grep không còn nơi dùng): `components/Sidebar.tsx`, `HudFrame.tsx`, `FootballNav.tsx`

**Interfaces — Produces:**
- `lib/nav.ts`: `export interface NavItem { id: string; label: string; href: string; tone: "navy"|"royal"|"aqua"|"sky"|"salmon" }`; `export const NAV_ITEMS: readonly NavItem[]` (5 mục đúng thứ tự trong Global Constraints; href: `/`, `/football`, `/football/standings`, `/football/bracket`, `/save-reader`); `export function isActive(pathname: string, item: NavItem): boolean`.
- `SiteMenu()` client component: 5 khối `grid-cols-5` ngang bằng nhau từ `md`, chữ đậm căn giữa, màu chữ theo bảng tương phản (ice trên navy/royal, ink trên aqua/sky/salmon); dưới `md` là logo + nút "Menu" mở bảng xếp dọc, đóng bằng Esc/đổi route, khoá cuộn nền khi mở (giữ hành vi của `Sidebar` cũ).
- Biến CSS: `--header-h` = chiều cao `SiteMenu` (cố định, `h-14` desktop, `h-14` mobile); xoá `--topbar-h`/`--nav-h`.

- [ ] **Step 1: Test thất bại.** `scripts/check-ui-logic.ts` (thêm `"check:ui"` vào `package.json`): `isActive("/", home) === true`; `isActive("/football/standings/premier-league", home) === false`; `isActive("/football/league/premier-league", lich) === true`; `isActive("/football/standings", lich) === false`; `isActive("/football/bracket/champions-league", cup) === true`; `isActive("/save-reader/fc27", save) === true`; `isActive("/save-reader", home) === false`. Các `slug` lấy đúng từ `lib/config.ts`. Chạy `npm run check:ui` → FAIL.
- [ ] **Step 2:** Cài `lib/nav.ts` (so khớp `/` chính xác; `/football` khớp chính xác hoặc tiền tố `/football/league`; còn lại theo tiền tố) → PASS.
- [ ] **Step 3:** Cài `SiteMenu`; trong `layout.tsx` thay `Sidebar`/`HudFrame`/`lg:pl-64` bằng `<SiteMenu/>` sticky `top-0 z-30`; xoá thanh sticky trong `app/football/layout.tsx` (giữ khung `max-w-5xl`). Cập nhật `StandingsTable` `top-[var(--header-h)]`.
- [ ] **Step 4: Chuyển trang.** Viết lại `RouteTransition`: giữ `key={pathname}`, thay vệt quét bằng animation CSS "nảy" 220ms (`translateY(8px) scale(.99)` → 0, easing có overshoot nhẹ), tắt khi reduced-motion. Xoá `animate-sweep` và `shadow-glow` khỏi chỗ dùng.
- [ ] **Step 5:** `grep -rn "Sidebar\|HudFrame\|FootballNav" app components` rỗng → xoá 3 file. `npm run typecheck && npm run check:ui && npm run build`.
- [ ] **Step 6: Duyệt thật.** Dev server: đi qua cả 5 mục menu bằng bàn phím (Tab/Enter), kiểm `aria-current` đúng một mục; resize 375px kiểm nút Menu mở/đóng; bật `prefers-reduced-motion` (resize_window/emulate) kiểm không có chuyển động. Ảnh chụp 2 khổ.
- [ ] **Step 7:** Commit `shell: menu 5 khối màu, chuyển trang nảy`.

---

### Task 4: Trang chủ và banner slider

**Files:**
- Create: `lib/slider.ts`, `lib/home-cards.ts`, `components/HeroSlider.tsx`, `scripts/dom-audit.js`
- Modify: `app/page.tsx`, `scripts/check-ui-logic.ts`
- Delete: `lib/modules.ts`, `components/ModuleCard.tsx`, `components/ModuleIcon.tsx`, `components/BrushWordmark.tsx`, `components/Scute.tsx` (sau grep)

**Interfaces — Produces:**
- `lib/slider.ts`: `export function stepIndex(current: number, length: number, dir: 1 | -1): number` (vòng tròn; `length <= 0` trả 0).
- `lib/home-cards.ts`: `export interface HomeCard { id: string; title: string; blurb: string; href?: string; tone: "sky"|"aqua"|"royal"|"salmon"; size: "sm"|"lg"; isNew?: boolean }`; `export const HOME_CARDS: readonly HomeCard[]` — 7 thẻ: Lịch Arsenal, Lịch theo giải, Bảng xếp hạng, Sơ đồ cúp, Save Reader FC27 (`isNew`), Save Reader FC26, "Sắp có" (không `href`). Tone xen kẽ sky/aqua/royal/salmon; `size: "lg"` cho Save Reader FC27 và Lịch Arsenal.
- `HeroSlider({ slides: ReadonlyArray<{ id: string; kicker: string; title: string; body: string; href: string; cta: string; tone: "navy"|"royal"|"aqua" }> })`: track CSS scroll-snap, chấm điều hướng là `<button aria-label="Slide n">`, tự chạy 6s, **dừng** khi hover/focus, khi reduced-motion (đọc `matchMedia` trong effect, không đổi cây DOM), và có nút Tạm dừng; ←/→ đổi slide.
- `scripts/dom-audit.js`: IIFE trả `{ overflowX: number, clipped: string[], overlaps: string[][], tooltips: number }` — `overflowX = documentElement.scrollWidth - clientWidth`; `clipped` = phần tử `[data-audit-label]` có `scrollWidth > clientWidth`; `overlaps` = cặp `[data-audit-box]` có `getBoundingClientRect` giao nhau; `tooltips = document.querySelectorAll('[role=tooltip]').length`.

- [ ] **Step 1: Test thất bại.** Thêm vào `check-ui-logic.ts`: `stepIndex(0,3,-1)===2`, `stepIndex(2,3,1)===0`, `stepIndex(1,3,1)===2`, `stepIndex(0,0,1)===0`; mọi `HOME_CARDS[].href` (nếu có) bắt đầu bằng `/` và không trùng; không có hai thẻ liền kề cùng tone. `npm run check:ui` → FAIL.
- [ ] **Step 2:** Cài `lib/slider.ts`, `lib/home-cards.ts` → PASS.
- [ ] **Step 3:** Cài `HeroSlider` (3 slide: Save Reader "Thả file save vào, xem đội hình của bạn", Football "Lịch đá, bảng điểm, sơ đồ cúp — gom một chỗ", mascot "Rùa đi chậm, nhưng không bỏ trận nào"); banner lệch trục (nội dung dồn trái, mascot nghiêng 3° nhô ra phải, nền `navy`/`royal`/`aqua` + chấm bi halftone). Giọng văn có thể chỉnh nhưng không dùng khẩu hiệu chung chung.
- [ ] **Step 4:** Viết lại `app/page.tsx`: slider, lưới thẻ `grid-cols-2 lg:grid-cols-4` (thẻ `lg` chiếm `col-span-2`), sticker NEW xoay 2°, mascot ở cuối. Mascot dùng `next/image` với `sizes`.
- [ ] **Step 5:** Xoá file thừa sau `grep` không còn nơi dùng. `npm run typecheck && npm run check:ui && npm run build`.
- [ ] **Step 6: Duyệt thật.** Dev server: chờ 7 giây thấy slide tự chuyển; hover → dừng; Tab tới chấm và dùng ←/→; reduced-motion → không tự chạy. Chạy `dom-audit.js` ở 1280px và 375px: `overflowX===0`, `clipped` và `overlaps` rỗng. Gắn `data-audit-label`/`data-audit-box` vào tiêu đề thẻ và thẻ. Ảnh chụp 2 khổ. Kiểm số cột: 2 (375px) và 4 (1280px) bằng `getComputedStyle(...).gridTemplateColumns`.
- [ ] **Step 7:** Chạy lại bước 4 của Task 2 (`dom-audit.js` trên `/_styleguide`).
- [ ] **Step 8:** Commit `home: banner slider và lưới thẻ pastel`.

---

### Task 5: Chạy chốt giai đoạn 1–4

- [ ] **Step 1:** Dừng dev server. `npm run typecheck`, `npm run build`, `npm run check:design`, `npm run check:ui`, `npm run check:fc26`, `npm run check:fc27`. So với baseline (Task 0): kết quả check giống, First Load JS mỗi route không tăng quá +15 kB.
- [ ] **Step 2:** Nếu lệch, sửa trước khi sang Football. Ghi kết quả vào commit message `chore: chốt giai đoạn khung và trang chủ`.

---

### Task 6: Football (lịch, xếp hạng, cúp)

**Files (chỉ className/JSX):** `components/CompetitionTabs.tsx`, `ClubFilter.tsx`, `FixtureList.tsx`, `FixtureRow.tsx`, `LeagueFixturesBrowser.tsx`, `RoundAccordion.tsx`, `StandingsTable.tsx`, `Bracket.tsx`, `views/*.tsx`, `app/football/**/page.tsx`, `loading.tsx`

- [ ] **Step 1:** Chuyển từng component sang token/primitive mới. Xếp hạng: hàng xen kẽ `ice`/`white`, vùng xuống hạng dùng `lose.wash` + chữ `lose`, vùng cúp châu Âu dùng `aqua.100`, đang diễn ra dùng `salmon` (nghĩa cũ "đang diễn ra"/"xuống hạng" giữ tách sắc). Fixture "đang diễn ra" dùng `Sticker salmon` thay chấm nhấp nháy `pulse-live` (hoặc giữ `pulse-live` chỉ đổi opacity).
- [ ] **Step 2:** Bảng xếp hạng: `<thead>` nền đặc `sky`, dính tại `top-[var(--header-h)]`; không bóng, không họa tiết trong bảng.
- [ ] **Step 3:** Mỗi route kiểm: `/football`, `/football/league/<slug>`, `/football/standings`, `/football/standings/<slug>`, `/football/bracket`, `/football/bracket/<slug>`, slug sai (404 mascot). Nếu thiếu `FOOTBALL_DATA_TOKEN`, trang phải hiện `ErrorNotice` với mascot, không sập. Chạy `dom-audit.js` ở 375px và 1280px trên từng route; cuộn bảng xếp hạng kiểm header dính không bị menu che.
- [ ] **Step 4:** `npm run typecheck && npm run build`; commit `football: giao diện lịch, xếp hạng, cúp`.

---

### Task 7: Save Reader — trang chọn phiên bản và hai vùng nạp file

**Files:** `app/save-reader/page.tsx`, `components/save/SaveDropZone.tsx`, `components/save/CareerExportDrop.tsx`

- [ ] **Step 1:** Trang chọn: hai `Card` lớn (FC 26 `sky`, FC 27 `aqua` + `Sticker NEW`), câu cam kết "Chạy hoàn toàn trên máy bạn — không byte nào gửi lên server" thành một `Badge` nổi bật. Giữ nguyên `metadata`.
- [ ] **Step 2:** `SaveDropZone`/`CareerExportDrop`: vùng thả viền đứt 3px ink, nền `sky.100`, trạng thái kéo-vào (`aqua.100`), đang đọc dùng `MascotState loading`, lỗi dùng `error`. Giữ nguyên props `{ onFile, busy, progress, folder }` và `{ data, onLoad, gate, inUse }`, mọi handler, `input[type=file]`.
- [ ] **Step 3:** Kiểm nạp file thật trong trình duyệt: **sự kiện DOM giả lập không tới React** (đã gặp). Cách làm: chép file mẫu tạm vào `public/_tmp/`, `fetch` thành `File`, gọi `input[__reactProps$…].onChange({ target: { files: [file] } })`; trước đó xác nhận hydrate bằng `Object.keys(el).some(k => k.startsWith('__reactProps'))`; chờ bằng vòng lặp dừng theo văn bản mong đợi. **Xoá `public/_tmp/` sau khi kiểm.** Dùng `temp_fc26_upload/` cho FC26 và `temp_fc27_upload/` cho FC27.
- [ ] **Step 4:** FC27 từ chối save FC26 vẫn hiện hướng dẫn chuyển trình đọc (hành vi hiện có). `npm run typecheck && npm run build`; commit `save-reader: trang chọn và vùng nạp file`.

---

### Task 8: Sơ đồ sân (Pitch) và dùng chung

**Files:** `components/save/Pitch.tsx`, `components/save/squad-shared.tsx` (chỉ `StatBadge`, `PlayerAvatar` — **không đụng** `toneOf`, `initialsOf`, `shortName`, `surnameOf`, `contractLabel`, `displayName`)

**Interfaces — Consumes:** `Tooltip({ id, open, children })`, `Badge`, `Sticker` (Task 2). **Giữ nguyên:** `Pitch({ lineup, players, jerseyOf })`, state `open: number | null`, `alternativesFor(slotIndex)`.

- [ ] **Step 1: Đo trước (mốc).** Dev server + nạp save FC26 (Task 7 bước 3). Chạy `dom-audit.js` trên sơ đồ: ghi `overlaps`, `clipped`, `overflowX` hiện tại ở 375px và 1280px. Mở/đóng lần lượt cả 11 ô, mỗi lần ghi `tooltips` (kỳ vọng 1 khi mở, 0 khi đóng).
- [ ] **Step 2:** Mặt sân: nhiều tông cỏ sọc ngang (`win`-nhạt/`aqua.100`/xanh cỏ nhạt cố định trong `Pitch`), vạch sân trắng 3px, viền ink, hoạ tiết hoạt hình (vòng giữa sân, vài chấm bi); giữ **một SVG** cho vạch sân và tỉ lệ `aspect-[3/5] sm:aspect-[3/4]` (số đo cũ về khoảng cách thủ môn–trung vệ).
- [ ] **Step 3:** Ô cầu thủ = sticker tròn viền ink có số áo (nếu có `jerseyOf`) + tên (`shortName`) trong nhãn; xoay lệch 1–2° theo `slotIndex % 3`; OVR là `Badge`. Tên không cắt: nhãn co giãn theo nội dung với `max-w` và xuống dòng, không `truncate`.
- [ ] **Step 4:** Tooltip dự bị bằng `Tooltip`: hiện khi hover **và** focus bàn phím (ô là `button`), Esc đóng, `onBlur` đóng; `alternativesFor(slot).length === 0` thì không mở. Mặc định ẩn hoàn toàn (không có phần tử nào trong DOM).
- [ ] **Step 5: Đo sau.** Lặp bước 1: `tooltips` đúng 1 khi mở và 0 sau khi đóng cả 11 ô; `overlaps` và `clipped` rỗng, `overflowX === 0` ở 375px/1280px; thử một cầu thủ tên rất dài và một tên `null` (hiện `#id`). Ảnh chụp sân + tooltip.
- [ ] **Step 6:** `npm run typecheck && npm run check:fc26 && npm run build`; commit `save-reader: sân hoạt hình, sticker cầu thủ, tooltip dự bị`.

---

### Task 9: Save Reader FC26 — danh sách, khung dự bị, trình đọc

**Files:** `components/save/SaveReaderClient.tsx`, `SquadHub.tsx`, `SquadList.tsx`, `PlayerTable.tsx`, `YouthList.tsx`

- [ ] **Step 1:** `SquadList`: 4 nhóm GK/DF/MF/FW (tiêu đề nhóm là `Badge`), mỗi dòng: `PlayerAvatar`, tên, `StatBadge` OVR và POT (màu theo `StatTone`: high=`royal`, good=`win`, fair=`warn`, low=`lose` — cặp chữ/nền đã kiểm ở Task 1), tuổi, hợp đồng (`contractLabel`), giá trị, lương (`wageOf`). Khung **Substitute** ngay dưới sơ đồ trong `SquadHub`.
- [ ] **Step 2:** `PlayerTable`: nền đặc, header dính đặc, không họa tiết; cột số dùng Be Vietnam Pro `tabular-nums`. Giữ nguyên `SkippedGroups` và mọi props.
- [ ] **Step 3:** `SaveReaderClient`: tab bằng `TabBar` mới, thông báo bằng `Notice`/`MascotState`. **Không đổi** state, effect, worker, hay thứ tự gọi hook.
- [ ] **Step 4:** `git diff --stat` chỉ có className/JSX; `git diff -- lib scripts/check-fc26-all.ts` rỗng. Nạp save FC26 mẫu (Task 7 bước 3), đi qua mọi tab, `dom-audit.js` ở 375px/1280px; số cầu thủ hiển thị bằng số trong dòng "đã đọc N cầu thủ" như trước khi sửa (so với baseline).
- [ ] **Step 5:** `npm run typecheck && npm run check:fc26 && npm run build`; commit `save-reader: FC26 danh sách 4 nhóm và khung dự bị`.

---

### Task 10: Save Reader FC27

**Files:** `components/save27/Fc27Client.tsx`, `Fc27Table.tsx`, `SquadTab.tsx`, `YouthTab.tsx`, `LoansTab.tsx`, `ScoutTab.tsx`, `ResultBoundary.tsx`, `app/save-reader/fc27/page.tsx`, `app/save-reader/fc26/page.tsx`

- [ ] **Step 1:** Áp cùng ngôn ngữ như Task 9 cho các tab FC27; `ResultBoundary` lỗi dùng `MascotState error`; `POT_NOTE`/`AGE_NOTE`/`TableNotes` hiển thị rõ (không giấu xuống chân trang). `Fc27Table` giữ `maxHeight`, header dính đặc, nền đặc.
- [ ] **Step 2:** Nạp `temp_fc27_upload/CmMgrC20260926153118445` (cách ở Task 7 bước 3): đi qua 5 tab (đội hình, sơ đồ, trẻ, cho mượn, scout), `dom-audit.js` ở 375px/1280px; cầu thủ học viện hiện tên thật (không `?`) đúng như baseline.
- [ ] **Step 3:** `git diff -- lib` rỗng. `npm run typecheck && npm run check:fc27 && npm run build`; commit `save-reader: FC27 giao diện mới`.

---

### Task 11: Dọn token cũ và chặn tái phát

**Files:** Modify `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/**`, `components/**`, `scripts/check-design.ts`, `README.md`

- [ ] **Step 1: Test thất bại.** Thêm vào `check-design.ts` chế độ quét: `grep` các lớp/token cũ trong `app/` và `components/`: `bg-void`, `abyss`, `electric`, `orchid`, `sakura`, `crimson`, `ghost`, `mist`, `border-grid`, `\bglass`, `neon-edge`, `hud-corner`, `brand-jp`, `rule-ticks`, `brush-`, `font-mono`, `font-brush`, `font-jp`, `shadow-glow`, `animate-sweep`. Có khớp nào thì `exit(1)` và in file:dòng. `npm run check:design` → FAIL với danh sách còn sót.
- [ ] **Step 2:** Sửa từng chỗ còn sót sang token mới. Xoá màu cũ, `fontFamily.mono/brush/jp`, keyframes `sweep/draw-corner/flicker/brush-draw`, các lớp CSS cũ khỏi `tailwind.config.ts`/`globals.css`; xoá Chakra Petch, Charmonman, JetBrains Mono khỏi `layout.tsx`; đổi `metadata` bỏ "カメの巣穴" nếu còn.
- [ ] **Step 3:** `npm run check:design` → PASS (cả tương phản lẫn quét). Cập nhật `README.md` phần giao diện (token, `/_styleguide`, `check:design`, `check:ui`).
- [ ] **Step 4:** Chạy đủ: `typecheck`, `check:design`, `check:ui`, `check:fc26`, `check:fc27`, `build`; so với baseline (Task 0), First Load JS không tăng quá +15 kB mỗi route.
- [ ] **Step 5: Rà soát cuối.** Mỗi route trong 12 route: ảnh chụp 375px và 1280px; `dom-audit.js`; Tab xuyên menu và một trang; reduced-motion; kiểm tương phản bằng script. Ghi kết quả vào mô tả commit.
- [ ] **Step 6:** Commit `chore: gỡ token cũ, chặn tái phát bằng check:design`.

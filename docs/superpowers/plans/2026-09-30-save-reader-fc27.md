# Save Reader FC27 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang riêng `/save-reader/fc27` đọc save Career FC27 trong trình duyệt bằng cách đọc thẳng FIFA DB tự mô tả (đội hình thật, sơ đồ, cả đội, học viện, cho mượn, Scout).

**Architecture:** `lib/fc27` là chuỗi thuần hàm chạy được cả trong Node lẫn Web Worker: `container` (zstd) → `fifadb` (bộ đọc FIFA DB tổng quát) + `sections` (mục lục khối career, `msnl`) → `read` (ghép theo `schema`) → `Fc27Career` (object thuần). Tên cầu thủ ghép ở main thread (`names.ts` + asset `public/fc27/ref.json`). UI mới ở `components/save27`, dùng lại `components/save/Pitch.tsx` và `lib/fc26/scout.ts#filterPlayers`.

**Tech Stack:** Next.js 14 / React 18 / TypeScript 5.5, `fzstd` (mới), `npx tsx` cho script kiểm (dự án không có test framework).

**Spec:** `docs/superpowers/specs/2026-09-30-save-reader-fc27-design.md`

## Global Constraints

- Không byte nào của save gửi lên server; mọi thứ đọc trong trình duyệt (Web Worker).
- Đường FC26 KHÔNG đổi hành vi. Chỉ được: thêm tham số `key` có mặc định vào `lib/save/store.ts`, thêm một liên kết sang trang FC27.
- `lib/fc27` chỉ import từ ngoài: `fzstd`, `lib/fc26/positions.ts`, `lib/fc26/scout.ts`, `lib/fc26/names.ts` (Fc26Names), kiểu `SavePlayer` (`lib/save/types.ts`) và `Lineup`/`LineupSlot` (`lib/fc26/lineup.ts`).
- `fzstd` cài bằng `npm install --save-exact fzstd@0.1.1`.
- Mọi mã trường, hằng số cộng lấy từ spec §2 và chỉ nằm trong `lib/fc27/schema.ts`; không chép số đó sang file khác.
- POT: hiển thị đúng giá trị trong save (dynamic potential). Nhãn nguyên văn: `POT tại thời điểm lưu — dynamic potential, thay đổi theo phong độ`. Không hiệu chỉnh theo tuổi.
- Tuổi: mốc = `vTpl` (ngày gia nhập CLB) lớn nhất toàn bảng players; nhãn `tuổi ước tính, sai ±1`.
- Tên: nguồn `exact` hiện nguyên; `bridge` hiện kèm tiền tố `≈ `; không ra tên hiện `#<playerId>`.
- Lỗi "không phải FC27": thông điệp nguyên văn `Không phải save Career FC27.`
- Save mẫu và save FC26 KHÔNG commit. Đường dẫn dùng trong kiểm: `temp_fc27_upload/CmMgrC20260926153118445` (gọi là SAMPLE), `temp_fc26_upload/CmMgrC20260917112651768` (gọi là FC26SAVE).
- Kỳ vọng của SAMPLE (một nguồn duy nhất, mọi bước kiểm tham chiếu về đây): blob giải nén 17.632.769 byte; CLB teamid 11 "Man Utd"; Newcastle teamid 13; sơ đồ "4-2-3-1"; XI theo thứ tự ô = 254803, 236401, 269087, 203263, 205988, 216393, 269136, 243014, 240243, 212198, 260592; đội trưởng 212198; đội 39 người; học viện = 460003…460012; `msnl` 733 mục; cho mượn của CLB = {226753 → Trabzonspor, 77403 → Lausanne-Sport}, hết hạn 2027-06-30; POT thô 212198=90, 269136=87, 254803=88; OVR 212198=89.
- Commit message ngắn, không chép lại các con số ở trên; kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Hai chỗ lệch có chủ ý so với spec** (đã nêu khi xin duyệt):
1. Tra tên theo playerId cần ngày sinh + nameid FC26 từng cầu thủ — không có trong `public/fc26/*`, nên thêm asset `public/fc27/ref.json` build từ `dataset_fc26/base/players.csv` (Task 6).
2. Phân biệt CLB với đội tuyển khi `cm_teamsheets` có nhiều dòng: đội tuyển = dòng có tên đội trùng một tên quốc gia trong `ref.json` (thay cho tra leagues, vốn chưa ánh xạ được mã trường).

## Review Focus

- Save có nhiều dòng `cm_teamsheets` (CLB + đội tuyển) → phải chọn CLB, không lấy dòng đầu. (Task 5, `pickClubRow`)
- Title update làm mất một mã trường → đúng tab phụ thuộc báo lỗi có tên mã, tab khác vẫn chạy. (Task 5)
- File cụt / hỏng giữa khung zstd → lỗi có thông điệp, không treo worker, không trang trắng. (Task 1)
- Career chưa có lứa học viện (`IOmq` 0 dòng) → tab Học viện hiện trạng thái rỗng, không phải lỗi. (Task 5)
- `msnl` có bản ghi đuôi lạ vẫn đọc đủ; dấu `01`/`FF` lệch → dừng và báo, không đọc rác. (Task 4)

---

### Task 1: Container — giải nén zstd

**Files:**
- Create: `lib/fc27/container.ts`, `scripts/check-fc27.ts`
- Modify: `package.json` (dependency `fzstd`, script `"check:fc27": "npx tsx scripts/check-fc27.ts"`)

**Interfaces:**
- Produces: `class Fc27FormatError extends Error` (message mặc định = thông điệp "không phải FC27" ở Global Constraints); `function unpackSave(raw: Uint8Array): Uint8Array` — ném `Fc27FormatError` khi thiếu magic `FBCHUNKS`, không có khung zstd, hoặc kích thước giải nén ≠ u32 khai báo ở `frame − 16`; ném `Error("File save bị cụt hoặc hỏng.")` khi `fzstd` ném.
- `scripts/check-fc27.ts` là khung kiểm: `check(name: string, ok: boolean, detail?: string)`, đếm lỗi, `process.exitCode = 1` nếu có lỗi; đọc SAMPLE từ `process.argv[2]`, FC26SAVE từ `process.argv[3]`. Mỗi task sau thêm một khối kiểm vào file này.

- [ ] **Step 1: Viết khối kiểm "container"** trong `scripts/check-fc27.ts`:
  - `unpackSave(SAMPLE).length === 17632769`
  - `unpackSave(FC26SAVE)` ném `Fc27FormatError`
  - `unpackSave(new Uint8Array(1000))` ném `Fc27FormatError`
  - `unpackSave(SAMPLE.subarray(0, 3_000_000))` ném Error (không treo)
- [ ] **Step 2:** `npx tsx scripts/check-fc27.ts temp_fc27_upload/CmMgrC20260926153118445 temp_fc26_upload/CmMgrC20260917112651768` → FAIL (chưa có module).
- [ ] **Step 3:** `npm install --save-exact fzstd@0.1.1`; implement `unpackSave`: tìm magic zstd `28 B5 2F FD` sau `FBCHUNKS`, đọc cỡ khai báo ở `frame−16` và cỡ nén ở `frame−8`, giải nén `subarray(frame, frame+csize)` bằng `decompress` của `fzstd`.
- [ ] **Step 4:** chạy lại lệnh Step 2 → mọi mục "container" PASS.
- [ ] **Step 5:** `npm run typecheck` sạch; commit (`package.json`, `package-lock.json`, hai file mới).

### Task 2: Bộ đọc FIFA DB tổng quát

**Files:** Create `lib/fc27/fifadb.ts`; Modify `scripts/check-fc27.ts`

**Interfaces:**
- Consumes: `unpackSave`.
- Produces:
  ```ts
  interface DbField { type: number; bit: number; name: string; width: number }
  interface DbTable { name: string; recordSize: number; nRecords: number; nValid: number; fields: Map<string, DbField>; dataOffset: number }
  function openDatabases(blob: Uint8Array): DbTable[]          // mọi DB `DB\0\x08`, gộp bảng
  function findTable(tables: DbTable[], name: string): DbTable | null
  function readInt(blob: Uint8Array, t: DbTable, row: number, f: DbField): number   // LSB-first
  function readFloat(blob: Uint8Array, t: DbTable, row: number, f: DbField): number // type 4
  function readString(blob: Uint8Array, t: DbTable, row: number, f: DbField): string // type 0, UTF-8, dừng ở NUL
  function firstDbOffset(blob: Uint8Array): number   // vị trí chữ ký DB đầu tiên, -1 nếu không có
  ```
  Bố cục header theo spec §2. Không cache bản ghi; đọc theo cột.

- [ ] **Step 1: Khối kiểm "fifadb"**: trên blob SAMPLE — `findTable(...,"CZUM")` có `recordSize 156`, `nValid ≥ 21000`, có trường `ykFq`; `firstDbOffset(blob) === 212023`. Trên FC26SAVE (không nén, đưa thẳng bytes gốc) — `CZUM.recordSize === 144` (chứng minh bộ đọc không phụ thuộc phiên bản). `readString` hàng 0 của `lyxL`/`AUsv` là chuỗi không rỗng.
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** chạy → PASS; typecheck sạch; commit.

### Task 3: Schema FC27 + players/teams/links

**Files:** Create `lib/fc27/schema.ts`, `lib/fc27/read-tables.ts`; Modify `scripts/check-fc27.ts`

**Interfaces:**
- Produces (`schema.ts`): `const FC27` — object dữ liệu chứa mã bảng, mã trường và hằng số cộng theo spec §2 (players, teamplayerlinks, teams, formations, cm_teamsheets, team sheet sơ đồ, career_youthplayers). Không có logic.
- Produces (`read-tables.ts`):
  ```ts
  interface RawPlayer { id: number; overall: number; potential: number; positionCode: number; birthDay: number; joinedDay: number; nationalityId: number; firstNameId: number; lastNameId: number; commonNameId: number }
  interface Link { playerId: number; teamId: number; jersey: number }
  class MissingSchemaError extends Error { constructor(table: string, field?: string) } // message chứa mã thiếu
  function readPlayers(blob, tables): Map<number, RawPlayer>
  function readTeams(blob, tables): Map<number, string>
  function readLinks(blob, tables): Link[]
  ```
  Mỗi hàm ném `MissingSchemaError` nếu thiếu bảng/mã trường.

- [ ] **Step 1: Khối kiểm "tables"**: teams[11] === "Man Utd", teams[13] chứa "Newcastle" (mỏ neo ngoài cho hằng số cộng); player 212198 có potential/overall đúng Global Constraints; 254803 potential đúng; `readLinks` cho ra 39 playerId có teamId 11; mọi player thoả `potential ≥ overall`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS, typecheck → **Step 5:** commit.

### Task 4: Mục lục khối career + cho mượn (`msnl`)

**Files:** Create `lib/fc27/sections.ts`; Modify `scripts/check-fc27.ts`

**Interfaces:**
- Consumes: `firstDbOffset`.
- Produces:
  ```ts
  interface LoanRecord { playerId: number; ownerTeamId: number; until: string } // until 'YYYY-MM-DD'
  function readSectionIndex(raw: Uint8Array, blob: Uint8Array): Map<string, number> // tag → offset trong blob
  function readLoans(blob: Uint8Array, index: Map<string, number>): LoanRecord[]   // ném Error khi thiếu tag hoặc sai dấu
  ```
  Mục lục: quét `[4 chữ thường][u32]` trong vỏ ngoài bắt đầu 0x4AA tới trước khung zstd; Δ = giá trị `gsbd` − (`firstDbOffset(blob)` − 4) (spec §2). `msnl`: bỏ `[01][u32 4]['msnl']`, 16 byte header, `u32` cuối header là số mục; mỗi mục 20 byte, kiểm `b[0]==1`, `b[9]==1`, `b[19]==0xFF`; sai dấu → ném `Error` nêu chỉ số mục.

- [ ] **Step 1: Khối kiểm "loans"**: Δ suy ra = 1600; `readLoans` trả 733 mục; lọc `ownerTeamId===11` ra đúng tập cho mượn ở Global Constraints với `until` đúng; một bản sao blob bị sửa `b[9]` của mục thứ 5 → `readLoans` ném lỗi (không trả 733).
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS, typecheck → **Step 5:** commit.

### Task 5: Ghép `Fc27Career`

**Files:** Create `lib/fc27/read.ts`; Modify `scripts/check-fc27.ts`

**Interfaces:**
- Consumes: Task 1–4.
- Produces:
  ```ts
  type Tab = "squad" | "youth" | "loans" | "scout"
  interface LineupRead { sheetName: string; formationName: string | null; captainId: number | null; slots: { playerId: number; positionCode: number; x: number; y: number }[] }
  interface Fc27Career {
    club: { teamId: number; name: string } | null
    lineup: LineupRead | null
    squad: Link[]                 // link của CLB
    youthIds: number[]
    loans: (LoanRecord & { atTeamId: number | null; atTeamName: string | null })[]
    players: RawPlayer[]; teams: [number, string][]; links: Link[]
    refDay: number                // max joinedDay
    errors: Partial<Record<Tab, string>>
    warnings: Partial<Record<Tab, string[]>>
    timings: { unzipMs: number; readMs: number }
  }
  function readFc27(raw: Uint8Array, options?: { nationNames?: Set<string>; schema?: typeof FC27 }): Fc27Career  // chỉ ném Fc27FormatError; schema mặc định FC27, tham số chỉ để kiểm
  function pickClubRow(rows: { teamId: number; name: string }[], nationNames: Set<string>): number | null // chỉ số dòng
  ```
  Mỗi tab đọc trong `try` riêng; lỗi (kể cả `MissingSchemaError`) ghi vào `errors[tab]`. Tên sơ đồ: so tập 22 toạ độ (làm tròn 3 chữ số, sắp xếp) với bảng formations; đúng một tên khác nhau → dùng, nếu không → `null` + warning. CLB đang mượn = link đầu tiên của player có teamId ≠ owner và tên đội không thuộc `nationNames`. Cổng kiểm lúc đọc (spec §6) ghi vào `warnings`. Học viện 0 dòng → `youthIds: []`, không lỗi.

- [ ] **Step 1: Khối kiểm "career"** trên SAMPLE: mọi kỳ vọng Global Constraints (club, sơ đồ, XI theo thứ tự, đội trưởng, cỡ đội, học viện, cho mượn kèm `atTeamName`); `warnings` rỗng; `errors` rỗng. Review Focus: `pickClubRow([{teamId:1354,name:"Portugal"},{teamId:11,name:"Man Utd"}], new Set(["Portugal"])) === 1`; với bản sao `FC27` trong đó mã `playerid0` bị đổi thành mã không tồn tại, truyền qua `options.schema` → `errors.squad` chứa `MVLC` còn `errors.scout` không có; `readFc27(FC26SAVE)` ném `Fc27FormatError`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS, typecheck; in `timings` ra console → **Step 5:** commit.

### Task 6: Asset tham chiếu + tên cầu thủ + dựng `SavePlayer`

**Files:** Create `scripts/build-fc27-assets.ts`, `public/fc27/ref.json` (sinh ra, commit), `lib/fc27/names.ts`, `lib/fc27/view.ts`; Modify `package.json` (`"build:fc27": "npx tsx scripts/build-fc27-assets.ts"`), `scripts/check-fc27.ts`

**Interfaces:**
- `ref.json`: `{ builtAt, nations: Record<string,string>, players: number[] }` — `players` phẳng `[playerId, birthDay, firstNameId, lastNameId, commonNameId, …]` mã hoá delta theo playerId tăng dần (cùng kiểu `shippedIds` của world.json); nguồn `dataset_fc26/base/players.csv`, quốc gia từ `public/fc26/world.json#nationNames`.
- Produces:
  ```ts
  type NameSource = "exact" | "bridge" | null
  class Fc27Names { static fromRef(ref, fc26: Fc26Names, players: RawPlayer[]): Fc27Names; nameOf(p: RawPlayer): { name: string; source: NameSource } }
  function toSavePlayers(c: Fc27Career, names: Fc27Names, nations: Record<string,string>): SavePlayer[] // club = CLB hiện tại thật; age theo refDay
  function toLineup(c: Fc27Career): Lineup | null  // source "export", formationIsReal true; fit qua fitOf
  ```
  `exact`: playerId có trong ref và `birthDay` trùng. `bridge`: dựng map nameid-FC27 → chữ từ các cầu thủ `exact`; hiện `≈ ` + tên. Không có → `#id`. `nameSource` của `SavePlayer`: `exact`→`"database"`, `bridge`→`"namePool"`.

- [ ] **Step 1: Khối kiểm "names"**: `nameOf(254803)` = `{ "Senne Lammens", exact }`; `nameOf(212198)` = `Bruno Fernandes`; mọi `youthIds` có source ≠ `exact`; một player id giả không có nameid khớp → `#<id>`; `toLineup` trả 11 slot, `formationName` "4-2-3-1"; `toSavePlayers` cho player 212198 có `club === "Man Utd"` và `potential` bằng giá trị thô.
- [ ] **Step 2:** FAIL → **Step 3:** viết build script, chạy `npm run build:fc27`, implement `names.ts`, `view.ts` → **Step 4:** PASS, typecheck → **Step 5:** commit (kèm `public/fc27/ref.json`).

### Task 7: Worker, lưu file, trang và tab Đội hình

**Files:** Create `lib/fc27/parse.worker.ts`, `app/save-reader/fc27/page.tsx`, `components/save27/Fc27Client.tsx`, `components/save27/SquadTab.tsx`; Modify `lib/save/store.ts` (thêm tham số `key = KEY` cho `putSave`/`getSave`/`clearSave`, hành vi FC26 không đổi)

**Interfaces:**
- Worker nhận `{ kind: "parse"; file: File }`, trả `{ kind: "done"; career: Fc27Career } | { kind: "error"; message: string }`; gọi `file.arrayBuffer()` trong worker như FC26; `Fc27FormatError` → message nguyên văn.
- `Fc27Client`: ô thả file (dùng lại `components/save/SaveDropZone.tsx`), lưu/khôi phục bằng `putSave(file, "fc27")`/`getSave("fc27")`, nạp `/fc27/ref.json` + `loadFc26Names()`, 4 tab (3 tab còn lại là placeholder tới Task 8). Lỗi "không phải FC27" hiện kèm link `/save-reader`.
- `SquadTab`: `Pitch` với `toLineup`, bảng cả đội (số áo, tên, vị trí, tuổi ước tính, OVR, POT), tiêu đề cột POT có chú thích nguyên văn ở Global Constraints; hiển thị `errors.squad`/`warnings.squad` nếu có.

- [ ] **Step 1:** implement; `npm run typecheck` và `npm run build` sạch.
- [ ] **Step 2:** `preview_start` dev server, mở `/save-reader/fc27`, tải SAMPLE: sân hiện 4-2-3-1 đúng 11 người đúng ô, CLB Man Utd; tải lại trang → khôi phục; tải FC26SAVE → thông báo "không phải FC27" + link; trang `/save-reader` (FC26) vẫn chạy như cũ với FC26SAVE. Chụp ảnh làm bằng chứng.
- [ ] **Step 3:** commit.

### Task 8: Tab Học viện, Cho mượn, Scout + liên kết từ FC26

**Files:** Create `components/save27/YouthTab.tsx`, `components/save27/LoansTab.tsx`, `components/save27/ScoutTab.tsx`; Modify `components/save27/Fc27Client.tsx`, `app/save-reader/page.tsx` (một dòng liên kết sang FC27)

**Interfaces:** Consumes `toSavePlayers`, `filterPlayers`/`EMPTY_CRITERIA` từ `lib/fc26/scout.ts` (`onlyNewgen` luôn false và không hiện ô chọn; `excludeIds` = đội người chơi).

- YouthTab: danh sách học viện (tên kèm dấu `≈` nếu bridge, vị trí, tuổi ước tính, OVR, POT); rỗng → "Học viện chưa có cầu thủ nào."
- LoansTab: cầu thủ, đang ở CLB nào, hết hạn (dd/mm/yyyy), OVR, POT; rỗng → "Không có cầu thủ nào đang cho mượn."
- ScoutTab: bảng toàn thế giới với cột CLB **hiện tại**, bộ lọc tuổi/tuyến/OVR/POT/mức tăng; nhãn POT như Global Constraints.

- [ ] **Step 1:** implement; typecheck + build sạch.
- [ ] **Step 2:** trình duyệt với SAMPLE: Học viện đúng tập Global Constraints; Cho mượn đúng 2 người, CLB đúng; Scout lọc "tuổi ≤ 21, POT ≥ 85" cho kết quả không chứa cầu thủ Man Utd; liên kết từ trang FC26 dẫn tới FC27. Chụp ảnh.
- [ ] **Step 3:** commit.

### Task 9: Đo tốc độ và cổng cuối

**Files:** Modify `scripts/check-fc27.ts` (khối "timing": in `timings` FC27 và thời gian `parseSaveBuffer` FC26 trên FC26SAVE, chỉ in, không assert)

- [ ] **Step 1:** chạy `npm run check:fc27 -- <SAMPLE> <FC26SAVE>` → mọi khối PASS, in hai con số thời gian.
- [ ] **Step 2:** `npm run check:fc26` vẫn xanh (FC26 không bị ảnh hưởng); `npm run typecheck`; `npm run build`.
- [ ] **Step 3:** commit; báo cáo kèm hai con số thời gian.

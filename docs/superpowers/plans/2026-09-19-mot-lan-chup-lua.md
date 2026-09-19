# Một lần chụp Lua, dùng cho mọi save — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một file Lua chụp 11 bảng hằng số phiên bản một lần, một lệnh build sinh toàn bộ asset, và mọi file save đọc ra trang đầy đủ mà không phải chạy lại gì.

**Architecture:** Ba tầng nối nhau bằng thư mục: game → `dataset_fc26/base/*.csv` → `public/fc26/*.json` → trang. Tầng giữa chụp rộng (giữ nguyên mọi cột) và chọn hẹp lúc build, nên cần thêm trường về sau thì chạy lại build chứ không mở lại game. `players.json` (1,9MB, ba dataset công khai) và `squads.json` bị xoá, thay bằng `world.json` dựng từ bảng gốc.

**Tech Stack:** TypeScript, Node (`npx tsx`), Next.js App Router, Lua 5.3 (FC 26 Live Editor API).

**Spec:** [docs/superpowers/specs/2026-09-19-mot-lan-chup-lua-design.md](../specs/2026-09-19-mot-lan-chup-lua-design.md)

## Global Constraints

- **Không có test framework trong repo.** Không thêm vitest/jest. Quy ước sẵn có: script `scripts/check-*.ts` chạy bằng `npx tsx`, in `  ok  ` / `FAIL  ` từng dòng, kết thúc bằng `process.exit(failed ? 1 : 0)`. Mọi "test" trong kế hoạch này theo đúng khuôn đó. Mẫu để bám: `scripts/check-squads.ts`.
- **Bốn file save dùng để kiểm**, trong `%LOCALAPPDATA%\EA SPORTS FC 26\settings`: `CmMgrC20260704192007839`, `CmMgrC20260729233455335`, `CmMgrC20260917112651768`, `CmMgrC20260919014703842`. Chỉ đọc file bắt đầu bằng `Cm`.
- **Bảng có tiền tố `career_` hoặc `cm_` không bao giờ được nướng vào asset.** Đó là trạng thái của một career cụ thể.
- **Lua: không dùng API con trỏ** (`LE.db:GetTable`, `GetFirstRecord`, `GetRecordFieldValue`) — đường gây crash native mà `pcall` không bắt được. Chỉ `GetDBTablesNames`, `GetDBTableFields`, `GetDBTableRows`.
- **Tải asset thất bại phải trả `null`, không ném.** Mọi `loadFc26*` giữ nguyên hợp đồng `.catch(() => null)`: mất asset làm trang nghèo đi, không được làm hỏng việc đọc chỉ số từ save.
- **Chú thích tiếng Việt, giải thích "vì sao" chứ không "cái gì".** Khi gộp script, chuyển nguyên khối chú thích cũ sang chỗ mới thay vì viết lại.
- **Không dùng heredoc của Bash để ghi file có dấu `\`.** Dùng công cụ Write/Edit. Lỗi này đã làm hỏng file bốn lần trong dự án.
- Commit message không dấu tiếng Việt (repo đang theo lối đó), kết thúc bằng `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Review Focus

Năm nhóm đầu vào spec ngầm định nhưng không task nào tự nhiên chạm tới. Mỗi dòng đã được gắn test vào task sở hữu đoạn code đó.

1. **`nameId = 65535` (dấu "không có tên")** — có thật trong save `2026-07-29`. Phải ra `#playerId`, không được ra `"undefined undefined"` hay `"#65535"`. → test ở Task 5.
2. **Save của bản game khác** (FC 25, hoặc FC 26 đã vá) với `nameId` ngoài cả hai kho — phải xuống `#playerId` êm, không ném. → test ở Task 5.
3. **`world.json` hoặc `names.json` tải hỏng (404/JSON lỗi)** — bảng chỉ số vẫn phải hiện đủ, chỉ mất tên và số áo. → test ở Task 5.
4. **CLB do người chơi tự tạo** (không đội nào đạt ngưỡng 0,6) — không số áo, `club.name` là `null`, trang vẫn chạy. Đã có trong `check-squads.ts`; Task 6 chuyển sang `scripts/check-fc26-club.ts` thay vì xoá. → test ở Task 6 Step 4.
5. **`nameid` trùng giữa `playernames` và `dcplayernames`** — hai dải hôm nay không giao nhau (0–41.189 và 44.000+), nhưng bản cập nhật sau có thể làm giao. Thứ tự gộp phải xác định và báo ra số lượng trùng, không im lặng chọn bừa. → test ở Task 3.

---

### Task 1: Bộ đọc CSV dùng chung

Bốn script build đang chép nguyên hàm `splitCsvLine` và `readCsv` của nhau. Task tiếp theo gộp chúng làm một, nên tách phần dùng chung trước.

**Files:**
- Create: `scripts/csv.ts`
- Test: `scripts/check-csv.ts`

**Interfaces:**
- Consumes: không
- Produces: `readCsv(path: string): Array<Record<string, string>>` — khoá là tên cột viết thường, giá trị đã `.trim()`. `splitCsvLine(line: string): string[]`.

- [ ] **Step 1: Viết test trước, cho nó trượt**

Tạo `scripts/check-csv.ts`:

```ts
/**
 * Kiểm bộ đọc CSV dùng chung.
 *
 *   npx tsx scripts/check-csv.ts
 *
 * Ba trường hợp dưới đây đều CÓ THẬT trong bản dump của game, và mỗi cái từng
 * làm hỏng một bản dựng: BOM ở đầu file, tên đội có dấu phẩy, và dấu nháy kép
 * lồng trong ô đã bọc nháy.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readCsv, splitCsvLine } from "./csv";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

check("ô thường", JSON.stringify(splitCsvLine("a,b,c")) === '["a","b","c"]');
check(
  "ô bọc nháy có dấu phẩy",
  JSON.stringify(splitCsvLine('1,"Nott\'m Forest, The",3')) ===
    '["1","Nott\'m Forest, The","3"]',
);
check(
  "nháy kép lồng",
  JSON.stringify(splitCsvLine('1,"He said ""hi""",3')) === '["1","He said \\"hi\\"","3"]',
);
check("ô rỗng cuối dòng", JSON.stringify(splitCsvLine("a,b,")) === '["a","b",""]');

const dir = join(tmpdir(), "hangrua-check-csv");
mkdirSync(dir, { recursive: true });
const p = join(dir, "t.csv");
// BOM ở đầu: bản dump của Live Editor có, và nếu không cắt thì tên cột đầu
// tiên thành "﻿nameid" và mọi phép tra cột đều trượt.
writeFileSync(p, "﻿NameID,Name\r\n1, Alice \r\n2,\"B,b\"\r\n", "utf8");
const rows = readCsv(p);
check("cắt BOM và hạ tên cột về chữ thường", rows[0]?.nameid === "1", JSON.stringify(rows[0]));
check("cắt khoảng trắng hai đầu giá trị", rows[0]?.name === "Alice");
check("giữ dấu phẩy trong ô bọc nháy", rows[1]?.name === "B,b");
check("bỏ dòng rỗng cuối file", rows.length === 2, `${rows.length} dòng`);

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Chạy để chắc chắn nó trượt**

```bash
npx tsx scripts/check-csv.ts
```

Dự kiến: FAIL với `Cannot find module './csv'`.

- [ ] **Step 3: Viết bộ đọc**

Tạo `scripts/csv.ts` — chuyển nguyên hai hàm từ `scripts/build-fc26-squads.ts:41-82`:

```ts
/**
 * Bộ đọc CSV dùng chung cho các script build.
 *
 * Tách ra vì bốn script build đang chép nguyên hàm này của nhau, và chúng đã
 * bắt đầu lệch: một bản cắt BOM, một bản không. Bản dump của Live Editor CÓ
 * BOM, nên bản không cắt sẽ đặt tên cột đầu tiên thành "﻿nameid" và mọi
 * phép tra cột theo tên đều trượt — im lặng, vì cột chỉ trả `undefined`.
 */
import { readFileSync } from "node:fs";

/** Tách một dòng CSV, tôn trọng ô bọc nháy và nháy kép lồng (`""`). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') cur += c;
      else if (line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Đọc cả file. Tên cột hạ về chữ thường; giá trị cắt khoảng trắng hai đầu. */
export function readCsv(path: string): Array<Record<string, string>> {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const head = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    head.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

/** Số hoặc `-1`. Ô của game là chuỗi, và `Number("")` là `0` chứ không phải NaN. */
export function num(v: string | undefined): number {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : -1;
}
```

- [ ] **Step 4: Chạy lại, phải đạt**

```bash
npx tsx scripts/check-csv.ts
```

Dự kiến: 8 dòng `ok`, `Tất cả đều đạt.`

- [ ] **Step 5: Commit**

```bash
git add scripts/csv.ts scripts/check-csv.ts && git commit -m "Bo doc CSV dung chung cho cac script build

Bon script build dang chep nguyen ham nay cua nhau va da bat dau lech:
mot ban cat BOM, mot ban khong. Ban dump cua Live Editor CO BOM.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Gieo `dataset_fc26/base/` và cổng kiểm nguồn gốc

Cả 11 bảng cần thiết **đã có sẵn** trong `dataset_fc26/Live Editor/` từ các lần dump trước, nên pipeline chạy được ngay. Nhưng thư mục đó lẫn lộn 248 bảng gồm cả `career_*`, và có hai phiên bản `teamplayerlinks` — đúng thứ lộn xộn cần chấm dứt. Task này tách ra thư mục sạch và dựng cổng kiểm để lần sau không lẫn lại.

**Files:**
- Create: `dataset_fc26/base/` (10 file CSV chép vào)
- Create: `scripts/seed-fc26-base.ts`
- Create: `scripts/check-fc26-base.ts`
- Modify: `.gitignore` (nếu có dòng loại trừ `dataset_fc26`)

**Interfaces:**
- Consumes: `readCsv`, `num` từ Task 1
- Produces: `BASE_TABLES: ReadonlyArray<{ name: string; minRows: number; key: string }>` xuất từ `scripts/fc26-base-tables.ts` — Task 3, 4 và 7 đều dùng danh sách này làm một nguồn sự thật duy nhất.

- [ ] **Step 1: Viết test trước, cho nó trượt**

Tạo `scripts/check-fc26-base.ts`:

```ts
/**
 * Kiểm thư mục `dataset_fc26/base/` trước khi bất kỳ bản dựng nào đọc nó.
 *
 *   npx tsx scripts/check-fc26-base.ts
 *
 * Phép kiểm quan trọng nhất KHÔNG phải "có đủ file" mà là **không lẫn dữ liệu
 * career**. Một lượt chạy Lua từ menu chính đã từng ghi đè bản export tốt bằng
 * roster gốc không có đội của người chơi, và nó im lặng hoàn toàn. Thư mục này
 * chỉ được chứa hằng số phiên bản.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { readCsv } from "./csv";
import { BASE_TABLES, BASE_DIR } from "./fc26-base-tables";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

check("thư mục tồn tại", existsSync(BASE_DIR), BASE_DIR);
if (!existsSync(BASE_DIR)) {
  console.log("\nChạy `npx tsx scripts/seed-fc26-base.ts` trước.");
  process.exit(1);
}

const files = readdirSync(BASE_DIR);

// Bất biến số một: không bảng nào của career được lọt vào đây.
const career = files.filter((f) => /^(career_|cm_)/.test(f));
check("KHÔNG có bảng career_* hay cm_*", career.length === 0, career.join(", "));

// Bất biến số hai: không có file mang hậu tố cảnh báo của lần lẫn trước.
const suspicious = files.filter((f) => /KHONG-CO-CAREER|\.bak|\.old/i.test(f));
check("không còn file đặt tên né tránh", suspicious.length === 0, suspicious.join(", "));

for (const t of BASE_TABLES) {
  const p = join(BASE_DIR, `${t.name}.csv`);
  if (!existsSync(p)) {
    check(`${t.name}: có file`, false, p);
    continue;
  }
  const rows = readCsv(p);
  check(`${t.name}: đủ dòng`, rows.length >= t.minRows, `${rows.length} (tối thiểu ${t.minRows})`);
  check(`${t.name}: có cột khoá "${t.key}"`, rows.length > 0 && t.key in rows[0]);
}

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Chạy để chắc chắn nó trượt**

```bash
npx tsx scripts/check-fc26-base.ts
```

Dự kiến: FAIL với `Cannot find module './fc26-base-tables'`.

- [ ] **Step 3: Khai báo danh sách bảng**

Tạo `scripts/fc26-base-tables.ts`:

```ts
/**
 * Mười một bảng hằng số phiên bản — MỘT nguồn sự thật duy nhất.
 *
 * Script Lua chụp đúng danh sách này, cổng kiểm xác nhận đúng danh sách này,
 * và bản dựng đọc đúng danh sách này. Trước đây ba chỗ đó giữ ba danh sách
 * riêng, và chúng lệch nhau — `dcplayernames` có trong game, không có trong
 * bản dựng, nên 15% cầu thủ mất tên suốt một thời gian dài.
 *
 * `minRows` là số đo trên bản dump thật, để nới ~5%. Nó bắt được lượt chụp
 * hỏng giữa chừng — thứ mà phép kiểm "file có tồn tại không" bỏ lọt.
 */
export const BASE_DIR = "dataset_fc26/base";

export const BASE_TABLES = [
  { name: "playernames", minRows: 39_000, key: "nameid", why: "tên, nameid 0–41.189" },
  { name: "dcplayernames", minRows: 5_000, key: "nameid", why: "tên, nameid 44.000+" },
  { name: "players", minRows: 20_000, key: "playerid", why: "tập id roster gốc" },
  { name: "teamplayerlinks", minRows: 22_000, key: "playerid", why: "số áo, CLB" },
  { name: "teams", minRows: 700, key: "teamid", why: "tên CLB" },
  { name: "leagues", minRows: 40, key: "leagueid", why: "tên giải, cờ quốc tế" },
  { name: "leagueteamlinks", minRows: 700, key: "teamid", why: "CLB thuộc giải nào" },
  { name: "nations", minRows: 200, key: "nationid", why: "tên quốc gia" },
  { name: "formations", minRows: 800, key: "formationid", why: "hình học sân" },
  { name: "default_teamsheets", minRows: 700, key: "teamid", why: "sơ đồ nào thực sự có đội dùng" },
  { name: "teamkits", minRows: 3_500, key: "teamkitid", why: "màu áo, để dành" },
] as const;
```

**Mười một bảng, không phải mười.** Spec liệt kê mười và thiếu `default_teamsheets`.
Phát hiện khi đọc `build-fc26-formations.ts`: `formations.json` chỉ nhỏ được 5KB
nhờ **lọc** 871 sơ đồ xuống vài chục sơ đồ thật sự có đội dùng, và thứ cho biết
điều đó là bảng team sheet mặc định. Thiếu nó thì file phình lại ~130KB. Bảng
này không mang tiền tố `career_`/`cm_` nên vẫn là hằng số phiên bản — nhưng
**phải chụp ngoài career**, vì bản chụp trong career có lẫn CLB người chơi tự
tạo (đúng lý do cổng tiền kiểm của Task 7 tồn tại).

- [ ] **Step 4: Viết script gieo**

Tạo `scripts/seed-fc26-base.ts`:

```ts
/**
 * Gieo `dataset_fc26/base/` từ các bản dump đã có.
 *
 *   npx tsx scripts/seed-fc26-base.ts
 *
 * Mười một bảng cần thiết đều đã nằm trong `dataset_fc26/Live Editor/`, nên không
 * phải mở game để chạy được pipeline lần đầu. Nhưng thư mục đó lẫn 248 bảng
 * gồm cả `career_*`, và có HAI phiên bản `teamplayerlinks` — bản chụp trong
 * career (có đội của người chơi) và bản chụp ngoài career. Asset dùng chung
 * phải lấy bản NGOÀI career.
 *
 * Chạy một lần. Từ lần sau `scripts/fc26-dump-base.lua` ghi thẳng vào
 * `dataset_fc26/base/` nên không cần script này nữa; giữ lại để tái lập được.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { BASE_DIR, BASE_TABLES } from "./fc26-base-tables";

const SRC = "dataset_fc26/Live Editor";

/**
 * Bảng nào phải lấy bản chụp NGOÀI career.
 *
 * `teamplayerlinks` chụp trong career mang số áo và thành viên của đội người
 * chơi đang cầm — dữ liệu của một người, không được nướng vào asset chung.
 */
const PREFER_OUT_OF_CAREER: Record<string, string> = {
  teamplayerlinks: "fc26_teamplayerlinks.KHONG-CO-CAREER.csv",
};

mkdirSync(BASE_DIR, { recursive: true });

let copied = 0;
let missing = 0;
for (const t of BASE_TABLES) {
  const preferred = PREFER_OUT_OF_CAREER[t.name];
  const candidates = [
    ...(preferred ? [join(SRC, preferred)] : []),
    join(SRC, `fc26_${t.name}.csv`),
  ];
  const src = candidates.find((p) => existsSync(p));
  if (!src) {
    console.error(`THIẾU: ${t.name} — thử ${candidates.join(", ")}`);
    missing += 1;
    continue;
  }
  const dst = join(BASE_DIR, `${t.name}.csv`);
  copyFileSync(src, dst);
  console.log(`${t.name.padEnd(18)} ← ${src.split(/[\\/]/).pop()}`);
  copied += 1;
}

console.log(`\n${copied}/${BASE_TABLES.length} bảng đã gieo vào ${BASE_DIR}`);
if (missing) {
  console.error(`${missing} bảng thiếu — chạy scripts/fc26-dump-base.lua trong game.`);
  process.exit(1);
}
```

- [ ] **Step 5: Gieo rồi chạy cổng kiểm**

```bash
npx tsx scripts/seed-fc26-base.ts && npx tsx scripts/check-fc26-base.ts
```

Dự kiến: 11 dòng `←`, rồi 25 dòng `ok` (1 thư mục + 2 bất biến + 11×2 bảng), `Tất cả đều đạt.`

Nếu `.gitignore` đang loại trừ `dataset_fc26`, bỏ loại trừ cho `dataset_fc26/base/` — spec cố ý chấp nhận ~11,5MB CSV trong repo, đó là giá của việc không phải chạy lại Lua.

- [ ] **Step 6: Commit**

```bash
git add scripts/fc26-base-tables.ts scripts/seed-fc26-base.ts scripts/check-fc26-base.ts dataset_fc26/base .gitignore && git commit -m "Tach dataset_fc26/base: 10 bang hang so phien ban, co cong kiem

Ca 10 bang da co san tu cac lan dump truoc nen pipeline chay duoc ngay.
Thu muc Live Editor lan 248 bang gom ca career_*, va co HAI phien ban
teamplayerlinks. Asset dung chung lay ban NGOAI career.

Cong kiem chan hai thu: bang career_*/cm_* lot vao, va file dat ten ne
tranh kieu .KHONG-CO-CAREER.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `names.json` từ hai bảng tên

Đây là bản vá cho gốc rễ đã đo: game có hai bảng tên, bản dựng cũ chỉ đọc một.

**Files:**
- Create: `scripts/build-fc26-assets.ts`
- Create: `scripts/check-fc26-names.ts`
- Modify: `public/fc26/names.json` (sinh lại)

**Interfaces:**
- Consumes: `readCsv` (Task 1), `BASE_DIR`/`BASE_TABLES` (Task 2)
- Produces: `public/fc26/names.json` với hình dạng `{ builtAt: string; exact: true; count: number; pool: { id: number[]; text: string[] } }` — đúng hình dạng `Fc26Names` hiện có đã đọc được, nên `lib/fc26/names.ts` chưa phải sửa ở task này.

- [ ] **Step 1: Viết test trước, cho nó trượt**

Tạo `scripts/check-fc26-names.ts`:

```ts
/**
 * Kiểm kho tên trên bốn file save thật.
 *
 *   npx tsx scripts/check-fc26-names.ts <save…>
 *
 * Số cần theo dõi là độ phủ của KHO TÊN MỘT MÌNH, không phải của cả chuỗi tra
 * tên. Suốt một thời gian dài chuỗi đo được 99,98% trong khi kho tên chỉ đạt
 * 85% và `players.json` âm thầm gánh 15% — số tổng đẹp đã che mất điều đó.
 * Nên ở đây cố ý KHÔNG dùng `players.json`.
 */
import { readFileSync } from "node:fs";

import { Fc26Names } from "../lib/fc26/names";
import { readNewgenNames } from "../lib/save/career/newgen-names";
import { parseSaveBuffer } from "../lib/save";
import { readCsv } from "./csv";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const payload = JSON.parse(readFileSync("public/fc26/names.json", "utf8"));
const names = Fc26Names.fromPayload(payload);

console.log("── asset ──");
check("là bảng gốc, không phải suy ra", payload.exact === true);
check("một kho dùng chung", !!payload.pool && !payload.first);
check("đủ mục", payload.count >= 46_000, `${payload.count} tên`);
// Dải 44.000+ là `dcplayernames` — bảng bị bỏ sót suốt và là nguyên nhân
// khiến 15% cầu thủ phải nhờ `players.json`.
check(
  "có dải dcplayernames (44.000+)",
  payload.pool.id.some((n: number) => n >= 44_000),
);
check("không mục nào rỗng", payload.pool.text.every((s: string) => s.trim().length > 0));
check(
  "không nameid trùng",
  new Set(payload.pool.id).size === payload.pool.id.length,
);

/*
 * Hai dải nguồn có giao nhau không?
 *
 * Hôm nay không: `playernames` phủ 0–41.189, `dcplayernames` từ 44.000. Nhưng
 * bản cập nhật đội hình sau có thể lấp khoảng giữa, và khi đó bản dựng phải
 * chọn một bên — im lặng chọn bừa là cách hỏng tệ nhất vì tên vẫn hiện ra,
 * chỉ là sai người. Kiểm ngay tại nguồn, không kiểm ở đầu ra: đầu ra là một
 * Map nên nó LUÔN không trùng, kể cả khi nguồn trùng.
 */
const idsOf = (t: string) =>
  new Set(readCsv(`dataset_fc26/base/${t}.csv`).map((r) => Number(r.nameid)));
const a = idsOf("playernames");
const clash = [...idsOf("dcplayernames")].filter((id) => a.has(id));
check("hai bảng tên không giao nhau", clash.length === 0, `${clash.length} nameid trùng`);

// Nhóm nguy hiểm: `65535` là dấu "không có tên", CÓ THẬT trong save 2026-07-29.
check("65535 không tra ra chữ", names.resolve(65535, 5125, 0) === null);
check("chỉ số ngoài mọi dải trả null", names.resolve(9_999_999, 9_999_998, 0) === null);
check("thiếu một mảnh thì trả null, không ghép nửa vời", names.resolve(21799, null, 0) === null);

for (const savePath of process.argv.slice(2)) {
  const label = savePath.split(/[\\/]/).pop()!;
  const buf = readFileSync(savePath);
  const doc = parseSaveBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { fileName: savePath },
  );
  const players = doc.career?.players ?? [];
  if (!players.length) {
    check(`${label}: đọc được career`, false);
    continue;
  }
  const newgen = readNewgenNames(new Uint8Array(buf));

  let ok = 0;
  const miss: string[] = [];
  for (const p of players) {
    if (newgen.has(p.playerId) || names.resolve(p.firstNameId, p.lastNameId, p.commonNameId)) {
      ok += 1;
    } else if (miss.length < 4) {
      miss.push(`#${p.playerId} f=${p.firstNameId} l=${p.lastNameId} c=${p.commonNameId}`);
    }
  }
  const share = ok / players.length;
  console.log(`\n── ${label} (${players.length} cầu thủ) ──`);
  // Ngưỡng 0,9995 chứ không 1,0: save 2026-07-29 có đúng MỘT bản ghi mang
  // `f=65535`, tức game tự đánh dấu "không có tên". Đòi tuyệt đối sẽ biến một
  // hành vi đúng thành lỗi đỏ.
  check(
    `${label}: kho tên phủ ≥99,95% KHÔNG cần players.json`,
    share >= 0.9995,
    `${ok}/${players.length} = ${(share * 100).toFixed(2)}%${miss.length ? ` · còn ${miss.join(", ")}` : ""}`,
  );
}

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Chạy để chắc chắn nó trượt**

```bash
S="/c/Users/Viet Hung/AppData/Local/EA SPORTS FC 26/settings"; npx tsx scripts/check-fc26-names.ts "$S/CmMgrC20260704192007839" "$S/CmMgrC20260729233455335" "$S/CmMgrC20260917112651768" "$S/CmMgrC20260919014703842"
```

Dự kiến: FAIL ở `đủ mục` (asset hiện có 41.189 < 46.000), FAIL ở `có dải dcplayernames`, và FAIL độ phủ ~85% trên cả bốn save.

- [ ] **Step 3: Viết bản dựng**

Tạo `scripts/build-fc26-assets.ts`:

```ts
/**
 * Dựng toàn bộ asset `public/fc26/` từ `dataset_fc26/base/`.
 *
 *   npm run build:fc26
 *
 * ─── VÌ SAO MỘT SCRIPT CHỨ KHÔNG NĂM ────────────────────────────────────────
 *
 * Trước đây có năm script build rời, viết ở năm thời điểm khác nhau, mỗi cái
 * nhận đối số riêng. Phải nhớ chạy đúng thứ tự với đúng đường dẫn chính là
 * nguyên nhân của sự lệch pha đã phải sửa: `dcplayernames` có trong game từ
 * đầu, nhưng bản dựng kho tên không bao giờ được cập nhật để đọc nó, nên 15%
 * cầu thủ mất tên và một dataset công khai 1,9MB phải gánh thay.
 *
 * Một lệnh, một nguồn, mọi asset sinh cùng lúc.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readCsv, num } from "./csv";
import { BASE_DIR } from "./fc26-base-tables";

const OUT_DIR = "public/fc26";
const builtAt = new Date().toISOString().slice(0, 10);
const base = (t: string) => join(BASE_DIR, `${t}.csv`);

mkdirSync(OUT_DIR, { recursive: true });

const write = (name: string, payload: unknown) => {
  const json = JSON.stringify(payload);
  writeFileSync(join(OUT_DIR, name), json);
  console.log(`-> ${name} (${(json.length / 1024).toFixed(0)} KB chưa nén)`);
};

// ── Kho tên ─────────────────────────────────────────────────────────────────
/*
 * HAI bảng, không phải một.
 *
 *   playernames    nameid 0–41.189
 *   dcplayernames  nameid 44.000+   ← tên thêm qua bản cập nhật đội hình
 *
 * Cả `firstnameid`, `lastnameid` và `commonnameid` đều trỏ vào cùng một không
 * gian id trải trên cả hai bảng, nên phải gộp thành MỘT kho.
 */
function buildNames() {
  const text = new Map<number, string>();
  let blank = 0;
  let clash = 0;
  for (const table of ["playernames", "dcplayernames"]) {
    for (const r of readCsv(base(table))) {
      const id = num(r.nameid);
      const s = (r.name ?? "").trim();
      if (id < 0) continue;
      if (!s) {
        // Một id trỏ tới chuỗi rỗng không khác gì id không tồn tại, và giữ lại
        // chỉ làm phía đọc phải kiểm hai lần.
        blank += 1;
        continue;
      }
      // Hai dải hôm nay không giao nhau. Bản cập nhật sau có thể làm giao, nên
      // BÁO RA thay vì im lặng chọn bừa — bảng sau thắng, và con số nói rõ.
      if (text.has(id) && text.get(id) !== s) clash += 1;
      text.set(id, s);
    }
  }
  const id = [...text.keys()].sort((a, b) => a - b);
  console.log(
    `kho tên: ${id.length} mục (bỏ ${blank} rỗng${clash ? `, ${clash} id trùng — bảng sau thắng` : ""})`,
  );
  write("names.json", {
    builtAt,
    /** Bảng gốc, nên không có "độ chính xác" để báo — khác bản suy ra trước đây. */
    exact: true,
    count: id.length,
    /** Kho DUY NHẤT: cả ba chỉ số tên đều trỏ vào đây. */
    pool: { id, text: id.map((k) => text.get(k)!) },
  });
}

buildNames();
```

- [ ] **Step 4: Dựng lại rồi chạy test, phải đạt**

```bash
npx tsx scripts/build-fc26-assets.ts && S="/c/Users/Viet Hung/AppData/Local/EA SPORTS FC 26/settings" && npx tsx scripts/check-fc26-names.ts "$S/CmMgrC20260704192007839" "$S/CmMgrC20260729233455335" "$S/CmMgrC20260917112651768" "$S/CmMgrC20260919014703842"
```

Dự kiến: `kho tên: 46813 mục`, rồi mọi dòng `ok`. Độ phủ 100,00% / 99,99% / 100,00% / 100,00%.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-fc26-assets.ts scripts/check-fc26-names.ts public/fc26/names.json && git commit -m "Kho ten ghep hai bang: playernames + dcplayernames

Game co HAI bang ten. playernames phu nameid 0-41.189, dcplayernames phu
tu 44.000 (5.624 muc). Ban dung cu chi doc bang thu nhat, nen 15% cau thu
phai nho players.json tra theo playerId.

Do tren bon save that, kho ten MOT MINH khong dung players.json:
100,00% / 99,99% / 100,00% / 100,00%. Truoc do la 85%.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `world.json` — CLB, giải, số áo, quốc gia, id gốc

Gộp `squads.json` với phần còn lại của `players.json`. Thêm một thứ dataset công khai không có: CLB lấy từ `teamplayerlinks` và phân biệt được CLB với đội tuyển quốc gia.

**Files:**
- Modify: `scripts/build-fc26-assets.ts`
- Modify: `package.json` (thêm `build:fc26`)
- Create: `public/fc26/world.json`

**Interfaces:**
- Consumes: `readCsv`, `num` (Task 1), `BASE_DIR` (Task 2)
- Produces: `public/fc26/world.json` theo đúng interface dưới đây. Task 5 đọc chính xác hình dạng này:

```ts
interface WorldPayload {
  builtAt: string;
  teamCount: number;
  /** Mã đội → tên. Chỉ đội có tên thật. */
  names: Record<string, string>;
  /** Mã đội → mảng phẳng [playerId, số áo, …]. */
  squads: Record<string, number[]>;
  /** Mã đội → mã giải. CHỈ giải trong nước, nên có mặt ở đây nghĩa là CLB. */
  leagueOfTeam: Record<string, number>;
  /** Mã giải → tên. */
  leagueNames: Record<string, string>;
  /** Mã quốc gia → tên. */
  nationNames: Record<string, string>;
  /** Id roster gốc, mã hoá delta tăng dần. */
  shippedIds: number[];
  /** Id nội dung Ultimate Team, mã hoá delta tăng dần. */
  utIds: number[];
}
```

- [ ] **Step 1: Viết test trước, cho nó trượt**

Tạo `scripts/check-fc26-world.ts`:

```ts
/**
 * Kiểm `world.json`.
 *
 *   npx tsx scripts/check-fc26-world.ts
 *
 * Bất biến quan trọng nhất giữ nguyên từ `check-squads.ts`: asset KHÔNG được
 * chứa đội hình xuất phát. Cột `position` bị cố ý bỏ khỏi file; ai thêm lại
 * thì lỗi đã gỡ bỏ một lần quay lại, và quay lại im lặng.
 */
import { readFileSync } from "node:fs";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const raw = readFileSync("public/fc26/world.json", "utf8");
const w = JSON.parse(raw);

check("KHÔNG chứa mã vị trí (đội hình xuất phát)", !raw.includes('"position'));
check("có đội", Object.keys(w.squads ?? {}).length > 700, `${w.teamCount} đội`);
check("có tên đội", Object.keys(w.names ?? {}).length > 700);
check("có tên giải", Object.keys(w.leagueNames ?? {}).length >= 40);
check("có tên quốc gia", Object.keys(w.nationNames ?? {}).length >= 200);
check("tên quốc gia tra được", w.nationNames["1"] === "Albania", w.nationNames?.["1"]);

// `leagueOfTeam` chỉ chứa giải TRONG NƯỚC, nên số đội ở đây phải NHỎ HƠN tổng
// số đội — hiệu số chính là các đội tuyển quốc gia.
const domestic = Object.keys(w.leagueOfTeam ?? {}).length;
check("phân biệt được CLB với đội tuyển", domestic > 600 && domestic < w.teamCount,
  `${domestic} CLB / ${w.teamCount} đội`);

const undelta = (d: number[]) => {
  const out: number[] = [];
  let acc = 0;
  for (const x of d) { acc += x; out.push(acc); }
  return out;
};
const shipped = undelta(w.shippedIds ?? []);
const ut = undelta(w.utIds ?? []);
check("tập id gốc đủ lớn", shipped.length >= 20_000, `${shipped.length} id`);
check("id gốc tăng dần sau khi giải delta", shipped.every((v, i) => i === 0 || v > shipped[i - 1]));
check("danh sách UT còn nguyên", ut.length >= 3_900, `${ut.length} id`);
// Bằng chứng đã đo: bảng gốc của game KHÔNG chứa nội dung Ultimate Team, nên
// hai tập phải rời nhau. Giao nhau nghĩa là một trong hai nguồn sai.
const shippedSet = new Set(shipped);
const overlap = ut.filter((x) => shippedSet.has(x));
check("UT và roster gốc rời nhau", overlap.length === 0, `${overlap.length} id giao nhau`);

console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Chạy để chắc chắn nó trượt**

```bash
npx tsx scripts/check-fc26-world.ts
```

Dự kiến: FAIL với `ENOENT ... public/fc26/world.json`.

- [ ] **Step 3: Mở rộng bản dựng**

Thêm vào cuối `scripts/build-fc26-assets.ts`, sau lời gọi `buildNames()`:

```ts
// ── Thế giới: CLB, giải, số áo, quốc gia, id gốc ────────────────────────────
/*
 * Mã hoá delta cho danh sách id tăng dần.
 *
 * 21.437 id dạng thô tốn ~150KB trong JSON; delta của chúng hầu hết là số một
 * hai chữ số, còn ~70KB. Tra cứu vẫn O(1) vì phía đọc dựng Set một lần.
 */
function delta(ids: number[]): number[] {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const out: number[] = [];
  let prev = 0;
  for (const id of sorted) {
    out.push(id - prev);
    prev = id;
  }
  return out;
}

function buildWorld() {
  // Tên đội. Tên giữ chỗ dạng `*TeamName_Abbr15_115486` là CLB do người chơi
  // tự tạo — không thuộc dữ liệu gốc, và hiện ra thì vô nghĩa.
  const teamName = new Map<number, string>();
  for (const r of readCsv(base("teams"))) {
    const id = num(r.teamid);
    const name = r.teamname ?? "";
    if (id > 0 && name && !name.startsWith("*")) teamName.set(id, name);
  }

  /*
   * Giải TRONG NƯỚC, để phân biệt CLB với đội tuyển quốc gia.
   *
   * `teamplayerlinks` nối cầu thủ với CẢ HAI, nên tra "CLB của người này" mà
   * lấy đội đầu tiên gặp được sẽ ra "Brazil" thay vì "Real Madrid" khá thường
   * xuyên. Dataset công khai trước đây không có cách nào phân biệt; bảng gốc
   * thì có, ở cột `isinternationalleague`.
   */
  const leagueNames = new Map<number, string>();
  const domesticLeagues = new Set<number>();
  for (const r of readCsv(base("leagues"))) {
    const id = num(r.leagueid);
    if (id < 0) continue;
    if (r.leaguename) leagueNames.set(id, r.leaguename);
    if (num(r.isinternationalleague) !== 1) domesticLeagues.add(id);
  }

  const leagueOfTeam = new Map<number, number>();
  for (const r of readCsv(base("leagueteamlinks"))) {
    const team = num(r.teamid);
    const league = num(r.leagueid);
    if (team > 0 && domesticLeagues.has(league)) leagueOfTeam.set(team, league);
  }

  // Số áo theo cặp (cầu thủ, đội) — số áo không nằm trong bản ghi cầu thủ vì
  // nó thuộc về cặp, không thuộc về người.
  const byTeam = new Map<number, number[]>();
  let links = 0;
  let noJersey = 0;
  for (const r of readCsv(base("teamplayerlinks"))) {
    const pid = num(r.playerid);
    const team = num(r.teamid);
    const jersey = num(r.jerseynumber);
    if (pid <= 0 || team <= 0) continue;
    links += 1;
    if (jersey <= 0) {
      noJersey += 1;
      continue;
    }
    const list = byTeam.get(team);
    if (list) list.push(pid, jersey);
    else byTeam.set(team, [pid, jersey]);
  }

  const nationNames = new Map<number, string>();
  for (const r of readCsv(base("nations"))) {
    const id = num(r.nationid);
    if (id >= 0 && r.nationname) nationNames.set(id, r.nationname);
  }

  const shipped = readCsv(base("players")).map((r) => num(r.playerid)).filter((n) => n > 0);

  /*
   * Danh sách Ultimate Team: DI SẢN, không tái tạo được từ bảng gốc.
   *
   * Đã đo và xác nhận: bảng `players` của game là roster Career thuần — không
   * Pelé, Maradona, Zidane; đội đông nhất 38 người. Nên game KHÔNG có cách nào
   * nói cho ta biết id nào là nội dung ngoài Career.
   *
   * Nhưng cờ này vẫn đúng và vẫn cần: đo trên hai save, nó lọc 112 và 67 người,
   * và KHÔNG ai trong số đó có trong bảng gốc. Bỏ đi thì cả trăm bản ghi lạ
   * hiện lên đầu bảng (bảng sắp theo chỉ số) và che mất cầu thủ thật.
   *
   * Nên bê nguyên một lần từ `players.json` cũ rồi thôi. Nếu FC 27 đổi, phải
   * tìm nguồn khác — không suy ra được từ `dataset_fc26/base/`.
   */
  const legacy = JSON.parse(readFileSync("public/fc26/players.json", "utf8")) as {
    utIds?: number[];
  };
  const utIds = legacy.utIds ?? [];
  if (utIds.length < 3_000) {
    throw new Error(
      `players.json chỉ có ${utIds.length} id UT — quá ít. Đừng xoá file đó ` +
        `trước khi world.json đã sinh xong ít nhất một lần.`,
    );
  }

  const teams = [...byTeam.keys()].sort((a, b) => a - b);
  console.log(
    `thế giới: ${teams.length} đội (${leagueOfTeam.size} CLB), ${links} liên kết ` +
      `(${noJersey} không số áo), ${shipped.length} id gốc, ${utIds.length} id UT`,
  );

  write("world.json", {
    builtAt,
    teamCount: teams.length,
    names: Object.fromEntries(
      teams.filter((t) => teamName.has(t)).map((t) => [String(t), teamName.get(t)!]),
    ),
    /** Mảng phẳng để khỏi lặp tên khoá 23.000 lần. */
    squads: Object.fromEntries(teams.map((t) => [String(t), byTeam.get(t)!])),
    leagueOfTeam: Object.fromEntries([...leagueOfTeam].map(([t, l]) => [String(t), l])),
    leagueNames: Object.fromEntries([...leagueNames].map(([l, n]) => [String(l), n])),
    nationNames: Object.fromEntries([...nationNames].map(([n, s]) => [String(n), s])),
    shippedIds: delta(shipped),
    utIds: delta(utIds),
  });
}

buildWorld();
```

Thêm `readFileSync` vào dòng import `node:fs` ở đầu file.

- [ ] **Step 4: Thêm lệnh npm**

Trong `package.json`, thêm vào `"scripts"`:

```json
"build:fc26": "tsx scripts/build-fc26-assets.ts",
"check:fc26": "tsx scripts/check-fc26-base.ts && tsx scripts/check-fc26-world.ts && tsx scripts/check-csv.ts"
```

- [ ] **Step 5: Dựng rồi chạy test, phải đạt**

```bash
npm run build:fc26 && npx tsx scripts/check-fc26-world.ts
```

Dự kiến: dòng `thế giới: …`, rồi mọi dòng `ok`.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-fc26-assets.ts scripts/check-fc26-world.ts package.json public/fc26/world.json && git commit -m "world.json: CLB, giai, so ao, quoc gia, id goc trong mot file

Gop squads.json voi phan con lai cua players.json. Them mot thu dataset
cong khai khong co: phan biet CLB voi doi tuyen quoc gia bang cot
isinternationalleague, nen tra \"CLB cua nguoi nay\" khong con ra \"Brazil\"
thay vi \"Real Madrid\".

utIds be nguyen tu players.json mot lan: bang goc cua game la roster
Career thuan nen khong tai tao duoc, nhung co do van dung (loc 112 va 67
nguoi tren hai save, khong ai co trong bang goc).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `lib/fc26/world.ts` và chuỗi tra tên ba bậc

**Files:**
- Create: `lib/fc26/world.ts`
- Modify: `lib/fc26/names.ts` (chú thích chuỗi tra tên, bỏ nhánh asset cũ ba kho)
- Delete: `lib/fc26/squads.ts` (nội dung chuyển vào `world.ts`)
- Create: `scripts/check-fc26-lib.ts`

**Interfaces:**
- Consumes: `world.json` theo `WorldPayload` (Task 4)
- Produces:

```ts
export interface ClubMatch {
  teamId: number;
  name: string | null;
  league: string | null;
  jerseyOf: Map<number, number>;
  matched: number;
  total: number;
}
export class Fc26World {
  static fromPayload(data: WorldPayload): Fc26World;
  matchClub(squadIds: number[], minShare?: number): ClubMatch | null;
  clubOf(playerId: number): { name: string; league: string | null } | null;
  nation(nationalityId: number | null): string | null;
  isUltimateTeam(playerId: number): boolean;
  shippedIds(): Set<number>;
}
export function loadFc26World(url?: string): Promise<Fc26World | null>;
```

`ClubMatch` giữ nguyên tên và mọi trường cũ, chỉ **thêm** `league`, nên `components/save/*` nhận `ClubMatch` không phải đổi gì ngoài đường import.

- [ ] **Step 1: Viết test trước, cho nó trượt**

Tạo `scripts/check-fc26-lib.ts`:

```ts
/**
 * Kiểm lớp đọc asset: `Fc26World` và chuỗi tra tên ba bậc.
 *
 *   npx tsx scripts/check-fc26-lib.ts
 *
 * Ba nhóm ở cuối là các đầu vào mà spec ngầm định nhưng không phần nào của
 * đường chạy bình thường chạm tới: asset hỏng, chỉ số ngoài dải, và dấu 65535.
 * Chúng là chỗ trang dễ vỡ theo kiểu người dùng nhìn thấy nhất.
 */
import { readFileSync } from "node:fs";

import { Fc26Names, collapseDoubledName } from "../lib/fc26/names";
import { Fc26World } from "../lib/fc26/world";

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const world = Fc26World.fromPayload(
  JSON.parse(readFileSync("public/fc26/world.json", "utf8")),
);
const names = Fc26Names.fromPayload(
  JSON.parse(readFileSync("public/fc26/names.json", "utf8")),
);

console.log("── Fc26World ──");
check("tra được tên quốc gia", world.nation(1) === "Albania", String(world.nation(1)));
check("quốc tịch null trả null", world.nation(null) === null);
check("mã quốc gia lạ trả null", world.nation(99_999) === null);
check("tập id gốc đủ lớn", world.shippedIds().size >= 20_000, `${world.shippedIds().size}`);

// `clubOf` phải trả CLB, không phải đội tuyển quốc gia. #158023 là Lionel Messi.
const club = world.clubOf(158023);
check("clubOf trả CLB chứ không phải đội tuyển", !!club && !/Argentina/i.test(club.name),
  club ? `${club.name} · ${club.league}` : "null");
check("clubOf với id không tồn tại trả null", world.clubOf(-1) === null);

console.log("\n── chuỗi tra tên ──");
check("tên thường dùng thắng tên+họ", names.resolve(5982, 40655, 7926) === "Cristiano Ronaldo");
check("ghép tên + họ", names.resolve(21799, 24898, 0) === "Lionel Messi");
// Cầu thủ MỘT tên được game lưu bằng cách đặt tên và họ bằng nhau.
check("mononym không in hai lần", names.resolve(40399, 40399, 0) === "Zothanpuia");
check("collapseDoubledName vẫn chuẩn hoá", collapseDoubledName("Zheng Zheng") === "Zheng");

console.log("\n── đầu vào bất thường ──");
check("dấu 65535 trả null", names.resolve(65535, 5125, 0) === null);
check("chỉ số ngoài mọi dải trả null", names.resolve(9_999_999, 9_999_998, 0) === null);
check("thiếu một mảnh trả null", names.resolve(21799, null, 0) === null);
check("cả ba bằng 0 trả null", names.resolve(0, 0, 0) === null);

/*
 * Asset hỏng phải trả `null` chứ không ném.
 *
 * Trang vẫn phải hiện đủ chỉ số đọc từ save khi mất tên — mất asset làm trang
 * nghèo đi, không được làm hỏng thứ khác. Cổng này dễ vỡ im lặng: đổi `.catch`
 * thành `.then` là hợp đồng mất mà không phép kiểm nào khác thấy.
 *
 * Bọc trong hàm async chứ không dùng `await` ở cấp cao nhất: `process.exit`
 * chạy đồng bộ ngay sau, nên top-level await sẽ thoát trước khi promise xong.
 */
async function checkBrokenAsset() {
  const broken = await loadFc26World("http://127.0.0.1:1/khong-ton-tai.json");
  check("world.json tải hỏng trả null, không ném", broken === null);

  console.log(failed === 0 ? "\nTất cả đều đạt." : `\n${failed} mục KHÔNG đạt.`);
  process.exit(failed ? 1 : 0);
}
void checkBrokenAsset();
```

Sửa dòng import cho khớp: `import { Fc26World, loadFc26World } from "../lib/fc26/world";`

- [ ] **Step 2: Chạy để chắc chắn nó trượt**

```bash
npx tsx scripts/check-fc26-lib.ts
```

Dự kiến: FAIL với `Cannot find module '../lib/fc26/world'`.

- [ ] **Step 3: Viết `lib/fc26/world.ts`**

Chuyển nguyên `Fc26Squads` sang, giữ toàn bộ khối chú thích về ngưỡng 0,6 và về việc không nướng đội hình:

```ts
/**
 * Thế giới FC 26 như lúc game xuất xưởng — CLB, giải, số áo, quốc gia, tập id.
 *
 * ─── VÌ SAO ĐƯỢC NƯỚNG SẴN, KHÁC VỚI ĐỘI HÌNH XUẤT PHÁT ────────────────────
 *
 * Mọi thứ ở đây là hằng số theo phiên bản game: số áo, "cầu thủ này thuộc CLB
 * nào đầu mùa", tên giải, tên quốc gia. Đội hình xuất phát thì không — nó đổi
 * mỗi lần người chơi xếp lại đội, và nướng nó vào asset chính là lỗi đã phải
 * gỡ bỏ một lần.
 *
 * Ranh giới đó không tự giữ được, nên bản dựng cố ý KHÔNG ghi cột `position`
 * ra file. Không có dữ liệu thì không ai lỡ dùng nhầm.
 *
 * ─── GIỚI HẠN PHẢI NÓI RA ───────────────────────────────────────────────────
 *
 * Cầu thủ do career sinh ra không bao giờ có trong đây — họ chưa tồn tại lúc
 * game xuất xưởng. Chỗ nào không có số áo thì hiện chữ cái đầu tên, không bịa.
 */

export interface WorldPayload {
  builtAt: string;
  teamCount: number;
  names: Record<string, string>;
  squads: Record<string, number[]>;
  /** CHỈ giải trong nước, nên có mặt ở đây nghĩa là CLB chứ không phải đội tuyển. */
  leagueOfTeam: Record<string, number>;
  leagueNames: Record<string, string>;
  nationNames: Record<string, string>;
  /** Mã hoá delta tăng dần. */
  shippedIds: number[];
  /** Mã hoá delta tăng dần. */
  utIds: number[];
}

export interface ClubMatch {
  teamId: number;
  name: string | null;
  league: string | null;
  /** playerId → số áo, chỉ trong phạm vi CLB này. */
  jerseyOf: Map<number, number>;
  /** Bao nhiêu cầu thủ của đội đọc từ save thuộc về CLB này. */
  matched: number;
  total: number;
}

function undelta(d: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const x of d) {
    acc += x;
    out.push(acc);
  }
  return out;
}

export class Fc26World {
  /** playerId → danh sách mã đội mà người đó thuộc về (CLB và đội tuyển). */
  private readonly teamsOf: Map<number, number[]>;
  private readonly shipped: Set<number>;
  private readonly ut: Set<number>;
  private readonly data: WorldPayload;

  private constructor(data: WorldPayload) {
    this.data = data;
    this.teamsOf = new Map();
    for (const [teamStr, flat] of Object.entries(data.squads ?? {})) {
      const team = Number(teamStr);
      for (let i = 0; i < flat.length; i += 2) {
        const pid = flat[i];
        const list = this.teamsOf.get(pid);
        if (list) list.push(team);
        else this.teamsOf.set(pid, [team]);
      }
    }
    this.shipped = new Set(undelta(data.shippedIds ?? []));
    this.ut = new Set(undelta(data.utIds ?? []));
  }

  static fromPayload(data: WorldPayload): Fc26World {
    return new Fc26World(data);
  }

  /**
   * Mọi playerId có trong roster xuất xưởng của game.
   *
   * Dùng để nhận ra cầu thủ do career SINH RA: ai không có ở đây thì không tồn
   * tại lúc game phát hành. Đó là dấu hiệu duy nhất không phụ thuộc career cụ
   * thể nào — dải ID thì mỗi career một khác.
   */
  shippedIds(): Set<number> {
    return this.shipped;
  }

  /**
   * Cầu thủ này là nội dung Ultimate Team, không thuộc danh sách career.
   *
   * Danh sách này là DI SẢN từ dataset công khai và không tái tạo được từ bảng
   * gốc: bảng `players` của game là roster Career thuần, không chứa Icon nào.
   * Nhưng nó vẫn đúng — đo trên hai save, nó lọc 112 và 67 người và không ai
   * trong số đó có trong bảng gốc. Bỏ đi thì cả trăm bản ghi lạ hiện lên đầu
   * bảng, vì bảng sắp theo chỉ số.
   */
  isUltimateTeam(playerId: number): boolean {
    return this.ut.has(playerId);
  }

  /** Tên quốc gia theo mã đọc từ save. Áp dụng cho MỌI cầu thủ, kể cả người không tra được tên. */
  nation(nationalityId: number | null): string | null {
    if (nationalityId === null) return null;
    return this.data.nationNames?.[String(nationalityId)] ?? null;
  }

  /**
   * CLB gốc của một cầu thủ — CLB thật, không phải đội tuyển quốc gia.
   *
   * `teamplayerlinks` nối cầu thủ với cả hai. Lọc theo `leagueOfTeam`, vốn chỉ
   * chứa giải trong nước, nên đội tuyển tự rụng khỏi kết quả.
   */
  clubOf(playerId: number): { name: string; league: string | null } | null {
    for (const team of this.teamsOf.get(playerId) ?? []) {
      const league = this.data.leagueOfTeam?.[String(team)];
      if (league === undefined) continue;
      const name = this.data.names?.[String(team)];
      if (!name) continue;
      return { name, league: this.data.leagueNames?.[String(league)] ?? null };
    }
    return null;
  }

  /**
   * Đội hình đọc từ save thuộc CLB nào?
   *
   * Bỏ phiếu theo đa số thay vì tin một cầu thủ. Một đội bóng trong career luôn
   * có người mới mua từ nơi khác — họ vẫn mang mã CLB CŨ trong dữ liệu gốc, nên
   * tra một người bất kỳ sẽ ra sai đội khá thường xuyên. Đo trên save thật:
   * 25/28 phiếu cho đúng CLB, ba phiếu lạc là cầu thủ mới chuyển đến.
   *
   * ─── NGƯỠNG 0,6 LÀ SỐ ĐO, KHÔNG PHẢI SỐ CHỌN ─────────────────────────────
   *
   * Ngưỡng đầu để 0,4 và nó khớp NHẦM: một CLB do người chơi tự tạo ra khớp
   * "AFC Bournemouth" với 9/21 phiếu (0,43), vì chín cầu thủ trong đội vốn từ
   * Bournemouth. Hậu quả là trang hiện số áo của một CLB khác — sai, mà trông
   * hoàn toàn bình thường.
   *
   * Đo được trên save thật: CLB có sẵn 25/28 = 0,89; CLB tự tạo 9/21 = 0,43.
   * Ngưỡng 0,6 tách sạch hai trường hợp.
   *
   * Một CLB có sẵn nhưng đã thay quá 40% đội hình sẽ rơi xuống dưới ngưỡng và
   * mất số áo. Đó là hướng hỏng ĐÚNG: mất một tính năng nhỏ còn hơn khẳng định
   * sai tên CLB.
   *
   * Trả `null` khi không đội nào đạt ngưỡng, vì đoán bừa tệ hơn im lặng.
   */
  matchClub(squadIds: number[], minShare = 0.6): ClubMatch | null {
    if (squadIds.length === 0) return null;

    const votes = new Map<number, number>();
    for (const id of squadIds) {
      for (const team of this.teamsOf.get(id) ?? []) {
        votes.set(team, (votes.get(team) ?? 0) + 1);
      }
    }
    let bestTeam = -1;
    let bestN = 0;
    for (const [team, n] of votes) {
      if (n > bestN) {
        bestTeam = team;
        bestN = n;
      }
    }
    if (bestTeam < 0 || bestN < squadIds.length * minShare) return null;

    const flat = this.data.squads[String(bestTeam)] ?? [];
    const jerseyOf = new Map<number, number>();
    for (let i = 0; i < flat.length; i += 2) jerseyOf.set(flat[i], flat[i + 1]);

    const leagueId = this.data.leagueOfTeam?.[String(bestTeam)];
    return {
      teamId: bestTeam,
      name: this.data.names[String(bestTeam)] ?? null,
      league:
        leagueId === undefined ? null : (this.data.leagueNames?.[String(leagueId)] ?? null),
      jerseyOf,
      matched: bestN,
      total: squadIds.length,
    };
  }
}

let pending: Promise<Fc26World | null> | null = null;

/**
 * Tải asset. Hỏng thì trả `null` chứ không ném: mất nó làm trang nghèo đi một
 * chút, không làm hỏng việc đọc chỉ số từ save.
 */
export function loadFc26World(url = "/fc26/world.json"): Promise<Fc26World | null> {
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: WorldPayload) => Fc26World.fromPayload(json))
      .catch(() => null);
  }
  return pending;
}
```

- [ ] **Step 4: Rút `lib/fc26/names.ts` còn ba bậc**

Thay khối chú thích đầu file:

```ts
/**
 * Kho tên FC 26 — tra chỉ số tên đọc từ save ra chữ.
 *
 * ─── VỊ TRÍ TRONG CHUỖI TRA TÊN ─────────────────────────────────────────────
 *
 *   1. tên do career sinh ra, đọc thẳng từ save   (chính xác tuyệt đối)
 *   2. kho tên này, tra theo chỉ số                (bảng gốc của game)
 *   3. `#playerId`
 *
 * Trước đây có bốn bậc, và bậc 2 là một dataset công khai 1,9MB tra theo
 * `playerId`. Kho tên xếp SAU nó vì lúc ấy kho là bản SUY RA — tách tên đầy đủ
 * thành hai mảnh rồi bỏ phiếu, đạt 97,6%.
 *
 * Giờ kho tên lấy thẳng từ hai bảng gốc của game (`playernames` phủ nameid
 * 0–41.189, `dcplayernames` phủ từ 44.000), nên nó KHÔNG còn là bản suy ra và
 * lý do xếp sau không còn. Đo trên bốn save thật, chỉ save + kho tên:
 * 100,00% / 99,99% / 100,00% / 100,00%.
 *
 * Người duy nhất không tra ra mang `firstNameId = 65535`, tức chính game đánh
 * dấu "không có tên".
 */
```

Xoá nhánh asset cũ ba kho trong `Payload` và constructor — không còn bản dựng nào sinh ra nó:

```ts
interface Payload {
  builtAt: string;
  /** Kho DUY NHẤT — cả ba chỉ số tên đều trỏ vào đây. */
  pool: Packed;
  /** Luôn `true`: dựng từ bảng gốc, không phải suy ra. */
  exact?: boolean;
  count?: number;
}

export class Fc26Names {
  private readonly pool: Map<number, string>;

  private constructor(data: Payload) {
    this.pool = unpack(data.pool);
  }
  // …`resolve` dùng `this.pool` cho cả ba chỉ số.
}
```

Bỏ trường `accuracy` khỏi lớp; nó chỉ có nghĩa với bản suy ra. Sửa `scripts/diag-missing-names.ts` và `scripts/check-youth.ts` nếu chúng đọc `accuracy`.

- [ ] **Step 5: Viết lại chú thích `collapseDoubledName`**

Hàm giữ nguyên, chỉ chú thích sai. Bản cũ nói tật tên lặp là đặc điểm của
*dataset công khai*; đo được thì nó là quy ước của chính game, nên hàm này là
chuẩn hoá vĩnh viễn chứ không phải bản vá cho một nguồn cụ thể. Thay khối chú
thích trên `collapseDoubledName` trong `lib/fc26/names.ts`:

```ts
/**
 * Gộp tên bị lặp thành một.
 *
 * Cầu thủ chỉ có MỘT tên được chính GAME lưu bằng cách đặt `firstnameid` và
 * `lastnameid` bằng nhau. Bằng chứng trong bảng gốc: `#81379` có
 * `first=40399 last=40399`, ghép máy móc ra "Zothanpuia Zothanpuia".
 *
 * Trước đây chú thích ở đây nói đó là đặc điểm của dataset công khai. Sai —
 * dataset công khai chỉ chép lại quy ước của game. Nên đây là chuẩn hoá vĩnh
 * viễn: mọi nguồn lấy từ bảng gốc đều sẽ mang đúng đặc điểm này.
 *
 * Không trường hợp nào in hai lần là đúng: hoặc người đó thật sự một tên, hoặc
 * dữ liệu có vấn đề — cả hai đều nên hiện một lần.
 */
```

- [ ] **Step 6: Xoá `lib/fc26/squads.ts`**

```bash
git rm lib/fc26/squads.ts
```

- [ ] **Step 7: Chạy test, phải đạt**

```bash
npx tsx scripts/check-fc26-lib.ts && npx tsc --noEmit
```

Dự kiến: mọi dòng `ok`. `tsc` sẽ báo lỗi ở `components/save/SaveReaderClient.tsx` vì nó còn import `squads` và `db` — đó là việc của Task 6, ghi nhận rồi đi tiếp.

- [ ] **Step 8: Commit**

```bash
git add -A lib/fc26 scripts/check-fc26-lib.ts && git commit -m "Fc26World thay Fc26Squads + Fc26Database; chuoi ten con ba bac

Kho ten khong con la ban suy ra nen khong con ly do xep sau mot dataset
cong khai. Bo bac players.json.

Fc26World them clubOf() phan biet CLB voi doi tuyen quoc gia — dataset
cong khai truoc day khong co cach nao lam duoc.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Nối lại giao diện, xoá asset và script cũ

**Files:**
- Modify: `components/save/SaveReaderClient.tsx`
- Delete: `lib/fc26/db.ts`, `public/fc26/players.json`, `public/fc26/squads.json`
- Delete: `scripts/build-fc26-db.ts`, `scripts/build-fc26-names.ts`, `scripts/build-fc26-namepool.ts`, `scripts/build-fc26-squads.ts`, `scripts/build-fc26-formations.ts`, `scripts/check-squads.ts`, `scripts/fetch-msmc-db.ts`
- Modify: `scripts/check-youth.ts`, `scripts/diag-missing-names.ts`, `scripts/diag-squad-names.ts`, `scripts/diag-coverage.ts`, `scripts/diag-pool-only.ts`, `scripts/diag-ut-flag.ts` (đọc `players.json`)

**Interfaces:**
- Consumes: `Fc26World`, `loadFc26World`, `ClubMatch` (Task 5)
- Produces: không có API mới

`formations.json` giữ nguyên file hiện có; `build-fc26-formations.ts` xoá được vì Task 7 chuyển việc dựng nó vào `build-fc26-assets.ts`. **Nếu Task 7 chưa xong thì giữ lại script này** — xoá ở bước cuối của Task 7.

- [ ] **Step 1: Sửa import và state**

Trong `components/save/SaveReaderClient.tsx`:

```ts
// cũ
import { loadFc26Database } from "@/lib/fc26/db";
import { loadFc26Squads, type ClubMatch } from "@/lib/fc26/squads";
// mới
import { loadFc26World, type ClubMatch } from "@/lib/fc26/world";
```

Đổi tên state cho khớp nội dung mới (dòng ~67):

```ts
/** Mọi playerId có trong roster xuất xưởng — để nhận ra ai do career sinh ra. */
const [shippedIds, setShippedIds] = useState<Set<number> | null>(null);
```

- [ ] **Step 2: Sửa hai `useEffect`**

Prefetch (dòng ~73):

```ts
useEffect(() => {
  void loadFc26World();
  void loadFc26Names();
}, []);
```

Khối ghép tên (dòng ~88–145) — thay cả `Promise.all` bằng:

```ts
void Promise.all([loadFc26World(), loadFc26Names()]).then(([world, names]) => {
  if (!alive || !world) return;
  setShippedIds(world.shippedIds());
  /*
   * Bỏ nội dung Ultimate Team khỏi danh sách.
   *
   * Chúng là bản ghi thật, đọc ra đúng — nhưng bảng sắp theo chỉ số nên một
   * loạt người 44 tuổi chỉ số 91 nằm ngay đầu danh sách, che mất cầu thủ thật.
   * Bỏ hẳn, và BÁO SỐ LƯỢNG: danh sách hụt người mà không nói gì thì trông
   * như parser sót.
   */
  let icons = 0;
  setPlayers(
    career.players
      .filter((p) => {
        if (!world.isUltimateTeam(p.playerId)) return true;
        icons += 1;
        return false;
      })
      .map((p) => {
        // Quốc tịch tra được cho MỌI cầu thủ vì mã quốc gia đọc thẳng từ save.
        const nation = world.nation(p.nationalityId);
        const club = world.clubOf(p.playerId);
        const base = {
          ...p,
          nation,
          club: club?.name ?? null,
          league: club?.league ?? null,
        };
        if (p.nameSource === "newgen") return base;
        /*
         * Tên LUÔN tra từ kho, kể cả cầu thủ có sẵn.
         *
         * Trước đây bậc này chỉ chạy khi `players.json` không có bản ghi. Giờ
         * kho tên là bảng gốc của game nên nó đúng cho mọi người, và bậc kia
         * đã bỏ.
         */
        const fromPool = names?.resolve(p.firstNameId, p.lastNameId, p.commonNameId);
        return fromPool ? { ...base, name: fromPool, nameSource: "namePool" as const } : base;
      }),
  );
  setIconCount(icons);
});
```

- [ ] **Step 3: Sửa phần còn lại**

- Dòng ~159–161: `dbIds` → `shippedIds` trong `useMemo` của tab cầu thủ trẻ và trong mảng phụ thuộc.
- Dòng ~179: `loadFc26Squads()` → `loadFc26World()`.
- Dòng ~206: `squadDb?.matchClub(squad)` → `world?.matchClub(squad)` (đổi tên biến cho khớp).

- [ ] **Step 4: Chuyển `check-squads.ts` sang `world`, ĐỪNG xoá phép kiểm**

`scripts/check-squads.ts` là thứ duy nhất kiểm nhận diện CLB và số áo **trên
save thật**. Xoá nó cùng `squads.json` sẽ làm mất luôn phép kiểm cho trường hợp
CLB tự tạo — chỗ ngưỡng 0,4 từng khớp nhầm "AFC Bournemouth". Tạo bản thay thế
`scripts/check-fc26-club.ts`: chép nguyên `scripts/check-squads.ts`, đổi ba chỗ
và thêm hai phép kiểm mới:

```ts
// cũ
import { Fc26Squads } from "../lib/fc26/squads";
const squads = Fc26Squads.fromPayload(JSON.parse(readFileSync("public/fc26/squads.json", "utf8")));
// mới
import { Fc26World } from "../lib/fc26/world";
const world = Fc26World.fromPayload(JSON.parse(readFileSync("public/fc26/world.json", "utf8")));
```

`squads.matchClub(squad)` → `world.matchClub(squad)`. Giữ nguyên toàn bộ phần
còn lại: bất biến "KHÔNG chứa mã vị trí", vòng lặp qua các save, nhánh "CLB tự
tạo → từ chối thay vì đoán bừa", và bốn phép kiểm số áo. Thêm hai phép kiểm cho
thứ `Fc26Squads` chưa có:

```ts
check(`${name}: nhận ra giải đấu`, !!club.league, club.league ?? "");
// CLB thật phải tra ngược được từ một cầu thủ bất kỳ trong đội, và phải ra
// CLB chứ không phải đội tuyển quốc gia — thứ dataset công khai không làm được.
const sample = squad.find((id) => club.jerseyOf.has(id));
const back = sample === undefined ? null : world.clubOf(sample);
check(`${name}: clubOf tra ngược ra đúng CLB`, back?.name === club.name,
  `${back?.name ?? "null"} vs ${club.name}`);
```

Chạy:

```bash
S="/c/Users/Viet Hung/AppData/Local/EA SPORTS FC 26/settings"; npx tsx scripts/check-fc26-club.ts "$S/CmMgrC20260704192007839" "$S/CmMgrC20260729233455335" "$S/CmMgrC20260917112651768" "$S/CmMgrC20260919014703842"
```

Dự kiến: mọi dòng `ok`, và số áo phủ không thấp hơn mức `check-squads.ts` báo
trước khi đổi — chạy `check-squads.ts` một lần **trước** khi xoá để có mốc so.

- [ ] **Step 5: Xoá file cũ**

```bash
git rm lib/fc26/db.ts public/fc26/players.json public/fc26/squads.json scripts/build-fc26-db.ts scripts/build-fc26-names.ts scripts/build-fc26-namepool.ts scripts/build-fc26-squads.ts scripts/check-squads.ts scripts/fetch-msmc-db.ts
```

**Không xoá `public/fc26/players.json` trước khi `world.json` đã sinh xong ít nhất một lần** — Task 4 đọc `utIds` từ đó. Bản dựng có kiểm tra và ném lỗi rõ ràng, nhưng thứ tự vẫn quan trọng khi ai đó chạy lại từ đầu. Ghi chú này đã nằm trong chú thích của `buildWorld()`.

Sửa các script `diag-*` và `check-youth.ts` còn đọc `players.json`: chuyển sang `world.json` và `Fc26World.shippedIds()`. `diag-coverage.ts`, `diag-pool-only.ts`, `diag-ut-flag.ts` vốn là script đo để so sánh hai nguồn — khi nguồn cũ không còn thì chúng hết nhiệm vụ, xoá luôn:

```bash
git rm scripts/diag-coverage.ts scripts/diag-pool-only.ts scripts/diag-ut-flag.ts
```

Giữ `scripts/diag-pool-gap.ts` và `scripts/diag-pool-merged.ts` — chúng chẩn đoán kho tên, vẫn còn tác dụng.

- [ ] **Step 6: Kiểm kiểu và dựng thật**

```bash
npx tsc --noEmit && npm run build
```

Dự kiến: không lỗi.

- [ ] **Step 7: Kiểm trên trình duyệt**

Chạy dev server rồi thả từng file trong bốn save vào trang. Xác nhận bằng mắt:
- tab Đội hình: có tên CLB, có số áo trên áo cầu thủ
- tab Cầu thủ: không dòng nào hiện `#123456`
- tab Cầu thủ trẻ: có danh sách (hoặc câu trống đúng nghĩa với career mới)
- Console không có lỗi đỏ

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Noi giao dien vao world.json, xoa players.json va squads.json

Tai ve giam tu ~2,8MB xuong ~1MB. Ten gio LUON tra tu kho, ke ca cau thu
co san — truoc day bac do chi chay khi players.json khong co ban ghi.

Xoa nam script build roi, thay bang npm run build:fc26.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: File Lua chụp lại cho bản game sau

Mười một bảng hiện có đã đủ để pipeline chạy. File này là để chụp lại khi EA ra bản game mới — và là thứ biến "chạy Lua mỗi lần thiếu dữ liệu" thành "chạy Lua mỗi bản game".

**Files:**
- Create: `scripts/fc26-dump-base.lua`
- Modify: `scripts/build-fc26-assets.ts` (thêm `formations.json`)
- Delete: `scripts/build-fc26-formations.ts`, `scripts/fc26-dump-db.lua`

**Interfaces:**
- Consumes: danh sách bảng trong `scripts/fc26-base-tables.ts` (Task 2) — chép sang Lua vì Lua không import được TypeScript; cổng kiểm của Task 2 là thứ giữ hai danh sách không lệch.
- Produces: `dataset_fc26/base/<tên bảng>.csv`

- [ ] **Step 1: Viết script Lua**

Tạo `scripts/fc26-dump-base.lua`. Lấy nguyên khung của `scripts/fc26-dump-career.lua` — thư mục ghi thử thật, `checkpoint`, `normalize`, `csv`, `cellValue`, `fieldNames`, `try` — và đổi ba chỗ:

1. `WANT` thành mười một bảng hằng số phiên bản.
2. `OUT_DIR` ứng viên đầu tiên là `...\dataset_fc26\base`.
3. Cổng tiền kiểm **đảo chiều**:

```lua
--[[
  CỔNG CHẶN: phải ở NGOÀI career mode, kiểm trước khi ghi bất cứ thứ gì.

  Đây là cổng của `fc26-dump-career.lua` lộn ngược. Bản kia dừng khi bảng
  career RỖNG; bản này dừng khi chúng CÓ dữ liệu.

  Lý do không phải là quy ước mà là cấu trúc: thư mục `base/` nuôi những asset
  mà MỌI người dùng tải về. Chạy ngoài career thì bảng `career_*` rỗng, nên dữ
  liệu của một người chơi không có đường nào lọt vào đó — mạnh hơn bất kỳ lời
  hứa nào trong chú thích.

  Bài học đã trả giá: lượt chạy sai trạng thái trước đây thất bại đúng kiểu tệ
  nhất — im lặng. Bốn bảng bị bỏ qua, hai bảng vẫn ghi, hộp thoại báo "XONG",
  và một trong hai bảng ấy GHI ĐÈ bản export tốt. Nên kiểm trước khi mở file.
]]
do
  local loaded = {}
  for _, probe in ipairs({ "career_users", "cm_teamsheets" }) do
    local cols = fieldNames(probe)
    local rows = cols and try(GetDBTableRows, probe) or nil
    if rows and #rows > 0 then loaded[#loaded + 1] = probe end
  end

  if #loaded > 0 then
    MessageBox(
      "Dump base FC 26 - DANG O TRONG CAREER MODE",
      "Doc duoc bang career: " .. table.concat(loaded, ", ") .. "\n\n" ..
      "File nay chi duoc chay NGOAI career mode. Thu muc base/ nuoi nhung\n" ..
      "asset ma MOI nguoi dung tai ve, nen du lieu career cua ban khong duoc\n" ..
      "phep lot vao do.\n\n" ..
      "CACH LAM DUNG:\n" ..
      "  1. Thoat ve MENU CHINH (khong vao career nao)\n" ..
      "  2. Moi bat Live Editor va chay lai file nay\n\n" ..
      "Script DUNG LUON, chua ghi file nao."
    )
    return
  end
end
```

`WANT`:

```lua
--- Mười một bảng hằng số phiên bản — giống hệt `scripts/fc26-base-tables.ts`.
--- `scripts/check-fc26-base.ts` là thứ giữ hai danh sách không lệch nhau; đúng
--- kiểu lệch đó (thiếu `dcplayernames`) đã làm 15% cầu thủ mất tên.
local WANT = {
  "playernames",        -- tên, nameid 0–41.189
  "dcplayernames",      -- tên, nameid 44.000+  (bảng từng bị bỏ sót)
  "players",            -- tập id roster gốc
  "teamplayerlinks",    -- số áo, CLB
  "teams",              -- tên CLB
  "leagues",            -- tên giải, cờ quốc tế
  "leagueteamlinks",    -- CLB thuộc giải nào
  "nations",            -- tên quốc gia
  "formations",         -- hình học sân
  "default_teamsheets", -- sơ đồ nào thực sự có đội dùng (871 -> vài chục)
  "teamkits",           -- màu áo, để dành
}
```

Ứng viên thư mục ghi, thay dòng `add(...)` đầu tiên:

```lua
add("D:\\Claude\\projects\\hang-rua\\dataset_fc26\\base")
```

Tên file ra bỏ tiền tố `fc26_`: `f = openOut(tname .. ".csv")`, khớp với `BASE_TABLES[].name`.

Khối chú thích đầu file phải nêu rõ: **chụp rộng, giữ nguyên mọi cột**, vì cần thêm trường về sau thì chạy lại build chứ không mở lại game. Và **không chụp** bốn bảng lưới mặt/xương (`flesh`, `skeletal`, `fat`, `skins`, ~68MB) — chúng là lý do bản dump cũ chạy hàng chục phút.

- [ ] **Step 2: Chuyển `formations.json` vào bản dựng chung**

Thêm vào cuối `scripts/build-fc26-assets.ts`. Giữ nguyên khoá `formations` ở cấp
cao nhất (KHÔNG phải `shapes`) để `lib/fc26/formations.ts` không phải sửa:

```ts
// ── Hình học sơ đồ ──────────────────────────────────────────────────────────
/*
 * CHỈ ghi hình học sơ đồ. Bảng team sheet KHÔNG được ghi ra.
 *
 * Đội hình xuất phát của 815 đội từng nằm trong file này và trang phát lại nó.
 * Nhưng nó là ảnh chụp MỘT career tại một thời điểm, không phải hằng số theo
 * phiên bản: người chơi xếp lại đội thì trang vẫn hiện trạng thái cũ, và save
 * từ trước ngày chụp thì không khớp đội nào. Đo trên ba save của cùng một
 * người: 0/11, 11/11, 11/11.
 *
 * Vẫn phải TÍNH ra team sheet, vì chúng là thứ cho biết sơ đồ nào thực sự có
 * đội dùng — 871 sơ đồ trong bảng gốc mà chỉ vài chục được dùng thật. Bỏ bước
 * lọc này thì file phình từ 5KB lên ~130KB. Tính xong thì vứt.
 */
function buildFormations() {
  interface Formation {
    id: number;
    name: string;
    /** Mã vị trí FIFA (0–27) cho 11 ô, theo thứ tự ô của team sheet. */
    pos: number[];
    /** Toạ độ chuẩn hoá: x 0 (trái) → 1 (phải), y 0 (khung nhà) → 1 (khung đối thủ). */
    off: Array<[number, number]>;
    /** Gỡ mơ hồ khi hai sơ đồ trùng tập mã vị trí. */
    weight: number;
  }
  // `num` của `./csv` trả -1 khi ô rỗng; ở đây 0 mới là giá trị đúng cho toạ độ.
  const n0 = (v: string | undefined) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };

  const formations: Formation[] = readCsv(base("formations"))
    .map((r) => {
      const pos: number[] = [];
      const off: Array<[number, number]> = [];
      for (let i = 0; i < 11; i += 1) {
        pos.push(Math.round(n0(r[`position${i}`])));
        off.push([
          Math.round(n0(r[`offset${i}x`]) * 1000) / 1000,
          Math.round(n0(r[`offset${i}y`]) * 1000) / 1000,
        ]);
      }
      return {
        id: n0(r.formationid),
        name: r.formationname ?? "",
        pos,
        off,
        // Sơ đồ thiên về tấn công hơn thì tên thường được dùng làm tên hiển thị.
        weight: n0(r.attackers) * 100 + n0(r.midfielders),
      };
    })
    .filter((f) => f.name && f.name !== "-NONE-");

  /** Tập mã vị trí đã sắp xếp → sơ đồ tiêu biểu. */
  const byPositionSet = new Map<string, Formation>();
  for (const f of formations) {
    const key = [...f.pos].sort((a, b) => a - b).join(",");
    const cur = byPositionSet.get(key);
    // Trùng tập thì chốt theo `weight` rồi tới id — miễn là TẤT ĐỊNH, vì hình
    // học của hai sơ đồ cùng tập mã gần như giống hệt nhau.
    if (!cur || f.weight > cur.weight || (f.weight === cur.weight && f.id < cur.id)) {
      byPositionSet.set(key, f);
    }
  }

  /** playerId → (teamId → mã vị trí trong đội hình). */
  const slotOf = new Map<number, Map<number, number>>();
  for (const r of readCsv(base("teamplayerlinks"))) {
    const pid = num(r.playerid);
    const tid = num(r.teamid);
    if (pid <= 0 || tid <= 0) continue;
    if (!slotOf.has(pid)) slotOf.set(pid, new Map());
    slotOf.get(pid)!.set(tid, n0(r.position));
  }

  const used = new Set<number>();
  let unresolved = 0;
  for (const r of readCsv(base("default_teamsheets"))) {
    const team = num(r.teamid);
    if (team <= 0) continue;
    const slots: number[] = [];
    let complete = true;
    for (let i = 0; i < 11; i += 1) {
      const pid = num(r[`playerid${i}`]);
      const slot = slotOf.get(pid)?.get(team);
      if (pid <= 0 || slot === undefined) {
        complete = false;
        break;
      }
      slots.push(slot);
    }
    if (!complete) continue;
    const f = byPositionSet.get([...slots].sort((a, b) => a - b).join(","));
    if (f) used.add(f.id);
    else unresolved += 1;
  }

  const kept = formations.filter((f) => used.has(f.id));
  console.log(
    `sơ đồ: ${kept.length}/${formations.length} được dùng` +
      (unresolved ? ` (${unresolved} đội không suy được sơ đồ)` : ""),
  );
  write("formations.json", {
    builtAt,
    formations: kept.map((f) => ({ id: f.id, name: f.name, pos: f.pos, off: f.off })),
  });
}

buildFormations();
```

- [ ] **Step 3: Dựng lại, kiểm không đổi**

```bash
cp public/fc26/formations.json /tmp/formations-truoc.json && npm run build:fc26 && node -e "const a=require('fs').readFileSync('/tmp/formations-truoc.json','utf8'),b=require('fs').readFileSync('public/fc26/formations.json','utf8');const pa=JSON.parse(a).formations,pb=JSON.parse(b).formations;console.log(pa.length===pb.length?'ok  cung so so do: '+pb.length:'FAIL  '+pa.length+' -> '+pb.length)"
```

Dự kiến: `ok  cung so so do: …`

- [ ] **Step 4: Chạy toàn bộ cổng kiểm**

```bash
npm run check:fc26 && npx tsx scripts/check-fc26-lib.ts && npx tsc --noEmit
```

- [ ] **Step 5: Xoá script cũ và commit**

```bash
git rm scripts/build-fc26-formations.ts scripts/fc26-dump-db.lua && git add -A && git commit -m "fc26-dump-base.lua: mot lan chup, chay NGOAI career mode

Cong tien kiem dao chieu so voi ban career: ban kia dung khi bang career
RONG, ban nay dung khi chung CO du lieu. Khong phai quy uoc ma la cau
truc — chay ngoai career thi bang career rong, nen du lieu mot nguoi choi
khong co duong lot vao asset dung chung.

Chup rong, giu nguyen moi cot: can them truong ve sau thi chay lai build,
khong mo lai game. Khong chup bon bang luoi mat/xuong (~68MB) — do la ly
do ban dump cu chay hang chuc phut.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Kiểm đầu-cuối trên bốn save và sửa lời trên trang

**Files:**
- Create: `scripts/check-fc26-all.ts`
- Modify: `app/save-reader/page.tsx`
- Modify: `package.json` (`check:fc26` gọi cả bộ)
- Modify: `public/fc26/README.md`

**Interfaces:**
- Consumes: mọi thứ từ Task 1–7
- Produces: một lệnh `npm run check:fc26` chạy toàn bộ

- [ ] **Step 1: Viết bộ kiểm tổng**

Tạo `scripts/check-fc26-all.ts` — chạy lần lượt `check-csv`, `check-fc26-base`, `check-fc26-world`, `check-fc26-lib`, rồi `check-fc26-names` trên cả bốn save, và thêm hai phép kiểm cuối chỉ có nghĩa khi nhìn tổng thể:

```ts
/**
 * Cổng kiểm đầu-cuối: bốn save thật, toàn bộ pipeline.
 *
 *   npx tsx scripts/check-fc26-all.ts
 *
 * Hai phép kiểm cuối chỉ có nghĩa khi nhìn tổng thể và là hai thứ dễ trôi đi
 * nhất khi đổi nguồn dữ liệu: tổng cỡ asset, và SỐ NGƯỜI hiển thị. Cái thứ hai
 * quan trọng vì một thay đổi làm mất vài nghìn cầu thủ vẫn khiến mọi phép kiểm
 * về tên đạt 100% — càng ít người thì càng dễ đạt.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SAVE_DIR = join(
  homedir(), "AppData", "Local", "EA SPORTS FC 26", "settings",
);
const SAVES = [
  "CmMgrC20260704192007839",
  "CmMgrC20260729233455335",
  "CmMgrC20260917112651768",
  "CmMgrC20260919014703842",
].map((f) => join(SAVE_DIR, f));

let failed = 0;
const run = (label: string, args: string[]) => {
  console.log(`\n══ ${label} ══`);
  try {
    execFileSync("npx", ["tsx", ...args], { stdio: "inherit", shell: true });
  } catch {
    failed += 1;
  }
};

run("CSV", ["scripts/check-csv.ts"]);
run("dataset_fc26/base", ["scripts/check-fc26-base.ts"]);
run("world.json", ["scripts/check-fc26-world.ts"]);
run("lớp đọc", ["scripts/check-fc26-lib.ts"]);
run("kho tên trên 4 save", ["scripts/check-fc26-names.ts", ...SAVES]);

console.log("\n══ tổng thể ══");
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const kb = (p: string) => statSync(p).size / 1024;
const total = kb("public/fc26/names.json") + kb("public/fc26/world.json") +
  kb("public/fc26/formations.json");
// Spec hứa giảm từ ~2,8MB xuống ~1MB. Nới lên 1,4MB để không đỏ vì bản cập
// nhật đội hình làm kho tên dài thêm chút ít.
check("tổng asset dưới 1,4MB", total < 1_400, `${total.toFixed(0)} KB`);

// Không còn dấu vết nguồn công khai.
let gone = true;
for (const p of ["public/fc26/players.json", "public/fc26/squads.json"]) {
  try { statSync(p); gone = false; } catch { /* đúng: không còn */ }
}
check("players.json và squads.json đã xoá", gone);

const world = JSON.parse(readFileSync("public/fc26/world.json", "utf8"));
check("world.json có đủ năm phần", 
  !!world.squads && !!world.leagueOfTeam && !!world.nationNames &&
  !!world.shippedIds && !!world.utIds);

console.log(failed === 0 ? "\nTOÀN BỘ ĐẠT." : `\n${failed} bộ KHÔNG đạt.`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Chạy bộ kiểm tổng**

```bash
npx tsx scripts/check-fc26-all.ts
```

Dự kiến: `TOÀN BỘ ĐẠT.`

- [ ] **Step 3: Đếm số người hiển thị trên từng save**

Thêm vào `check-fc26-all.ts` một vòng in số cầu thủ còn lại sau khi lọc UT cho từng save, và so với mốc đã đo: 19.336 (`2026-09-19`) và 19.405 (`2026-09-17`). Lệch quá 1% là đỏ.

```ts
import { Fc26World } from "../lib/fc26/world";
import { parseSaveBuffer } from "../lib/save";

const w = Fc26World.fromPayload(JSON.parse(readFileSync("public/fc26/world.json", "utf8")));
/** Số người hiển thị đã đo trước khi đổi nguồn. Mốc chống trôi. */
const EXPECT: Record<string, number> = {
  CmMgrC20260917112651768: 19_405,
  CmMgrC20260919014703842: 19_336,
};
for (const [file, want] of Object.entries(EXPECT)) {
  const buf = readFileSync(join(SAVE_DIR, file));
  const doc = parseSaveBuffer(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { fileName: file },
  );
  const shown = (doc.career?.players ?? []).filter((p) => !w.isUltimateTeam(p.playerId)).length;
  check(`${file}: số người hiển thị không trôi`, Math.abs(shown - want) <= want * 0.01,
    `${shown} (mốc ${want})`);
}
```

- [ ] **Step 4: Sửa lời trên trang**

Ba câu trong `app/save-reader/page.tsx` mô tả cơ chế cũ và giờ sai.

Ở đoạn dòng ~31–41, thay câu `"Tên cầu thủ có sẵn lấy từ một cơ sở dữ liệu FC 26
nhúng theo <code>playerId</code>; tên cầu thủ do career sinh ra thì nằm ngay
trong save."` bằng:

```
Tên cầu thủ tra từ kho tên lấy thẳng hai bảng gốc của game, theo đúng chỉ số
tên mà file save mang theo — nên cầu thủ có sẵn và cầu thủ do career sinh ra
đều ra tên như nhau.
```

Ở đoạn dòng ~52–67, thay cụm `"Gần như mọi cầu thủ đều có tên: kho tên lấy thẳng
từ bảng gốc của game (41.189 mục), nên cả cầu thủ do career sinh ra cũng tra
được. Đo trên save thật còn 1–2 người trong hơn 19.000 chưa tra ra, và chỉ số
của họ vẫn đọc được đầy đủ."` bằng:

```
Mọi cầu thủ đều có tên: kho tên gộp hai bảng gốc của game (46.813 mục). Đo trên
bốn file save thật, ba save ra đủ 100%, save còn lại thiếu đúng một người mà
chính game đánh dấu là không có tên.
```

Câu ở đoạn dòng ~46–51 (`"Chỉ cần một file save…"`) giờ mạnh hơn trước — thêm
một vế vào cuối:

```
Trang không tải kèm cơ sở dữ liệu cầu thủ bên thứ ba nào; mọi thứ nó biết đều
đến từ bảng gốc của chính game.
```

Câu về Wage, đội hình gợi ý và Value giữ nguyên — vẫn đúng.

- [ ] **Step 5: Sửa `public/fc26/README.md`**

Ghi lại ranh giới nguồn dữ liệu cho đúng: ba file thay vì bốn, tất cả sinh từ `dataset_fc26/base/` bằng `npm run build:fc26`, và quy tắc "bảng `career_*`/`cm_*` không bao giờ được nướng".

- [ ] **Step 6: Gộp vào một lệnh**

Trong `package.json`, thay `check:fc26` bằng:

```json
"check:fc26": "tsx scripts/check-fc26-all.ts"
```

- [ ] **Step 7: Chạy lần cuối và commit**

```bash
npm run check:fc26 && npx tsc --noEmit && npm run build
```

```bash
git add -A && git commit -m "Cong kiem dau-cuoi tren bon save, sua loi tren trang

Hai phep kiem chi co nghia khi nhin tong the: tong co asset, va SO NGUOI
hien thi. Cai thu hai quan trong vi mot thay doi lam mat vai nghin cau
thu van khien moi phep kiem ve ten dat 100% — cang it nguoi cang de dat.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Ghi chú cho người triển khai

**Thứ tự bắt buộc.** Task 4 đọc `utIds` từ `public/fc26/players.json`, nên file đó chỉ được xoá ở Task 6, sau khi `world.json` đã sinh xong ít nhất một lần. Bản dựng có kiểm và ném lỗi rõ ràng nếu làm sai thứ tự.

**Task 7 không chặn Task 1–6.** Mười một bảng đã có sẵn trong repo, nên toàn bộ pipeline chạy được mà không phải mở game. Task 7 là công cụ chụp lại cho bản game sau.

**Không chạy Lua trong lúc triển khai.** Nếu một task có vẻ cần dữ liệu chưa có, đó là dấu hiệu `BASE_TABLES` thiếu bảng — báo lại chứ đừng mở game, vì đúng thói quen ấy là thứ kế hoạch này tồn tại để chấm dứt.

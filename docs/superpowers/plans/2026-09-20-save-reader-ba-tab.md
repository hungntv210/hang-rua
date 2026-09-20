# Save Reader gọn lại: nhớ file, ba tab, Scout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang Save Reader nhớ file save đã tải, bỏ phần mô tả dài, và gom còn ba tab — Đội hình, Cầu thủ trẻ, Scout cầu thủ (có bộ lọc).

**Architecture:** File save lưu nguyên byte vào IndexedDB rồi đọc lại bằng worker mỗi lần mở trang — không lưu kết quả đã phân tích. Bộ lọc Scout tách thành hàm thuần trong `lib/fc26/scout.ts` để có cổng kiểm tự động; `PlayerTable` chỉ còn giữ trạng thái giao diện và gọi hàm đó.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, IndexedDB (API sẵn của trình duyệt, không thêm thư viện), `tsx` cho script kiểm.

**Spec:** `docs/superpowers/specs/2026-09-20-save-reader-ba-tab-design.md`

## Global Constraints

- Ngôn ngữ giao diện và chú thích code: **tiếng Việt**.
- `lib/save/*` **không được** import `lib/fc26/*`. Chiều ngược lại thì được.
- Không thêm dependency mới. IndexedDB dùng API sẵn của trình duyệt.
- Mọi thao tác IndexedDB bọc trong `try/catch`; hỏng thì trang chạy như cũ, **không bao giờ ném lỗi ra ngoài**.
- Cột CLB giữ nguyên nhãn **"CLB gốc"** và nguyên cảnh báo hiện có. Đổi nó là việc của spec khác.
- Chạy `npx tsc --noEmit` sau mỗi task; phải sạch trước khi commit.
- Không có ESLint cấu hình trong repo này — đừng chạy `next lint`, nó sẽ mở trình hướng dẫn cài đặt.

## Review Focus

Năm trường hợp spec ngụ ý mà không task nào tự nhiên chạm tới. Mỗi dòng đã được gắn một phép kiểm vào task sở hữu đoạn code đó.

1. **Cầu thủ thiếu tuổi / chỉ số / tiềm năng (`null`)** — bộ lọc "tối thiểu" phải LOẠI họ, không được coi `null` là 0 rồi giữ lại, cũng không được cho lọt vì "không biết thì cho qua". → Task 1, Step 1.
2. **Không tìm thấy đội người chơi** (`pickSquad` trả `null`) — Scout phải hiện toàn bộ cầu thủ chứ không phải hiện rỗng hay vỡ. → Task 1, Step 1.
3. **IndexedDB không dùng được** (ẩn danh, hết dung lượng, bị chặn) — trang phải chạy đúng như hôm nay. Không kiểm tự động được; → Task 5, Step 5, lượt 5.
4. **File đã lưu không đọc được nữa** (save hỏng, hoặc phiên bản parser đổi) — phải về ô thả file kèm thông báo, không được treo ở trạng thái đang tải. Không kiểm tự động được; → Task 5, Step 5, lượt 6.
5. **Danh sách cầu thủ rỗng** (save đọc được nhưng không có bản ghi nào) — Scout không được vỡ khi chia hoặc khi lấy `min`/`max`. → Task 1, Step 1.

---

### Task 1: Bộ lọc Scout thành hàm thuần

**Files:**
- Create: `lib/fc26/scout.ts`
- Create: `scripts/check-scout.ts`
- Modify: `scripts/check-fc26-all.ts` (thêm cổng, cạnh dòng `check-formation.ts`)

**Interfaces:**
- Consumes: `SavePlayer` từ `@/lib/save/types`; `groupOf`, `PositionGroup`, `GROUP_ORDER`, `GROUP_LABEL` từ `./positions`.
- Produces:
  - `interface ScoutCriteria` với các khoá: `query: string`, `minAge: number | null`, `maxAge: number | null`, `groups: PositionGroup[]`, `minOverall: number | null`, `minPotential: number | null`, `minGrowth: number | null`, `onlyNewgen: boolean`, `excludeIds: Set<number> | null`
  - `const EMPTY_CRITERIA: ScoutCriteria`
  - `function filterPlayers(players: SavePlayer[], c: ScoutCriteria): SavePlayer[]`

- [ ] **Step 1: Viết cổng kiểm trước khi có hàm**

Tạo `scripts/check-scout.ts`:

```ts
/**
 * Kiểm bộ lọc Scout.
 *
 *   npx tsx scripts/check-scout.ts <save…>
 *
 * ─── VÌ SAO CẦN CỔNG NÀY ────────────────────────────────────────────────────
 *
 * Lọc sai mà kết quả vẫn trông hợp lý là loại lỗi không ai phát hiện bằng mắt:
 * một bảng 200 cầu thủ thiếu mất 30 người trông y hệt một bảng đúng. Nên các
 * phép kiểm dưới đây là về TÍNH CHẤT của phép lọc, không phải về con số cụ thể.
 *
 * Lời hứa trung tâm của tab Scout là "không có ai trong đội bạn ở đây". Nó
 * được kiểm với mọi bộ lọc, không chỉ bộ lọc rỗng.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { EMPTY_CRITERIA, filterPlayers, type ScoutCriteria } from "../lib/fc26/scout";
import { Fc26World } from "../lib/fc26/world";
import { pickSquad, type LineupPlayer } from "../lib/fc26/lineup";
import { parseSaveBuffer } from "../lib/save";

if (process.argv.length <= 2) {
  console.log("FAIL  không có file save nào được truyền vào — cổng này không kiểm được gì");
  process.exit(1);
}

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
};

// ── Phép kiểm trên dữ liệu dựng tay: các ô `null` ──────────────────────────
// Chạy trước save thật vì nó không phụ thuộc file nào, và vì `null` là chỗ
// bộ lọc dễ sai nhất — "không biết thì cho qua" là hành vi sai ở đây.
const fake = (over: Partial<Record<string, unknown>>) =>
  ({
    playerId: 1, name: "x", nameSource: "database", club: null, league: null,
    nation: null, position: "ST", overall: null, potential: null, birthDate: null,
    age: null, heightCm: null, weightKg: null, contractUntil: null, joinedDay: null,
    skillMoves: null, weakFoot: null, internationalReputation: null,
    attributes: [], ...over,
  }) as never;

const nulls = [fake({ playerId: 1 }), fake({ playerId: 2, age: 20, overall: 70, potential: 80 })];
check(
  "ô null bị loại bởi lọc tuổi tối thiểu",
  filterPlayers(nulls, { ...EMPTY_CRITERIA, minAge: 18 }).length === 1,
);
check(
  "ô null bị loại bởi lọc chỉ số tối thiểu",
  filterPlayers(nulls, { ...EMPTY_CRITERIA, minOverall: 60 }).length === 1,
);
check(
  "ô null bị loại bởi lọc tiềm năng tối thiểu",
  filterPlayers(nulls, { ...EMPTY_CRITERIA, minPotential: 60 }).length === 1,
);
check(
  "ô null bị loại bởi lọc còn tăng tối thiểu",
  filterPlayers(nulls, { ...EMPTY_CRITERIA, minGrowth: 5 }).length === 1,
);
check("danh sách rỗng ra rỗng, không ném", filterPlayers([], EMPTY_CRITERIA).length === 0);
check(
  "excludeIds null nghĩa là không loại ai",
  filterPlayers(nulls, { ...EMPTY_CRITERIA, excludeIds: null }).length === 2,
);

// ── Phép kiểm trên save thật ───────────────────────────────────────────────
const world = Fc26World.fromPayload(
  JSON.parse(readFileSync("public/fc26/world.json", "utf8")),
);

for (const path of process.argv.slice(2)) {
  const label = basename(path);
  const bytes = readFileSync(path);
  const doc = parseSaveBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    { fileName: label, shippedIds: world.shippedIds() },
  );
  const players = doc.career?.players ?? [];
  check(`${label}: đọc được cầu thủ`, players.length > 0, `${players.length}`);
  if (players.length === 0) continue;

  const byId = new Map<number, LineupPlayer>(
    players.map((p) => [p.playerId, { playerId: p.playerId, position: p.position, overall: p.overall }]),
  );
  const squad = pickSquad(doc.career?.squads ?? [], byId) ?? [];
  const exclude = new Set(squad);
  check(`${label}: nhận ra đội người chơi`, squad.length >= 11, `${squad.length} cầu thủ`);

  const base: ScoutCriteria = { ...EMPTY_CRITERIA, excludeIds: exclude };

  // Lời hứa trung tâm của tab, kiểm với NHIỀU bộ lọc chứ không chỉ bộ lọc rỗng.
  const variants: Array<[string, ScoutCriteria]> = [
    ["không lọc gì", base],
    ["TN ≥ 80", { ...base, minPotential: 80 }],
    ["tuổi 16–21", { ...base, minAge: 16, maxAge: 21 }],
    ["chỉ thủ môn", { ...base, groups: ["GK"] }],
    ["còn tăng ≥ 10", { ...base, minGrowth: 10 }],
    ["tìm chữ a", { ...base, query: "a" }],
  ];
  let leaked = 0;
  for (const [, c] of variants) {
    for (const p of filterPlayers(players, c)) if (exclude.has(p.playerId)) leaked += 1;
  }
  check(`${label}: không ai trong đội bạn lọt vào Scout`, leaked === 0, `${leaked} người lọt`);

  check(
    `${label}: không lọc gì = tổng trừ quân số đội`,
    filterPlayers(players, base).length === players.length - squad.length,
  );

  // Lọc chặt hơn phải ra tập con của lọc lỏng hơn.
  const loose = new Set(filterPlayers(players, { ...base, minPotential: 80 }).map((p) => p.playerId));
  const tight = filterPlayers(players, { ...base, minPotential: 80, minAge: 16, maxAge: 21 });
  check(
    `${label}: lọc chặt là tập con của lọc lỏng`,
    tight.every((p) => loose.has(p.playerId)),
    `${tight.length} ⊂ ${loose.size}`,
  );

  // Mọi người trong kết quả phải thoả mọi điều kiện đang bật.
  const strict = filterPlayers(players, { ...base, minAge: 18, maxAge: 24, minPotential: 75, groups: ["FW"] });
  check(
    `${label}: kết quả thoả mọi điều kiện đang bật`,
    strict.every(
      (p) =>
        p.age !== null && p.age >= 18 && p.age <= 24 &&
        p.potential !== null && p.potential >= 75,
    ),
    `${strict.length} cầu thủ`,
  );
}

console.log(failed === 0 ? "\nĐẠT" : `\n${failed} phép kiểm TRƯỢT`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: Chạy cổng để chắc chắn nó TRƯỢT**

```bash
npx tsx scripts/check-scout.ts
```

Kỳ vọng: lỗi biên dịch `Cannot find module '../lib/fc26/scout'`. Đó là trượt đúng kiểu — chưa có hàm.

- [ ] **Step 3: Viết `lib/fc26/scout.ts`**

```ts
/**
 * Bộ lọc cho tab Scout.
 *
 * ─── VÌ SAO TÁCH KHỎI COMPONENT ─────────────────────────────────────────────
 *
 * Lọc sai mà kết quả vẫn trông hợp lý là loại lỗi không ai phát hiện bằng mắt.
 * Để trong `PlayerTable` thì không có cách nào kiểm tự động; tách ra thì
 * `scripts/check-scout.ts` chạy nó trên save thật ở mỗi lượt `check:fc26`.
 *
 * ─── Ô TRỐNG BỊ LOẠI, KHÔNG ĐƯỢC CHO QUA ────────────────────────────────────
 *
 * Cầu thủ thiếu tuổi hoặc thiếu chỉ số thì KHÔNG thoả một điều kiện "tối
 * thiểu". "Không biết thì cho qua" nghe có vẻ rộng lượng nhưng nó đưa vào kết
 * quả đúng những dòng mà người dùng vừa bảo là không muốn thấy.
 */

import type { SavePlayer } from "@/lib/save/types";
import { groupOf, type PositionGroup } from "./positions";

export interface ScoutCriteria {
  /** Khớp tên, CLB gốc, quốc tịch, vị trí chính xác, hoặc playerId. */
  query: string;
  minAge: number | null;
  maxAge: number | null;
  /** Rỗng nghĩa là mọi tuyến, không phải "không tuyến nào". */
  groups: PositionGroup[];
  minOverall: number | null;
  minPotential: number | null;
  /** Tiềm năng trừ chỉ số hiện tại. */
  minGrowth: number | null;
  onlyNewgen: boolean;
  /** Đội của người chơi — họ đã có ở tab Đội hình rồi. `null` là không loại ai. */
  excludeIds: Set<number> | null;
}

export const EMPTY_CRITERIA: ScoutCriteria = {
  query: "",
  minAge: null,
  maxAge: null,
  groups: [],
  minOverall: null,
  minPotential: null,
  minGrowth: null,
  onlyNewgen: false,
  excludeIds: null,
};

/** `null` không bao giờ thoả một ngưỡng tối thiểu. Xem chú thích đầu file. */
const atLeast = (value: number | null, min: number | null): boolean =>
  min === null || (value !== null && value >= min);

export function filterPlayers(players: SavePlayer[], c: ScoutCriteria): SavePlayer[] {
  const needle = c.query.trim().toLowerCase();
  const groups = c.groups.length > 0 ? new Set(c.groups) : null;

  return players.filter((p) => {
    if (c.excludeIds?.has(p.playerId)) return false;
    if (c.onlyNewgen && p.nameSource !== "newgen") return false;

    if (c.minAge !== null && (p.age === null || p.age < c.minAge)) return false;
    if (c.maxAge !== null && (p.age === null || p.age > c.maxAge)) return false;

    if (!atLeast(p.overall, c.minOverall)) return false;
    if (!atLeast(p.potential, c.minPotential)) return false;
    if (c.minGrowth !== null) {
      if (p.overall === null || p.potential === null) return false;
      if (p.potential - p.overall < c.minGrowth) return false;
    }

    if (groups && !groups.has(groupOf(p.position))) return false;

    if (!needle) return true;
    return (
      (p.name?.toLowerCase().includes(needle) ?? false) ||
      (p.club?.toLowerCase().includes(needle) ?? false) ||
      (p.nation?.toLowerCase().includes(needle) ?? false) ||
      p.position.toLowerCase() === needle ||
      String(p.playerId) === needle
    );
  });
}
```

- [ ] **Step 4: Chạy cổng trên save thật, phải ĐẠT**

Save thật nằm trong thư mục cài đặt của game, và `scripts/check-fc26-all.ts`
lấy chúng từ đó. **Chỉ đọc file bắt đầu bằng `Cm`** — đó là ràng buộc của người
dùng cho thư mục này.

```bash
npx tsx scripts/check-scout.ts "$LOCALAPPDATA/EA SPORTS FC 26/settings/"Cm*
```

Kỳ vọng: mọi dòng `ok`, kết thúc `ĐẠT`.

- [ ] **Step 5: Đăng ký cổng vào bộ kiểm chung**

Trong `scripts/check-fc26-all.ts`, ngay dưới dòng `run("sơ đồ đọc từ save", …)`:

```ts
  run("bộ lọc Scout", ["scripts/check-scout.ts", ...present]);
```

- [ ] **Step 6: Chạy toàn bộ và commit**

```bash
npx tsc --noEmit
npx tsx scripts/check-fc26-all.ts
git add lib/fc26/scout.ts scripts/check-scout.ts scripts/check-fc26-all.ts
git commit -m "Bo loc Scout tach thanh ham thuan, co cong kiem"
```

---

### Task 2: `PlayerTable` dùng bộ lọc Scout

**Files:**
- Modify: `components/save/PlayerTable.tsx`

**Interfaces:**
- Consumes: `EMPTY_CRITERIA`, `filterPlayers`, `ScoutCriteria` từ Task 1; `GROUP_ORDER`, `GROUP_LABEL`, `PositionGroup` từ `@/lib/fc26/positions`.
- Produces: `PlayerTable` nhận thêm prop `excludeIds?: Set<number>`.

- [ ] **Step 1: Đổi state sang một object tiêu chí**

Thay năm dòng `useState` lọc hiện tại (`query`, `onlyNewgen`, `maxAge` — giữ `sort`, `visible`, `openId`) bằng:

```tsx
const [criteria, setCriteria] = useState<ScoutCriteria>(EMPTY_CRITERIA);
const set = <K extends keyof ScoutCriteria>(key: K, value: ScoutCriteria[K]) => {
  setCriteria((c) => ({ ...c, [key]: value }));
  setVisible(PAGE);
};
```

Thêm prop:

```tsx
export function PlayerTable({
  players,
  skipped,
  excludeIds,
}: {
  players: SavePlayer[];
  skipped?: SkippedGroups;
  /** Đội của người chơi — tab Scout loại họ ra. */
  excludeIds?: Set<number>;
}) {
```

- [ ] **Step 2: Thay thân `useMemo` bằng lời gọi hàm thuần**

```tsx
// Lọc chạy trên hơn 20.000 dòng nên bám thẳng vào ô nhập sẽ giật khi gõ.
const deferredCriteria = useDeferredValue(criteria);

const rows = useMemo(() => {
  const filtered = filterPlayers(players, {
    ...deferredCriteria,
    excludeIds: excludeIds ?? null,
  });
  const cmp: Record<SortKey, (a: SavePlayer, b: SavePlayer) => number> = {
    potential: (a, b) => (b.potential ?? -1) - (a.potential ?? -1),
    overall: (a, b) => (b.overall ?? -1) - (a.overall ?? -1),
    growth: (a, b) => growth(b) - growth(a),
    age: (a, b) => (a.age ?? 999) - (b.age ?? 999),
    name: (a, b) => (a.name ?? "").localeCompare(b.name ?? ""),
  };
  return [...filtered].sort(cmp[sort]);
}, [players, deferredCriteria, excludeIds, sort]);
```

Xoá `const deferredQuery = useDeferredValue(query);` — đã thay bằng `deferredCriteria`.

Cập nhật dòng đếm ở cuối hàng điều khiển để trừ đi phần bị loại:

```tsx
<span className="opacity-70">
  {rows.length.toLocaleString("vi-VN")} /{" "}
  {(players.length - (excludeIds?.size ?? 0)).toLocaleString("vi-VN")} cầu thủ
</span>
```

- [ ] **Step 3: Nối ô tìm kiếm và hộp kiểm hiện có vào `criteria`**

Ô tìm kiếm:

```tsx
<input
  type="search"
  value={criteria.query}
  onChange={(e) => set("query", e.target.value)}
  placeholder="Tìm theo tên, CLB gốc, quốc tịch, vị trí hoặc ID…"
  className="focus-ring min-w-[16rem] flex-1 rounded-sm border border-grid bg-void-soft px-3 py-2 text-sm text-ghost placeholder:text-mist-dim"
/>
```

Hộp kiểm newgen:

```tsx
<label className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={criteria.onlyNewgen}
    onChange={(e) => set("onlyNewgen", e.target.checked)}
  />
  Chỉ cầu thủ do career sinh ra
</label>
```

Xoá hẳn hộp kiểm "Chỉ cầu thủ từ 21 tuổi trở xuống" — Step 4 thay bằng khoảng tuổi.

- [ ] **Step 4: Thêm hàng điều khiển mới**

Đặt ngay dưới hàng điều khiển hiện có:

```tsx
<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
  <div className="flex items-center gap-2">
    <span className="text-mist-dim">Tuyến</span>
    {GROUP_ORDER.map((g) => {
      const on = criteria.groups.includes(g);
      return (
        <button
          key={g}
          type="button"
          onClick={() =>
            set("groups", on ? criteria.groups.filter((x) => x !== g) : [...criteria.groups, g])
          }
          className={`tab ${on ? "tab-active" : ""}`}
        >
          {GROUP_LABEL[g].vi}
        </button>
      );
    })}
  </div>

  <NumberFilter label="Tuổi từ" value={criteria.minAge} onChange={(v) => set("minAge", v)} />
  <NumberFilter label="đến" value={criteria.maxAge} onChange={(v) => set("maxAge", v)} />
  <NumberFilter label="CS ≥" value={criteria.minOverall} onChange={(v) => set("minOverall", v)} />
  <NumberFilter label="TN ≥" value={criteria.minPotential} onChange={(v) => set("minPotential", v)} />
  <NumberFilter label="Còn tăng ≥" value={criteria.minGrowth} onChange={(v) => set("minGrowth", v)} />

  <button type="button" onClick={() => setCriteria(EMPTY_CRITERIA)} className="tab">
    Xoá lọc
  </button>
</div>
```

Thêm component nhỏ này ở cuối file, cạnh `growth`:

```tsx
/** Ô số cho một ngưỡng lọc. Để trống nghĩa là không lọc, không phải lọc bằng 0. */
function NumberFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-mist-dim">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          const n = Number(raw);
          onChange(raw === "" || !Number.isFinite(n) ? null : n);
        }}
        className="focus-ring w-16 rounded-sm border border-grid bg-void-soft px-2 py-1 text-sm tabular-nums text-ghost"
      />
    </label>
  );
}
```

- [ ] **Step 5: Thêm import và kiểm biên dịch**

```tsx
import { EMPTY_CRITERIA, filterPlayers, type ScoutCriteria } from "@/lib/fc26/scout";
import { GROUP_LABEL, GROUP_ORDER } from "@/lib/fc26/positions";
```

```bash
npx tsc --noEmit
```

Kỳ vọng: không lỗi.

- [ ] **Step 6: Commit**

```bash
git add components/save/PlayerTable.tsx
git commit -m "PlayerTable dung bo loc Scout, them loc tuyen va cac nguong"
```

---

### Task 3: Nhớ file save trong IndexedDB

**Files:**
- Create: `lib/save/store.ts`

**Interfaces:**
- Consumes: không gì trong repo — chỉ API IndexedDB của trình duyệt.
- Produces: `interface SavedFile { bytes: ArrayBuffer; fileName: string; savedAt: number }`, và ba hàm `putSave(bytes: ArrayBuffer, fileName: string): Promise<void>`, `getSave(): Promise<SavedFile | null>`, `clearSave(): Promise<void>`.

- [ ] **Step 1: Viết module**

```ts
/**
 * Giữ lại file save gần nhất ngay trên máy người dùng.
 *
 * ─── LƯU BYTE THÔ, KHÔNG LƯU KẾT QUẢ ────────────────────────────────────────
 *
 * Lưu `SaveDocument` đã phân tích thì mở trang nhanh hơn, nhưng kết quả đó sẽ
 * đóng băng theo phiên bản parser lúc lưu. Dự án này đã dính đúng cái bẫy ảnh
 * chụp nướng sẵn hai lần: bảng team sheet trong `formations.json` phát lại
 * trạng thái cũ khi người dùng xếp lại đội hình, và seed nhiễm 55 cầu thủ học
 * viện từ một bản dump ngoài career. Một giây đọc lại là giá rẻ để không gặp
 * lại chuyện đó.
 *
 * ─── HỎNG THÌ BỎ QUA, KHÔNG BAO GIỜ NÉM ─────────────────────────────────────
 *
 * Chế độ ẩn danh, hết dung lượng, trình duyệt chặn — mọi lối đều có thật và
 * không lối nào đáng làm trang chết. Lưu hỏng thì lần sau không nhớ; đọc hỏng
 * thì hiện ô thả file. Người dùng mất tiện ích, không mất chức năng.
 *
 * Tầng này không biết gì về career hay cầu thủ. Nó chỉ giữ byte.
 */

const DB_NAME = "hang-rua-save";
const DB_VERSION = 1;
const STORE = "file";
/** Chỉ giữ một file: file mới ghi đè file cũ. */
const KEY = "latest";

export interface SavedFile {
  bytes: ArrayBuffer;
  fileName: string;
  savedAt: number;
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      // Tab khác đang giữ phiên bản cũ của DB. Không chờ vô hạn.
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(STORE, mode);
          const req = body(tx.objectStore(STORE));
          req.onsuccess = () => resolve(req.result ?? null);
          // Quá dung lượng rơi vào đây, không vào `req.onerror`.
          tx.onabort = () => resolve(null);
          req.onerror = () => resolve(null);
          tx.oncomplete = () => db.close();
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function putSave(bytes: ArrayBuffer, fileName: string): Promise<void> {
  const value: SavedFile = { bytes, fileName, savedAt: Date.now() };
  await run("readwrite", (s) => s.put(value, KEY));
}

export async function getSave(): Promise<SavedFile | null> {
  const got = await run<SavedFile>("readonly", (s) => s.get(KEY));
  // Bản ghi của phiên bản cũ có thể thiếu trường. Thà coi như không có.
  if (!got || !(got.bytes instanceof ArrayBuffer) || got.bytes.byteLength === 0) return null;
  return got;
}

export async function clearSave(): Promise<void> {
  await run("readwrite", (s) => s.delete(KEY));
}
```

- [ ] **Step 2: Kiểm biên dịch**

```bash
npx tsc --noEmit
```

Kỳ vọng: không lỗi.

Không có cổng tự động cho task này: IndexedDB không tồn tại ngoài trình duyệt, và thêm thư viện giả lập chỉ để kiểm ba hàm bọc `try/catch` thì đắt hơn giá trị nó mang lại. Kiểm tay nằm ở Task 5.

- [ ] **Step 3: Commit**

```bash
git add lib/save/store.ts
git commit -m "Giu file save gan nhat trong IndexedDB"
```

---

### Task 4: Ba tab, khôi phục lúc mở, dòng trạng thái file

**Files:**
- Modify: `components/save/SaveReaderClient.tsx`

**Interfaces:**
- Consumes: `putSave`, `getSave`, `clearSave`, `SavedFile` từ Task 3; `PlayerTable` với prop `excludeIds` từ Task 2.
- Produces: không gì cho task sau.

- [ ] **Step 1: Thu danh sách tab còn ba mục**

```tsx
type Tab = "lineup" | "youth" | "scout";

const TABS: TabItem<Tab>[] = [
  { id: "lineup", label: "Đội hình", labelJp: "布陣" },
  { id: "youth", label: "Cầu thủ trẻ", labelJp: "育成" },
  { id: "scout", label: "Scout cầu thủ", labelJp: "発掘" },
];
```

- [ ] **Step 2: Xoá bốn bảng chẩn đoán và khối thống kê**

Trong phần thân, xoá `<SaveStats doc={doc} />` và bốn nhánh `tab === "fields" | "names" | "strings" | "unknown"`. Đổi nhánh `tab === "players"` thành `tab === "scout"`, và truyền đội người chơi vào:

```tsx
{tab === "scout" ? (
  <PlayerTable
    players={players ?? []}
    skipped={skipped}
    excludeIds={squadIds}
  />
) : null}
```

`squadIds` là `Set` dựng từ đội đã nhận ra. Thêm cạnh các `useMemo` sẵn có:

```tsx
/* Đội của người chơi đã có nguyên một tab riêng — Scout là để tìm người NGOÀI đội. */
const squadIds = useMemo(
  () => (lineup ? new Set(lineup.squadIds) : undefined),
  [lineup],
);
```

Xoá các import `SaveStats`, `SaveFieldTable`, `SaveNameList`, `SaveStringList`, `SaveUnknownList`.

- [ ] **Step 3: Xoá ba nút xuất**

Xoá hàm `download` và cả khối ba nút xuất ở cuối component, cùng mọi import từ `@/lib/save/career/export` giờ đã thành thừa. Chạy `npx tsc --noEmit` để biên dịch chỉ ra import nào còn thừa.

- [ ] **Step 4: Thêm dòng thống kê mảnh**

Ngay dưới `<TabBar …>`:

```tsx
{/* Giữ lại phản hồi tốc độ, bỏ bốn thẻ lớn. */}
<p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist-dim">
  {formatCount(players?.length ?? 0)} cầu thủ · đọc trong {Math.round(doc.parseMs)}ms
</p>
```

`parseMs` là tên đúng của trường đó trong `SaveDocument` (`lib/save/types.ts:162`).

- [ ] **Step 5: Khôi phục file đã lưu lúc mở trang**

Thêm sau `useEffect` dọn worker:

```tsx
/** Đã thử khôi phục xong chưa — để không nháy ô thả file rồi mới hiện dữ liệu. */
const [restoring, setRestoring] = useState(true);
const [savedName, setSavedName] = useState<string | null>(null);
const [savedAt, setSavedAt] = useState<number | null>(null);

useEffect(() => {
  let alive = true;
  void getSave().then((got) => {
    if (!alive) return;
    if (!got) {
      setRestoring(false);
      return;
    }
    setSavedName(got.fileName);
    setSavedAt(got.savedAt);
    setRestoring(false);
    // Dựng lại `File` để đi đúng đường mà một lượt tải tay đi — không có
    // nhánh phân tích thứ hai để lệch khỏi nhánh chính.
    handleFile(new File([got.bytes], got.fileName), { persist: false });
  });
  return () => {
    alive = false;
  };
  // Chỉ chạy một lần lúc mở trang.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Đổi `handleFile` để nhận cờ và tự lưu:

```tsx
const handleFile = useCallback(
  (file: File, options?: { persist?: boolean }) => {
    setDoc(null);
    setError(null);
    setProgress(0);
    setTab("lineup");
    // …phần thân hiện có giữ nguyên…
```

Và ngay trước `void loadFc26World().then(…)`, thêm:

```tsx
    /*
     * Lưu file lại cho lần sau. Không chờ kết quả: lưu hỏng (ẩn danh, hết
     * dung lượng) không được làm chậm hay chặn việc đọc.
     */
    if (options?.persist !== false) {
      void file.arrayBuffer().then((bytes) => {
        void putSave(bytes, file.name);
        setSavedName(file.name);
        setSavedAt(Date.now());
      });
    }
```

File đã lưu mà đọc không được thì `worker.onerror` / nhánh `error` sẵn có sẽ hiện thông báo, và ô thả file vẫn ở đó — không có trạng thái treo. Kiểm tay ở Task 5 xác nhận điều này.

- [ ] **Step 6: Dòng trạng thái và nút xoá**

Ngay dưới `<SaveDropZone …>`:

```tsx
{savedName ? (
  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mist">
    <span>
      Đang giữ <strong className="text-ghost">{savedName}</strong>
      {savedAt ? ` · lưu lúc ${new Date(savedAt).toLocaleString("vi-VN")}` : ""}
    </span>
    <span className="text-mist-dim">— nằm trên máy bạn, không gửi đi đâu.</span>
    <button
      type="button"
      className="tab"
      onClick={() => {
        void clearSave();
        setSavedName(null);
        setSavedAt(null);
        setDoc(null);
      }}
    >
      Xoá
    </button>
  </p>
) : null}
```

Dùng `restoring` để không nháy: khi `restoring` là `true` và chưa có `doc`, hiện một dòng "Đang mở lại file đã lưu…" thay cho ô thả file.

- [ ] **Step 7: Thêm import, biên dịch, commit**

```tsx
import { clearSave, getSave, putSave } from "@/lib/save/store";
```

```bash
npx tsc --noEmit
git add components/save/SaveReaderClient.tsx
git commit -m "Ba tab, khoi phuc file da luu, bo bang chan doan va nut xuat"
```

---

### Task 5: Cắt mô tả, xoá component chết, nghiệm thu

**Files:**
- Modify: `app/save-reader/page.tsx`
- Delete: `components/save/SaveStats.tsx`, `SaveFieldTable.tsx`, `SaveNameList.tsx`, `SaveStringList.tsx`, `SaveUnknownList.tsx`

**Interfaces:**
- Consumes: mọi thứ từ Task 1–4.
- Produces: không gì.

- [ ] **Step 1: Cắt phần mô tả**

Trong `app/save-reader/page.tsx`, thay toàn bộ các thẻ `<p>` mô tả dưới tiêu đề bằng đúng một dòng:

```tsx
<p className="max-w-3xl text-sm text-mist">
  Đọc file save Career Mode của FC 26 ngay trên máy bạn. Không byte nào được
  gửi lên server.
</p>
```

Giữ nguyên tiêu đề và thẻ `<h1>`.

- [ ] **Step 2: Xoá năm component**

```bash
git rm components/save/SaveStats.tsx components/save/SaveFieldTable.tsx components/save/SaveNameList.tsx components/save/SaveStringList.tsx components/save/SaveUnknownList.tsx
npx tsc --noEmit
```

Kỳ vọng: không lỗi. Còn lỗi nghĩa là Task 4 bỏ sót một chỗ dùng — sửa chỗ đó, đừng khôi phục file.

- [ ] **Step 3: Tìm code chết còn lại**

```bash
grep -rn "SaveStats\|SaveFieldTable\|SaveNameList\|SaveStringList\|SaveUnknownList\|playersToCsv\|playersToJson" --include=*.ts --include=*.tsx app components lib scripts
```

Kỳ vọng: không kết quả nào ngoài `lib/save/career/export.ts`. Nếu file đó giờ không còn ai dùng, xoá luôn cả nó và cổng kiểm nào tham chiếu tới nó.

- [ ] **Step 4: Chạy toàn bộ cổng kiểm**

```bash
npx tsx scripts/check-fc26-all.ts
```

Kỳ vọng: `TOÀN BỘ ĐẠT`, và trong đó có `bộ lọc Scout`.

- [ ] **Step 5: Nghiệm thu tay trên trình duyệt**

Xoá cache build trước, vì phiên trước đã từng gặp `.next` cũ gây lỗi 500:

```bash
rm -rf .next
```

Mở dev server, rồi làm đúng ba lượt này và chụp lại:

1. Tải một save → phải hiện ba tab, dòng thống kê, và dòng "Đang giữ …".
2. Tải lại trang → phải **tự mở lại đúng save đó**, không phải thả file lần nữa.
3. Bấm **Xoá** → tải lại trang → phải về ô thả file.
4. Tải một save khác → dòng "Đang giữ" phải đổi tên, không cộng dồn.
5. **Cửa sổ ẩn danh** → tải một save → phải đọc và hiện bình thường; tải lại trang thì về ô thả file (không nhớ được là đúng, miễn là không vỡ).
6. **File đã lưu hỏng** → trong DevTools Console chạy đoạn dưới rồi tải lại trang. Phải hiện lỗi đọc file **và** ô thả file, không được treo ở "Đang mở lại…".

```js
indexedDB.open("hang-rua-save").onsuccess = (e) => {
  const db = e.target.result;
  db.transaction("file", "readwrite").objectStore("file")
    .put({ bytes: new ArrayBuffer(1024), fileName: "hong.bin", savedAt: Date.now() }, "latest");
};
```

Kiểm thêm tab Scout: bật lọc "Thủ môn" + "TN ≥ 80" và xác nhận không có ai thuộc đội của bạn trong bảng.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Cat mo ta trang, xoa nam component chan doan"
```

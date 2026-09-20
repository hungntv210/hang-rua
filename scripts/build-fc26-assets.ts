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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readCsv, num } from "./csv";
import { BASE_DIR } from "./fc26-base-tables";
import { shapeKey } from "../lib/fc26/lineup";

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
  let badFlag = 0;
  for (const r of readCsv(base("leagues"))) {
    const id = num(r.leagueid);
    if (id < 0) continue;
    if (r.leaguename) leagueNames.set(id, r.leaguename);
    /*
     * NGHI NGỜ THÌ LOẠI, không nhận — cố ý so `=== 0` chứ không `!== 1`.
     *
     * `num()` trả -1 cho ô rỗng hoặc cột thiếu, nên nếu so `!== 1` thì một
     * dòng MẤT cờ sẽ mặc định lọt vào `domesticLeagues`. Đúng đội tuyển như
     * `Men's National` mất cờ là lọt vào `leagueOfTeam` và hiện y như một CLB
     * thật — đúng triệu chứng tính năng này sinh ra để chặn ("tra CLB của
     * người này ra Brazil thay vì Real Madrid"). Mất một giải vì dữ liệu lạ
     * chỉ làm vài CLB không tra được `leagueOfTeam`; nhận nhầm một đội tuyển
     * thành CLB thì sai mà trông bình thường — hai cái không cùng giá.
     *
     * Mốc hôm nay: 48 giải, 2 quốc tế, 0 dòng cờ lạ (không phải 0/1).
     */
    const flag = num(r.isinternationalleague);
    if (flag !== 0 && flag !== 1) badFlag += 1;
    if (flag === 0) domesticLeagues.add(id);
  }
  // Bước lọc im lặng là bước sẽ bị quên là nó tồn tại — in số dòng cờ lạ ra
  // luôn, kể cả khi là 0, giống cách buildNames() báo số nameid rỗng.
  console.log(
    `giải: ${leagueNames.size} tên, ${domesticLeagues.size} trong nước, ${badFlag} dòng isinternationalleague không phải 0/1`,
  );

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
   * ─── VÌ SAO NÓ LÀ MỘT FILE ĐẦU VÀO RIÊNG ──────────────────────────────────
   *
   * Bản đầu đọc thẳng `public/fc26/players.json`, tức bản dựng đọc chính một
   * ĐẦU RA cũ của mình. Điều đó vỡ ngay khi `players.json` bị xoá: bản dựng
   * không chạy lại được nữa, và một bản dựng không tái lập được thì mọi asset
   * nó từng sinh ra thành thứ không ai dựng lại được.
   *
   * Nên tách ra `dataset_fc26/ut-ids.json` — một đầu vào thật, nằm trong thư
   * mục đầu vào, commit một lần. Nó KHÔNG nằm trong `dataset_fc26/base/` vì
   * `base/` có nghĩa hẹp: những bảng dump thẳng từ game, và cổng kiểm soi đúng
   * danh sách đó. Cái này thì không đến từ game.
   */
  const UT_PATH = "dataset_fc26/ut-ids.json";
  const legacy = JSON.parse(readFileSync(UT_PATH, "utf8")) as { ids?: number[] };
  const utIds = legacy.ids ?? [];
  if (utIds.length < 3_000) {
    throw new Error(
      `${UT_PATH} chỉ có ${utIds.length} id UT, quá ít so với 3.944 đo được. ` +
        `File này không tái tạo được từ bảng gốc của game — khôi phục từ git ` +
        `thay vì dựng lại.`,
    );
  }

  const teams = [...byTeam.keys()].sort((a, b) => a - b);
  // Tính delta MỘT LẦN rồi dùng lại — log phải báo đúng số thứ THỰC SỰ ghi
  // vào file. `delta()` khử trùng qua `new Set`, nên in `.length` của mảng
  // thô (`shipped`/`utIds`) trước dedup sẽ báo số lớn hơn thực tế nếu có id
  // trùng.
  const shippedIds = delta(shipped);
  const utIdsDelta = delta(utIds);
  console.log(
    `thế giới: ${teams.length} đội (${leagueOfTeam.size} CLB), ${links} liên kết ` +
      `(${noJersey} không số áo), ${shippedIds.length} id gốc, ${utIdsDelta.length} id UT`,
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
    shippedIds,
    utIds: utIdsDelta,
  });
}

buildWorld();

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
 * lọc này thì file phình từ 8KB lên khoảng 130KB. Tính xong thì vứt.
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
  /*
   * `num` của `./csv` trả -1 khi ô rỗng — đúng cho việc phân biệt "không có"
   * với "bằng 0", nhưng SAI cho toạ độ và mã vị trí, nơi 0 mới là giá trị mặc
   * định hợp lệ. Một `-1` lọt vào `off` sẽ đẩy cầu thủ ra ngoài sân.
   */
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

  /*
   * Gộp theo TẬP TOẠ ĐỘ, không lọc theo "đội nào đang dùng".
   *
   * Bản trước giữ lại những sơ đồ mà `default_teamsheets` dùng tới và ra 26
   * hình dạng. Nhưng trang giờ đọc sơ đồ THẬT từ save người dùng, và người
   * dùng đổi được sang bất kỳ sơ đồ nào trong game — 6 hình dạng bị bỏ sót sẽ
   * làm sơ đồ biến mất đúng lúc người ta vừa đổi sang nó.
   *
   * Gộp theo toạ độ thay vì lọc theo usage cho ra 32 hình dạng: vừa ĐỦ, vừa
   * nhỏ hơn 868 dòng gốc. 868 dòng chỉ là 32 hình dạng nhân với các bộ vai trò
   * khác nhau — cùng toạ độ, cùng mã vị trí, chỉ khác `pos<i>role`.
   */
  const byShape = new Map<string, Formation>();
  for (const f of formations) {
    const key = shapeKey(f.off.flat());
    const cur = byShape.get(key);
    // Trùng hình dạng thì chốt theo `weight` rồi tới id — miễn là TẤT ĐỊNH.
    if (!cur || f.weight > cur.weight || (f.weight === cur.weight && f.id < cur.id)) {
      byShape.set(key, f);
    }
  }

  const kept = [...byShape.values()].sort((a, b) => a.id - b.id);
  console.log(`sơ đồ: ${kept.length} hình dạng phân biệt từ ${formations.length} dòng`);
  write("formations.json", {
    builtAt,
    formations: kept.map((f) => ({ id: f.id, name: f.name, pos: f.pos, off: f.off })),
  });
}

buildFormations();

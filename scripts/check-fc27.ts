/**
 * Cổng kiểm của Save Reader FC27.
 *
 *   npm run check:fc27 -- <save FC27 mẫu> <save FC26 bất kỳ>
 *
 * Dự án không có test framework; mỗi khối dưới đây là một nhóm phép kiểm chạy
 * trên file save THẬT, đi hết đường ống từ byte thô. Save không được commit
 * (dữ liệu cá nhân), nên đường dẫn đi vào qua tham số.
 */

import { readFileSync } from "node:fs";

import { Fc27FormatError, unpackSave } from "../lib/fc27/container.ts";
import { findTable, firstDbOffset, openDatabases, readString } from "../lib/fc27/fifadb.ts";
import { readLinks, readPlayers, readTeams } from "../lib/fc27/read-tables.ts";
import { readLoans, readSectionIndex, sectionDelta } from "../lib/fc27/sections.ts";
import { buildCareer, CAREER_VERSION, isCurrentCareer, pickClubRow, readFc27 } from "../lib/fc27/read.ts";
import { FC27 } from "../lib/fc27/schema.ts";
import { Fc27Names, type Fc27Ref } from "../lib/fc27/names.ts";
import { scoutPool, toLineup, toSavePlayers } from "../lib/fc27/view.ts";
import { Fc26Names } from "../lib/fc26/names.ts";
import { parseSaveBuffer } from "../lib/save/index.ts";
import { surnameOf } from "../components/save/squad-shared.tsx";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
function throws(fn: () => unknown, kind?: new (...a: never[]) => Error): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    return kind ? e instanceof kind : e instanceof Error;
  }
}

const [samplePath, fc26Path] = process.argv.slice(2);
if (!samplePath || !fc26Path) {
  console.error("Cách dùng: npm run check:fc27 -- <save FC27> <save FC26>");
  process.exit(2);
}
const SAMPLE = new Uint8Array(readFileSync(samplePath));
const FC26SAVE = new Uint8Array(readFileSync(fc26Path));

console.log("\n=== container ===");
const blob = unpackSave(SAMPLE);
check("giải nén đúng kích thước khai báo", blob.length === 17_632_769, String(blob.length));
check("save FC26 bị từ chối", throws(() => unpackSave(FC26SAVE), Fc27FormatError));
check("file rác bị từ chối", throws(() => unpackSave(new Uint8Array(1000)), Fc27FormatError));
check("file cụt ném lỗi, không treo", throws(() => unpackSave(SAMPLE.subarray(0, 3_000_000))));

console.log("\n=== fifadb ===");
const tables = openDatabases(blob);
const czum = findTable(tables, "CZUM");
check("players (CZUM) bản ghi 156 byte", czum?.recordSize === 156, String(czum?.recordSize));
check("players có ≥ 21.000 dòng hợp lệ", (czum?.nValid ?? 0) >= 21_000, String(czum?.nValid));
check("players có trường ykFq", czum?.fields.has("ykFq") === true);
check("DB đầu tiên ở 212.023", firstDbOffset(blob) === 212_023, String(firstDbOffset(blob)));
const czum26 = findTable(openDatabases(FC26SAVE), "CZUM");
check("cùng bộ đọc mở được save FC26 (144 byte)", czum26?.recordSize === 144, String(czum26?.recordSize));
const lyxl = findTable(tables, "lyxL");
const teamName0 = lyxl ? readString(blob, lyxl, 0, lyxl.fields.get("AUsv")!) : "";
check("readString đọc được tên đội", teamName0.length > 0, teamName0);

console.log("\n=== tables ===");
const players = readPlayers(blob, tables);
const teams = readTeams(blob, tables);
const links = readLinks(blob, tables);
check("teamid 11 = Man Utd (mỏ neo ngoài)", teams.get(11) === "Man Utd", teams.get(11));
check("teamid 13 = Newcastle (mỏ neo ngoài)", (teams.get(13) ?? "").includes("Newcastle"), teams.get(13));
const bruno = players.get(212198);
check("Bruno POT 90, OVR 89", bruno?.potential === 90 && bruno?.overall === 89, `${bruno?.potential}/${bruno?.overall}`);
check("Mainoo POT 87", players.get(269136)?.potential === 87);
check("Lammens POT 88", players.get(254803)?.potential === 88);
const utd = new Set(links.filter((l) => l.teamId === 11).map((l) => l.playerId));
check("Man Utd có 39 cầu thủ", utd.size === 39, String(utd.size));
const potBelow = [...players.values()].filter((p) => p.potential < p.overall).length;
check("POT ≥ OVR ở mọi cầu thủ", potBelow === 0, String(potBelow));

console.log("\n=== loans ===");
const index = readSectionIndex(SAMPLE, blob);
check("mục lục có khối msnl", index.has("msnl"));
check("độ lệch mục lục suy ra = 1600", sectionDelta(SAMPLE, blob) === 1600, String(sectionDelta(SAMPLE, blob)));
const loans = readLoans(blob, index);
check("msnl có 733 mục", loans.length === 733, String(loans.length));
const utdLoans = loans.filter((l) => l.ownerTeamId === 11).map((l) => `${l.playerId}@${l.until}`).sort();
check(
  "cho mượn của Man Utd = Onana + Koné, hết hạn 2027-06-30",
  utdLoans.join(",") === "226753@2027-06-30,77403@2027-06-30",
  utdLoans.join(","),
);
const broken = blob.slice();
broken[(index.get("msnl") as number) + 25 + 4 * 20 + 9] = 0x07; // hỏng dấu 01 của mục thứ 5
check("msnl sai dấu thì ném lỗi, không đọc rác", throws(() => readLoans(broken, index)));

console.log("\n=== career ===");
const world = JSON.parse(readFileSync("public/fc26/world.json", "utf8")) as { nationNames: Record<string, string> };
const nationNames = new Set(Object.values(world.nationNames));
const career = readFc27(SAMPLE, { nationNames });
check("CLB = Man Utd (11)", career.club?.teamId === 11 && career.club?.name === "Man Utd", JSON.stringify(career.club));
check("sơ đồ 4-2-3-1", career.lineup?.formationName === "4-2-3-1", String(career.lineup?.formationName));
const xi = career.lineup?.slots.map((s) => s.playerId).join(",");
check(
  "XI đúng thứ tự ô",
  xi === "254803,236401,269087,203263,205988,216393,269136,243014,240243,212198,260592",
  xi,
);
check("vị trí ô 0 là GK (0), ô 10 là ST (25)", career.lineup?.slots[0].positionCode === 0 && career.lineup?.slots[10].positionCode === 25);
check("đội trưởng Bruno", career.lineup?.captainId === 212198, String(career.lineup?.captainId));
check("cả đội 39 người", career.squad.length === 39, String(career.squad.length));
const expectYouth = Array.from({ length: 10 }, (_, i) => 460003 + i).join(",");
check("học viện 460003…460012", [...career.youthIds].sort((a, b) => a - b).join(",") === expectYouth, career.youthIds.join(","));
const loanView = career.loans.map((l) => `${l.playerId}→${l.atTeamName}`).sort().join(",");
check("cho mượn kèm CLB đang mượn", loanView === "226753→Trabzonspor,77403→Lausanne-Sport", loanView);
check("không cảnh báo, không lỗi", Object.keys(career.warnings).length === 0 && Object.keys(career.errors).length === 0,
  JSON.stringify({ w: career.warnings, e: career.errors }));
check("pickClubRow bỏ đội tuyển",
  pickClubRow([{ teamId: 1354, name: "Portugal" }, { teamId: 11, name: "Man Utd" }], new Set(["Portugal"])) === 1);
const badSchema = structuredClone(FC27);
badSchema.teamsheets.slots[0] = { code: "ZZZZ", add: -1 };
const partial = readFc27(SAMPLE, { nationNames, schema: badSchema });
check("thiếu mã trường → chỉ tab Đội hình lỗi, nêu mã",
  (partial.errors.squad ?? "").includes("ZZZZ") && partial.errors.scout === undefined, JSON.stringify(partial.errors));
check("save FC26 bị từ chối ở readFc27", throws(() => readFc27(FC26SAVE), Fc27FormatError));
const noYouth = blob.slice();
const iomq = findTable(openDatabases(noYouth), "IOmq")!;
const iomqHeader = iomq.dataOffset - 36 - iomq.fields.size * 16;
noYouth[iomqHeader + 18] = 0;
noYouth[iomqHeader + 19] = 0;
const emptyAcademy = buildCareer(SAMPLE, noYouth, { nationNames });
check("học viện 0 dòng → rỗng, không lỗi", emptyAcademy.youthIds.length === 0 && emptyAcademy.errors.youth === undefined);
console.log(`thời gian: giải nén ${career.timings.unzipMs} ms, đọc ${career.timings.readMs} ms`);

console.log("\n=== names ===");
const ref = JSON.parse(readFileSync("public/fc27/ref.json", "utf8")) as Fc27Ref;
const fc26Names = Fc26Names.fromPayload(JSON.parse(readFileSync("public/fc26/names.json", "utf8")));
const names = Fc27Names.fromRef(ref, fc26Names, career.players);
const byId = new Map(career.players.map((p) => [p.id, p]));
const lam = names.nameOf(byId.get(254803)!);
check("Lammens: tên chính xác", lam.name === "Senne Lammens" && lam.source === "exact", JSON.stringify(lam));
check("Bruno: tên chính xác", names.nameOf(byId.get(212198)!).name === "Bruno Fernandes");
const youthNames = career.youthIds.map((id) => names.nameOf(byId.get(id)!));
check("học viện không có tên 'exact'", youthNames.every((n) => n.source !== "exact"), youthNames.map((n) => n.name).join(" | "));
const ghost = { ...byId.get(212198)!, id: 999_999, birthDay: 1, firstNameId: 65_000, lastNameId: 65_001, commonNameId: 0 };
check("không ra tên → #id", names.nameOf(ghost).name === "#999999", names.nameOf(ghost).name);
const lineup = toLineup(career);
check("toLineup: 11 ô, sơ đồ 4-2-3-1", lineup?.slots.length === 11 && lineup?.formationName === "4-2-3-1");
const views = toSavePlayers(career, names, ref.nations);
const brunoView = views.find((p) => p.playerId === 212198);
check("SavePlayer Bruno: CLB hiện tại + POT thô", brunoView?.club === "Man Utd" && brunoView?.potential === 90,
  JSON.stringify({ club: brunoView?.club, pot: brunoView?.potential, age: brunoView?.age }));

console.log("\n=== scout ===");
check("không còn cầu thủ nữ nào", views.every((p) => p.gender === 0));
check("Linda Caicedo (nữ) đã bị loại", !views.some((p) => p.name === "Linda Caicedo"));
check("Lamine Yamal (nam) vẫn còn", views.some((p) => p.name === "Lamine Yamal"));
const academyView = views.find((p) => p.playerId === 460012);
check("CLB dạng khoá dịch '*…' không hiện ra", !(academyView?.club ?? "").startsWith("*"), String(academyView?.club));
const pool = scoutPool(views, career);
check("Scout loại cầu thủ nữ", pool.every((p) => p.gender === 0));
check("Scout loại cả đội lẫn học viện của bạn",
  !pool.some((p) => p.playerId === 212198 || p.playerId === 460012));

console.log("\n=== review fixes ===");
// I2: asset tên hỏng → vẫn dựng được tên (#id), không kẹt.
const noAssets = Fc27Names.fromRef(null, null, career.players);
check("không có asset tên → #id, không ném", noAssets.nameOf(byId.get(212198)!).name === "#212198");
// I3: không đoán CLB.
check("hai CLB không phải đội tuyển → không chọn", pickClubRow([{ teamId: 1, name: "A" }, { teamId: 2, name: "B" }], new Set(["X"])) === null);
check("nhiều dòng mà thiếu danh sách quốc gia → không chọn",
  pickClubRow([{ teamId: 1354, name: "Portugal" }, { teamId: 11, name: "Man Utd" }], new Set()) === null);
check("chỉ một team sheet → chính là CLB", pickClubRow([{ teamId: 11, name: "Man Utd" }], new Set()) === 0);
// Nhiều team sheet của CÙNG một CLB (sheet mặc định + sheet người chơi tự tạo):
// vẫn là một CLB, và sheet chính là sheet số 0 (bản "<CLB> Default").
const SUN = "Sunderland";
check("hai sheet cùng CLB → sheet số 0",
  pickClubRow([{ teamId: 106, name: SUN, sheet: 0 }, { teamId: 106, name: SUN, sheet: 1 }], new Set(["X"])) === 0);
check("hai sheet cùng CLB, thứ tự đảo → vẫn sheet số 0",
  pickClubRow([{ teamId: 106, name: SUN, sheet: 1 }, { teamId: 106, name: SUN, sheet: 0 }], new Set(["X"])) === 1);
check("đội tuyển + hai sheet cùng CLB → sheet số 0 của CLB",
  pickClubRow([{ teamId: 1354, name: "Portugal", sheet: 0 }, { teamId: 106, name: SUN, sheet: 1 }, { teamId: 106, name: SUN, sheet: 0 }], new Set(["Portugal"])) === 2);
check("hai sheet cùng CLB mà thiếu danh sách quốc gia → vẫn chọn được",
  pickClubRow([{ teamId: 106, name: SUN, sheet: 1 }, { teamId: 106, name: SUN, sheet: 0 }], new Set()) === 1);
// I4: trường phụ của bảng cầu thủ thiếu → chỉ cảnh báo, không sập tab.
const noGender = structuredClone(FC27);
noGender.players.gender = { code: "ZZZZ", add: 0 };
const g = readFc27(SAMPLE, { nationNames, schema: noGender });
check("thiếu trường giới tính → không tab nào lỗi", Object.keys(g.errors).length === 0, JSON.stringify(g.errors));
check("… và Scout được cảnh báo nêu mã", (g.warnings.scout ?? []).some((w) => w.includes("ZZZZ")), JSON.stringify(g.warnings));
check("… không lọc được nữ nên không loại ai vì giới tính, tổng vẫn khớp",
  g.excluded.women === 0 && g.players.length + g.excluded.icons + g.excluded.junk === 21_623,
  JSON.stringify({ n: g.players.length, ...g.excluded }));
check("… scoutPool không loại hết khi thiếu giới tính",
  scoutPool(toSavePlayers(g, Fc27Names.fromRef(null, null, g.players), ref.nations), g).length > 20_000);

console.log("\n=== lọc cầu thủ không dùng được ===");
const ids = new Set(career.players.map((p) => p.id));
check("đã bỏ 2.267 cầu thủ nữ", career.excluded.women === 2267, String(career.excluded.women));
check("đã bỏ 170 icon/hero", career.excluded.icons === 170, String(career.excluded.icons));
check("đã bỏ bản ghi rác OVR ≤ 1", career.excluded.junk >= 4 && career.players.every((p) => p.overall > 1), String(career.excluded.junk));
check("icon Cole (27) bị loại", !ids.has(27));
check("Courtois (192119) ở đội biểu diễn nhưng đang đá cho CLB → giữ", ids.has(192119));
check("Bruno vẫn còn", ids.has(212198));
check("tổng khớp: còn lại + đã bỏ = 21.623",
  career.players.length + career.excluded.women + career.excluded.icons + career.excluded.junk === 21_623);

console.log("\n=== rút gọn tên trên sân ===");
check("≈ sống sót khi rút gọn họ", surnameOf("≈ Neymar Junior", "?") === "≈Junior");
check("tên FC26 không đổi", surnameOf("Lionel Messi", "?") === "Messi" && surnameOf(null, "#1") === "#1");

console.log("\n=== quét mọi save đưa thêm vào (tham số 3 trở đi) ===");
// Bất biến chung, KHÔNG ghim số liệu của một save: game xoay và đổi file liên tục.
const extras = process.argv.slice(4);
if (extras.length === 0) console.log("bỏ qua — không truyền save nào thêm");
for (const path of extras) {
  const label = path.split(/[\\/]/).pop();
  let c;
  try {
    c = readFc27(new Uint8Array(readFileSync(path)), { nationNames });
  } catch (e) {
    check(`${label}: đọc được`, false, (e as Error).message);
    continue;
  }
  const xi = c.lineup?.slots.map((s) => s.playerId) ?? [];
  const squad = new Set(c.squad.map((l) => l.playerId));
  check(`${label}: xác định được CLB`, c.club !== null, JSON.stringify(c.club));
  check(`${label}: có tên sơ đồ`, c.lineup?.formationName != null, String(c.lineup?.formationName));
  check(`${label}: 11 người ra sân, không lặp, đều thuộc đội`,
    xi.length === 11 && new Set(xi).size === 11 && xi.every((id) => squad.has(id)));
  check(`${label}: không lỗi, không cảnh báo`,
    Object.keys(c.errors).length === 0 && Object.keys(c.warnings).length === 0,
    JSON.stringify({ e: c.errors, w: c.warnings }));
  {
    const nm = Fc27Names.fromRef(ref, fc26Names, c.players, new Map(c.newgenNames));
    const pById = new Map(c.players.map((p) => [p.id, p]));
    const unnamed = c.youthIds.filter((id) => nm.nameOf(pById.get(id)!).source !== "newgen");
    check(`${label}: mọi cầu thủ học viện có tên thật từ save`, unnamed.length === 0, unnamed.join(","));
  }
  check(`${label}: POT ≥ OVR mọi cầu thủ`, c.players.every((p) => p.potential >= p.overall));
  check(`${label}: chỉ nam`, c.players.every((p) => p.gender !== 1));
  console.log(`      ${c.club?.name} · ${c.lineup?.formationName} · đội ${c.squad.length} · học viện ${c.youthIds.length} · mượn ${c.loans.length} · ${c.players.length} cầu thủ`);
}

console.log("\n=== tên cầu thủ học viện (đọc từ chữ trong save) ===");
{
  const expected = new Map<number, string>([
    [460003, "Lee Dawson"], [460004, "Adrian Gantner"], [460005, "Dylan Brook"], [460006, "Arlo Stacey"],
    [460007, "Albie Payne"], [460008, "Elliott Storey"], [460009, "Ben Newman"], [460010, "Álvaro Rivas"],
    [460011, "Julen Pinto"], [460012, "Anton Rainer"],
  ]);
  const got = new Map(career.newgenNames);
  for (const [id, name] of expected) check(`học viện ${id} = ${name}`, got.get(id) === name, String(got.get(id)));
  const viewNames = Fc27Names.fromRef(ref, fc26Names, career.players, got);
  const brunoName = viewNames.nameOf(byId.get(212198)!);
  check("tên học viện không còn dấu ≈ / ?", [...expected.keys()].every((id) => {
    const n = viewNames.nameOf(byId.get(id)!); return n.source === "newgen" && !n.name.includes("?");
  }));
  check("cầu thủ thường vẫn tên chính xác", brunoName.name === "Bruno Fernandes" && brunoName.source === "exact");
  check("bản ghi tên không có mã và không suy được thì bỏ, không gán bừa",
    ![...got.keys()].some((id) => id < 1 || id > 2_000_000));
}

console.log("\n=== phiên bản kết quả ===");
check("kết quả mang đúng số phiên bản", career.version === CAREER_VERSION, `${career.version} vs ${CAREER_VERSION}`);
check("kết quả cũ (thiếu phiên bản) bị nhận diện", !isCurrentCareer({ ...career, version: undefined }) && !isCurrentCareer(null) && isCurrentCareer(career));

console.log("\n=== timing (chỉ in, không kiểm) ===");
{
  const t = performance.now();
  const c = readFc27(SAMPLE, { nationNames });
  console.log(`FC27 (lượt 2): tổng ${Math.round(performance.now() - t)} ms — giải nén ${c.timings.unzipMs} ms, đọc ${c.timings.readMs} ms`);
  const buf = FC26SAVE.buffer.slice(FC26SAVE.byteOffset, FC26SAVE.byteOffset + FC26SAVE.byteLength) as ArrayBuffer;
  const t26 = performance.now();
  parseSaveBuffer(buf, { fileName: "fc26" });
  console.log(`FC26 parseSaveBuffer: ${Math.round(performance.now() - t26)} ms`);
}

console.log(failures === 0 ? "\nTẤT CẢ ĐẠT." : `\n${failures} MỤC KHÔNG ĐẠT.`);
process.exitCode = failures === 0 ? 0 : 1;

# Hang Rua — カメの巣穴

Trang ca nhan dang dashboard nhieu module. Module dau tien va duy nhat dang chay
la **Football**: lich thi dau, bang xep hang va so do cup cua 6 giai chau Au.

Next.js 14 (App Router), TypeScript, Tailwind. Du lieu tu football-data.org v4.

## Chay thu

```bash
npm install
cp .env.local.example .env.local   # roi dien FOOTBALL_DATA_TOKEN that
npm run dev
```

**Dung chay `npm run build` khi `next dev` dang chay.** Ca hai ghi vao cung thu
muc `.next`, ban build se ghi de chunk ma dev server dang giu tham chieu, khien
MOI route do 500 voi `Error: Cannot find module './948.js'` va CSS 404. Loi nay
khong lien quan gi toi code va khong tu khoi phuc. Cach chua: dung dev server,
`rm -rf .next`, chay `npm run dev` lai.

## Cau truc route

```
/                          dashboard Hang Rua, danh sach module
/football                  lich + ket qua Arsenal          (ISR 1h)
/football/league/[slug]    lich theo giai + loc CLB
/football/standings        BXH Premier League              (ISR 6h)
/football/standings/[slug]
/football/bracket          so do Champions League          (ISR 12h)
/football/bracket/[slug]
/save-reader               doc file save Career Mode FC 26 (tinh, parse o client)
```

Them module moi: khai bao trong `lib/modules.ts`, doi `status` sang `"live"` va
dien `href`. Sidebar va dashboard deu doc tu day, khong phai sua rieng.

## Module Save Reader

Doc file save Career Mode cua EA Sports FC 26 (`CmMgrC...`, 15-50MB). Route
`/save-reader`. Hai lop doc doc lap nhau:

1. **Bang cau thu** - bang nhi phan dong goi theo bit, hon 20.000 ban ghi. Day la
   phan chinh nguoi dung xem.
2. **Field tu mo ta** - lop su kien Career Mode (chuyen nhuong, email). Do phu
   thap la ban chat dinh dang, khong phai loi.

### Bang cau thu

Ban ghi **144 byte**, cac truong dong goi theo **bit**, thu tu LSB-first. Vi tri
tung truong nam trong `lib/save/career/schema.ts` - do la **du lieu**, khong phai
logic: patch sau doi layout thi sua file do.

**`overall` KHONG duoc luu trong file.** Da quet toan bo 1.152 vi tri bit ma
khong truong nao khop; no la ham tat dinh cua cac chi so nen EA khong luu. Trang
tinh lai bang hoi quy tuyen tinh hoc tu dataset cong khai
(`scripts/train-ovr.ts` sinh ra `lib/save/career/ovr-model.ts`). Tap giu lai 20%:
dung 80,7%, lech ≤1 99,7%. Vi day la gia tri **tinh**, UI phai noi ro dieu do.

Ba cai bay da tra gia de biet, ghi lai de khong lap:

1. **Khong dung tuong quan de chot truong.** Doc som mot bit cho
   `v = rac + 2×that`, van tuong quan ~0,96. `potential` va `dob` deu tung bi
   chot sai dung mot bit theo cach nay. Chi trung khit tuyet doi moi bat duoc.
2. **Tuong quan cao khong co nghia la dung truong.** bit 551 tuong quan 0,87 voi
   overall nen bi nhan nham la overall; hoa ra la `reactions`.
3. **Pha sai khong gay loi.** No chi lang le tra ve so vo nghia. Vi vay
   `locate.ts` neo pha bang tinh duy nhat cua `playerId`, tuyet doi khong bang
   entropy.

Ten cau thu tra tu MOT kho duy nhat: `public/fc26/names.json`, gop hai bang
goc cua game (`playernames` phu nameid 0-41.189, `dcplayernames` phu tu 44.000;
46.813 muc). Save chi luu CHI SO ten, va ca ba chi so deu tro vao kho nay, nen
cau thu co san va cau thu do career sinh ra deu ra ten cung mot duong. Khong
tra duoc thi hien `playerId` va danh dau ro - khong bia.

Do tren bon save that, chi dung save + kho ten: 100% / 99,99% / 100% / 100%.

```bash
npm run build:fc26                             # dataset_fc26/ -> public/fc26/
npm run check:fc26                             # cong kiem dau-cuoi, 4 save that
npx tsx scripts/probe-career.ts <save> [players.csv]
npx tsx scripts/train-ovr.ts <players.csv>
```

**Parse o client, trong Web Worker.** Route handler cua Next 14 khi deploy len
Vercel gioi han body ~4.5MB nen file 15-50MB hong o tang ha tang truoc khi cham
parser. Save la du lieu ca nhan, khong co ly do gui len server. Worker giu main
thread ranh nen tab khong dung hinh.

`lib/save/*` **khong cham DOM**: nho vay chay duoc bang Node de kiem chung.

```bash
npx tsx scripts/probe-save.ts                  # tu kiem tren fixture
npx tsx scripts/check-export.ts                # tu kiem phan xuat CSV/JSON
npm run check:fc26                             # gom moi cong: asset, 4 save that, 2 script Lua
npx tsx scripts/probe-save.ts <duong-dan-save> # do file that
npx tsx scripts/hex-probe.ts <file> str "PlayerID"
npx tsx scripts/hex-probe.ts <file> at 9046300 420
```

### Giai ma bang ground truth tu Live Editor

Xem `docs/superpowers/specs/2026-09-16-live-editor-decode-design.md`.

Hai script Lua, hai muc dich khac han:

* `scripts/fc26-dump-base.lua` — chup 11 bang HANG SO PHIEN BAN vao
  `dataset_fc26/base/`. Chay o MENU CHINH, NGOAI career. Mot lan moi ban game.
  Xem `public/fc26/README.md`.
* `scripts/fc26-dump-career.lua` — chup 6 bang trang thai CAREER (luong, doi
  hinh da xep). Chay TRONG career. Tuy chon, chi khi muon nap them export.

Hai cong tien kiem nguoc chieu nhau va do la chu y: ban base dung khi bang
career CO du lieu, ban career dung khi chung RONG. Khong phai quy uoc ma la
cau truc — chay ngoai career thi du lieu mot nguoi choi khong co duong lot vao
asset dung chung.

QUAN TRONG: export va file save phai CUNG MOT THOI DIEM. Vao career -> chay
script -> LUU GAME NGAY -> dung dung save do. `probe-fields.ts` co cong chan do
lai cac truong da biet chac; khong dat 98% thi no dung, vi moi ket luan sau do
se vo nghia.

```bash
npx tsx scripts/probe-fields.ts <save> dataset_fc26/base/players.csv
npx tsx scripts/probe-squads.ts <save> [dataset_fc26/base/teamplayerlinks.csv]
```

Newgen cua MOT nguoi khong bao gio duoc nuong vao asset dung chung: ID cua ho
la ID ma career nguoi khac gan cho cau thu hoan toan khac. `check-fc26-base.ts`
canh dieu nay bang ba bat bien theo NOI DUNG, khong phai theo ten file.

### Cau truc file - da xac minh tren save that

```
Field co ten       : 01 01 [uint32 len] [ten ASCII] [gia tri 4 byte]
Chuoi dung mot minh: 01 [uint32 len] [chuoi ASCII]
Dau ban ghi        : 01 [uint32 so field]
```

Ba diem trong khao sat hex ban dau **sai**, da sua theo byte that:

1. Co tag **2 byte `01 01`** truoc do dai ten.
2. Ten **khong** co NUL ket thuc - `"Sold Player Overall"` dai dung 19 (0x13),
   khao sat dem du mot.
3. **Khong co vung nao bi nen**: entropy cao nhat trong ca file la 4,5 bit/byte.
   Cac vung khong parse duoc la bang nhi phan khong nen.

Ket qua tren file that: 855 field, 369 ten khac nhau, do phu **0,2%**. Do phu
thap la ban chat dinh dang chu khong phai loi: lop field co ten chi chua phan su
kien Career Mode (chuyen nhuong, email, cot moc cau thu). 8,2MB dau file la bang
nhi phan cau thu/doi, khong co ten field di kem - ten doi ("Fluminense") chi lo
ra qua tab Chuoi roi. Trang noi ro dieu nay, neu khong nguoi dung tuong no hong.

### Quet & tai dong bo

Parser khong doc tuan tu theo ngu phap: o moi offset no thu khop, khong khop thi
tien **dung mot byte**. Nho vay mot bang nhi phan 3MB chi khien no truot tung
byte roi bat lai field ngay sau do, thay vi hong toan bo phan con lai nhu parser
tuan tu. Moi phep doc deu qua `ByteReader` co kiem bien va tra `null` khi qua
bien, nen khong co duong nao dan toi ngoai le.

Thu tu thu mau la **bat buoc**: field co ten phai thu truoc chuoi dung mot minh,
vi mau dau = mot byte `01` roi den mau sau. Nguoc lai thi moi field bi doc thanh
chuoi tro va mat gia tri.

Moi hang so phong doan nam trong `lib/save/heuristics.ts` - phan lon viec tinh
chinh ve sau la sua file do, khong phai viet lai logic.

## Nguon du lieu: football-data.org

Dang ky mien phi, khong can the tin dung:
<https://www.football-data.org/client/register>. Token gui qua email.

Goi free:

- **12 giai**, trong do app dung 6: Premier League, La Liga, Bundesliga,
  Serie A, Ligue 1, Champions League.
- **Mua hien tai** - day la ly do doi tu API-Football sang: goi free ben do chi
  cho toi mua 2024/25 nen khong bao gio lay duoc mua dang dien ra.
- **10 request/phut**, khong gioi han tong so moi ngay.
- Ty so cham vai phut, khong co ty so truc tiep tuc thi.

Goi free **khong co** Europa League, FA Cup, Carabao Cup - goi vao se nhan 403.
Ba giai nay da bi go khoi `COMPETITIONS` trong `lib/config.ts`.

Vi gioi han 10 request/phut, `lib/football-data.ts` co retry khi gap 429 va doi
dung theo header `X-RequestCounter-Reset` do API tra ve thay vi doan mo. Tong
thoi gian cho phai nho hon `staticPageGenerationTimeout` trong `next.config.mjs`
(dat 120s), neu khong Next se SIGTERM worker giua chung build.

## Hai tang kieu du lieu

`lib/types.ts` giu 2 tang:

1. `Fd*` - JSON tho cua football-data.org.
2. Kieu noi bo (`Fixture`, `StandingRow`...) - giu nguyen tu thoi dung
   API-Football.

`lib/football-data.ts` chuyen doi tang 1 sang tang 2. Nho vay `format.ts`,
`bracket.ts` va toan bo component khong phai sua khi doi nha cung cap. Neu sau
nay doi nguon lan nua, chi can viet lai mot file adapter.

## ISR va quota

Toan bo du lieu fetch trong Server Component voi ISR, nen so request phu thuoc
chu ky revalidate chu **khong** phu thuoc luot truy cap: moi giai 1 request cho
mot chu ky. Voi 10 request/phut thi su dung binh thuong khong the cham tran.

**Khong** dat `export const dynamic = "force-dynamic"` trong bat ky page nao:
Next 14 se ep moi `fetch` sang `no-store` va cache bien mat. Cung tranh
`searchParams` trong Server Component vi no lam route chuyen sang dynamic - cac
trang giai dung route tinh `[slug]` + `generateStaticParams` chinh vi ly do nay.
Bo loc CLB o trang giai chay hoan toan phia client (localStorage) nen khong ton
them request nao.

Doi thoi gian cache: sua `REVALIDATE` trong `lib/config.ts` VA literal
`export const revalidate` trong page tuong ung - Next 14 yeu cau gia tri nay la
hang so tinh, khong import duoc.

## Tieu de trang

Root layout dat `title.template = "%s | Hang Rua"`. Cac page con chi khai bao
phan rieng (`title: "Bang xep hang"`), khong ghi lai ten thuong hieu - neu ghi
se ra tieu de nhan doi.

## Bracket

- Vong xep theo **thoi gian tran som nhat**, khong theo bang ten cung: moi giai
  dat ten vong mot kieu nen xep theo ten se day Final len giua bang.
- Champions League tu 2024/25 dung "League Stage" (36 doi chung mot bang) thay
  cho vong bang. `isNotKnockout()` loai stage nay ra, neu khong 144 tran se bi
  gom thanh mot "vong" khong lo.
- Cap dau 2 luot duoc gop; ty so luot ve xoay lai theo thu tu 2 dong ten doi
  phia tren, neu khong nguoi doc se hieu nguoc ket qua.

## Huong thiet ke: 夜のカメ (Tokyo dem)

Bang mau lay TRUC TIEP tu `public/brand/tokyo-night.webp` — troi dem xanh den,
mat trang xanh dien, cua so cao oc tim, canh anh dao hong. Khong mau nao duoc
nghi ra ngoai tam anh do.

**Rang buoc khong duoc pha:** neon chi song o phan KHUNG — vien HUD, dieu huong,
chuyen canh. Phia sau bang so lieu luon la mat phang phang, tuong phan cao,
khong quang sang. Ban thiet ke giay do truoc day ghi dung ly do: trang nay de do
bang so, nen toi cong quang sang gay moi mat.

Hai mau tin hieu chi mang NGHIA, khong bao gio de trang tri:
`sakura` = "dang dien ra", `crimson` = "xuong hang".

Chu: Chakra Petch (tieu de — mat chu HUD, co dau tieng Viet) + Be Vietnam Pro
(than — giu nguyen vi duoc thiet ke rieng cho dau tieng Viet) + JetBrains Mono
(nhan HUD, so lieu).

Chi tiet ky danh nam o `components/HudFrame.tsx`: ngoac goc tu ve khi tai trang,
nhan tieng Nhat xep doc theo module dang mo, va dai ma vach o goc duoi la **tong
kiem cua duong dan hien tai** — cung mot trang luon cho cung mot vach. Do la
thong tin that ve vi tri, khong phai hoa tiet.

Chuyen canh o `components/RouteTransition.tsx`: mot vet quet chay doc man hinh,
lay tu chinh cac vet scanline tren mat trang trong banner. Doi `key` theo duong
dan la du de chay lai animation CSS — khong them thu vien.

### Motion: Framer Motion chi dung trong trang

`framer-motion` nap qua `LazyMotion` + `domMax` trong `components/MotionProvider.tsx`,
KHONG import `motion` truc tiep. Ket qua: bo tinh nang tai bat dong bo nen
**First Load JS dung chung van la 87,4 kB**, chi trang co thanh tab (`/save-reader`)
chiu +20 kB.

Quy tac: moi component phai dung `m.div`, khong duoc dung `motion.div` — dung
nham se keo lai ca goi va vo hieu hoa viec tach nho. `strict` mode cua LazyMotion
se bao loi neu lam sai.

**Khong dung Framer Motion cho chuyen route.** App Router unmount trang cu truoc
khi `AnimatePresence` kip chay exit — day la gioi han cua Next, khong phai cua
thu vien. Chuyen route van la CSS (`RouteTransition.tsx`). Framer chi dung o noi
no that su hon CSS: `layoutId` cho thanh chi bao tab truot (`TabBar.tsx`,
`FootballNav.tsx`) va `AnimatePresence` cho noi dung tab vao/ra.

### KHONG duoc re nhanh render theo useReducedMotion()

Hook nay luon tra `false` tren server. Neu cay DOM phu thuoc vao no thi may co
bat giam chuyen dong se hydrate ra cau truc khac HTML tu server — React bao
hydration mismatch va dung lai toan bo cay. Loi nay CHI lo ra khi chay that tren
may da bat tuy chon do, khong test thi khong thay.

Cach dung dung: luon render cung mot cay, chi doi THOI LUONG (`duration: 0`).
Rieng glitch thi giao han cho CSS xu ly.

### Wordmark thu phap: font but long deu khong co dau tieng Viet

`Ma Shan Zheng`, `Zhi Mang Xing`, `Liu Jian Mao Cao` la font but long that
nhung **khong co glyph dau tieng Viet**. Google Fonts VAN tra ve khoi
unicode-range `vietnamese` cho chung, nen chi nhin API la mac bay — phai do
be rong chu "u" so voi fallback moi biet.

Font duy nhat vua co net but vua co dau Viet: **Charmonman** (but long Thai).
Dancing Script, Pacifico, Lobster deu la chu viet tay monoline, khong phai but long.

Da bo hieu ung glitch o wordmark: net but va nhieu so hoa danh nhau ve ngon ngu.
Thay bang muc phat sang — mo ta lai cach chu カメ xuat hien trong banner.

**Trang thai nghi cua net but phai la DA VE XONG** (`stroke-dashoffset: 0`),
animation chay tu 320 ve 0. Lam nguoc lai thi bat cu ly do gi khien animation
khong chay deu lam net but bien mat vinh vien.

### Tuong phan: cho de truot nhat tren nen toi

Da do bang script trong trinh duyet, khong doan bang mat. Ba loi that da bat duoc:

- `mist-dim` cu (#5F6E9C) chi dat **4,03:1** ma lai dung cho nhan 10px.
- `electric` lay dung tu mat trang (#2E6BFF) dat **4,47:1** — thieu 0,03.
- Doi duoc danh dau dung chu xanh tren nen xanh: **4,27:1**. Sua bang cach chi
  doi do dam, vi nen da mang tin hieu roi.

Khi them mau moi, chay lai phep do nay truoc khi tin vao mat.

## Sticky va bien CSS

`globals.css` dinh nghia `--topbar-h` va `--nav-h`. Cac phan tu sticky bam theo
hai bien nay thay vi so cung.

Luu y da tra gia: `overflow-x-auto` va `overflow-hidden` bien phan tu thanh
scroll container o **ca hai truc**, khien `position: sticky` ben trong bam vao
no thay vi viewport va khong bao gio kich hoat. Khong co canh bao nao, build van
xanh. Neu them sticky moi, kiem tra chuoi ancestor truoc.

## Cau truc thu muc

```
app/
  page.tsx                 # dashboard Hang Rua
  layout.tsx               # font, metadata goc, Sidebar
  football/                # module Football, co layout + nav rieng
components/
  Sidebar.tsx              # dieu huong cap ung dung
  ModuleCard.tsx           # the module tren dashboard
  views/                   # async server component: fetch + render
  ...                      # component thuan trinh bay
  save/                    # module Save Reader (client-side, Web Worker)
lib/
  modules.ts               # danh sach module cua Hang Rua
  save/                    # engine doc save FC 26, khong cham DOM
  config.ts                # giai, revalidate
  football-data.ts         # client football-data.org + adapter
  bracket.ts               # gom tran -> so do loai truc tiep
  format.ts                # ngay gio, trang thai tran
  types.ts                 # kieu Fd* va kieu noi bo
```

## Deploy len Vercel

Repo PHAI de public, hoac phai cap quyen cho Vercel GitHub App doc repo nay
(github.com/settings/installations -> Vercel -> Repository access).

Neu khong, moi ban deploy tu ban thu HAI tro di se tra `readyState: BLOCKED`.
Trieu chung rat de chan doan nham:

  - ban deploy DAU TIEN cua moi project van chay binh thuong, vi CLI tai thang
    file len chu khong can doc GitHub
  - tu ban thu hai, project da gan repo nen Vercel phai tu clone -> bi chan
  - `errorCode` va `errorStep` deu TRONG, vi no bi chan TRUOC buoc build
  - dashboard khong hien canh bao nao, han muc van con nguyen

Da mat vai gio vi hai chan doan sai truoc khi tim ra: tuong la sai tai khoan
Vercel (thuc ra ca hai project nam chung mot team), roi tuong la gioi han mot
ban deploy moi project. Phep thu tach duoc bien: copy y nguyen ma nguon sang
thu muc KHONG co `.git` roi deploy hai lan -> ca hai deu READY, trong khi
project co gan git van BLOCKED.


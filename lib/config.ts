/**
 * Cau hinh giai dau va thoi gian cache.
 *
 * NGUON DU LIEU: football-data.org v4 (goi free).
 *
 * QUOTA: goi free gioi han 10 request/PHUT nhung KHONG gioi han theo ngay.
 * Toan bo du lieu lay o Server Component + ISR nen so request thuc te rat thap
 * (moi giai 1-2 request cho mot chu ky revalidate), khong the cham tran 10/phut
 * trong su dung binh thuong.
 *
 * Doi chieu voi API-Football (nguon cu): goi free ben do chi truy cap duoc mua
 * 2022-2024 nen khong bao gio lay duoc mua dang dien ra - do la ly do chuyen.
 */

/** Arsenal - doi bong duoc uu tien hien thi (id cua football-data.org). */
export const ARSENAL_TEAM_ID = 57;

export type CompetitionType = "league" | "cup";

export interface Competition {
  /** Ma giai cua football-data.org, vi du "PL", "BL1". */
  code: string;
  /** doan URL, vi du /standings/premier-league */
  slug: string;
  name: string;
  shortName: string;
  country: string;
  type: CompetitionType;
  /** Co bang xep hang khong. */
  hasStandings: boolean;
  /** Co so do loai truc tiep khong. */
  hasBracket: boolean;
}

/**
 * Sau giai nam trong goi free cua football-data.org.
 *
 * Europa League, FA Cup va Carabao Cup DA BI BO: goi free tra ve 403/404 cho
 * ba giai nay. Neu sau nay nang goi, them lai vao day va dat hasBracket: true.
 */
export const COMPETITIONS: Competition[] = [
  {
    code: "PL",
    slug: "premier-league",
    name: "Premier League",
    shortName: "PL",
    country: "England",
    type: "league",
    hasStandings: true,
    hasBracket: false,
  },
  {
    code: "CL",
    slug: "champions-league",
    name: "UEFA Champions League",
    shortName: "UCL",
    country: "Europe",
    type: "cup",
    hasStandings: true,
    hasBracket: true,
  },
  {
    code: "PD",
    slug: "la-liga",
    name: "La Liga",
    shortName: "LL",
    country: "Spain",
    type: "league",
    hasStandings: true,
    hasBracket: false,
  },
  {
    code: "BL1",
    slug: "bundesliga",
    name: "Bundesliga",
    shortName: "BL",
    country: "Germany",
    type: "league",
    hasStandings: true,
    hasBracket: false,
  },
  {
    code: "SA",
    slug: "serie-a",
    name: "Serie A",
    shortName: "SA",
    country: "Italy",
    type: "league",
    hasStandings: true,
    hasBracket: false,
  },
  {
    code: "FL1",
    slug: "ligue-1",
    name: "Ligue 1",
    shortName: "L1",
    country: "France",
    type: "league",
    hasStandings: true,
    hasBracket: false,
  },
];

/** Giai mac dinh cho tung trang. */
export const DEFAULT_FIXTURES_SLUG = "premier-league";
export const DEFAULT_STANDINGS_SLUG = "premier-league";
export const DEFAULT_BRACKET_SLUG = "champions-league";

export const STANDINGS_COMPETITIONS = COMPETITIONS.filter((c) => c.hasStandings);
export const BRACKET_COMPETITIONS = COMPETITIONS.filter((c) => c.hasBracket);

export function getCompetitionBySlug(slug: string): Competition | undefined {
  return COMPETITIONS.find((c) => c.slug === slug);
}

/**
 * Thoi gian cache (giay) cho tung loai du lieu.
 *
 * LUU Y: cac trang phai khai bao `export const revalidate = <so nguyen>` bang
 * literal vi Next 14 phan tich tinh gia tri nay luc build. Cac hang so duoi day
 * la nguon su that cho lop fetch trong lib/football-data.ts; khi doi o day nho
 * doi luon literal trong cac file page.tsx tuong ung ben duoi thu muc app/.
 */
export const REVALIDATE = {
  /** Lich thi dau: 1 gio. */
  fixtures: 60 * 60,
  /** Bang xep hang: 6 gio. */
  standings: 60 * 60 * 6,
  /** Bracket cup: 12 gio. */
  bracket: 60 * 60 * 12,
} as const;

/**
 * So vong toi da hien thi tren bracket, tinh tu chung ket lui lai.
 * Champions League hien co 5 vong loai truc tiep (play-off -> chung ket).
 */
export const BRACKET_MAX_ROUNDS = 8;

/** So tran sap toi hien thi tren trang lich thi dau. */
export const UPCOMING_LIMIT = 12;
/** So tran da dau gan nhat hien thi. */
export const RECENT_LIMIT = 6;

/** Khoa localStorage luu danh sach CLB nguoi dung da chon o moi giai. */
export const FAVORITES_STORAGE_PREFIX = "bdh:favorites:";

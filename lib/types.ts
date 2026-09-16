/**
 * Hai tang kieu du lieu:
 *
 *   1. Fd*  - dung y nguyen JSON cua football-data.org v4 (chi khai bao truong
 *             ma app thuc su doc).
 *   2. Kieu noi bo (Fixture, StandingRow...) - giu nguyen tu thoi dung
 *             API-Football. lib/football-data.ts chuyen doi tu (1) sang (2),
 *             nho vay format.ts, bracket.ts va toan bo component khong phai
 *             sua theo khi doi nha cung cap.
 */

// ---------------------------------------------------------------------------
// 1. Kieu raw cua football-data.org v4
// ---------------------------------------------------------------------------

export interface FdTeam {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}

export interface FdScoreLine {
  home: number | null;
  away: number | null;
}

/**
 * Trang thai tran cua football-data.org. Khac hoan toan bo ma viet tat cua
 * API-Football nen phai anh xa lai (xem STATUS_MAP trong football-data.ts).
 */
export type FdMatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED"
  | "AWARDED";

/**
 * Vong dau. Uu diem lon so voi API-Football: day la enum co dinh, khong phai
 * chuoi tu do kieu "Round of 16" / "1st Qualifying Round" phai doan bang regex.
 */
export type FdStage =
  | "REGULAR_SEASON"
  | "GROUP_STAGE"
  | "LEAGUE_STAGE"
  | "PLAYOFFS"
  | "PLAY_OFF_ROUND"
  | "LAST_16"
  | "ROUND_OF_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "THIRD_PLACE"
  | "FINAL"
  | string;

export interface FdMatch {
  id: number;
  utcDate: string;
  status: FdMatchStatus;
  matchday: number | null;
  stage: FdStage;
  group: string | null;
  /** Chi co khi tran dang dien ra. */
  minute?: number | null;
  competition?: {
    id: number;
    name: string;
    code: string;
    emblem?: string | null;
  };
  season?: { id: number; startDate: string; endDate: string };
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: string;
    fullTime: FdScoreLine;
    halfTime: FdScoreLine;
    extraTime?: FdScoreLine;
    penalties?: FdScoreLine;
  };
}

export interface FdMatchesResponse {
  resultSet?: { count: number };
  competition?: { id: number; name: string; code: string; emblem?: string };
  matches: FdMatch[];
}

export interface FdStandingRow {
  position: number;
  team: FdTeam;
  playedGames: number;
  /** Chuoi dang "W,W,D,L,W" - dau phay, khac API-Football ("WWDLW"). */
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface FdStandingGroup {
  stage: string;
  /** TOTAL / HOME / AWAY - app chi dung TOTAL. */
  type: "TOTAL" | "HOME" | "AWAY";
  group: string | null;
  table: FdStandingRow[];
}

export interface FdStandingsResponse {
  competition: { id: number; name: string; code: string; emblem?: string };
  season: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number | null;
  };
  standings: FdStandingGroup[];
}

/** Loi tra ve khi token sai / giai khong nam trong goi. */
export interface FdError {
  message: string;
  errorCode: number;
}

// ---------------------------------------------------------------------------
// 2. Kieu noi bo cua app
// ---------------------------------------------------------------------------

export interface TeamRef {
  id: number;
  name: string;
  logo: string;
  winner?: boolean | null;
}

export interface FixtureStatus {
  long: string;
  short: string;
  elapsed: number | null;
}

export interface ScoreLine {
  home: number | null;
  away: number | null;
}

export interface Fixture {
  fixture: {
    id: number;
    date: string;
    /** Giay (khong phai mili giay) - format.ts sap xep theo truong nay. */
    timestamp: number;
    status: FixtureStatus;
  };
  league: {
    name: string;
    country: string;
    logo: string;
    season: number;
    /** Ten vong da dich sang dang doc duoc, vi du "Round of 16", "Vong 12". */
    round: string;
  };
  teams: { home: TeamRef; away: TeamRef };
  goals: ScoreLine;
  score: {
    halftime: ScoreLine;
    fulltime: ScoreLine;
    extratime: ScoreLine;
    penalty: ScoreLine;
  };
}

export interface StandingStats {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: { for: number; against: number };
}

export interface StandingRow {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  /** Da chuan hoa ve dang "WWDLW" de StandingsTable cat 5 ky tu cuoi. */
  form: string | null;
  description: string | null;
  all: StandingStats;
}

export interface LeagueStandings {
  league: {
    name: string;
    country: string;
    logo: string;
    season: number;
    /** Moi phan tu la mot bang (giai VD chi co 1, cup co the nhieu). */
    standings: StandingRow[][];
  };
}

/** Mot CLB dung cho bo loc "CLB yeu thich". */
export interface ClubOption {
  id: number;
  name: string;
  logo: string;
}

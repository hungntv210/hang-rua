import "server-only";

import { REVALIDATE } from "./config";
import type {
  ClubOption,
  FdMatch,
  FdMatchesResponse,
  FdStandingRow,
  FdStandingsResponse,
  FdTeam,
  Fixture,
  LeagueStandings,
  StandingRow,
} from "./types";

const BASE_URL = "https://api.football-data.org/v4";

export class FootballDataError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FootballDataError";
    this.status = status;
  }
}

function resolveToken(): string {
  const token = process.env.FOOTBALL_DATA_TOKEN?.trim();
  if (!token) {
    throw new FootballDataError(
      "Thieu FOOTBALL_DATA_TOKEN trong .env.local. Dang ky mien phi tai https://www.football-data.org/client/register",
    );
  }
  return token;
}

/**
 * Goi free gioi han 10 request/PHUT (khong gioi han theo ngay). Khi Next
 * prerender nhieu trang song song luc build, rat de cham tran va an 429.
 * API tra ve header `X-RequestCounter-Reset` = so giay con lai cua cua so hien
 * tai, nen doi dung bang do thay vi doan mo.
 */
const MAX_RETRIES = 3;
const FALLBACK_RETRY_SECONDS = 30;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

// ---------------------------------------------------------------------------
// Bo dieu tiet nhip goi
// ---------------------------------------------------------------------------

/**
 * Chi retry sau khi da an 429 la khong du: mot build sach can ~12 request nen
 * chac chan vuot tran, va cac trang cho nhau chong cheo den muc co trang can
 * luot retry (do thuc te: 2/22 trang bake ra 429 khi chay song song, van con
 * 1/22 khi da ha xuong 1 worker).
 *
 * Nen chu dong giu nhip truoc khi goi. Giu 9 chu khong 9 = 10 de chua bien cho
 * cac request khong di qua day (vi du kiem tra thu cong).
 *
 * Pham vi: bien module, chi dung chung trong MOT tien trinh. Vi vay
 * next.config.mjs dat `experimental.cpus = 1` - nhieu worker se co bo dem rieng
 * va cong lai van vuot tran.
 */
const RATE_LIMIT = 9;
const RATE_WINDOW_MS = 60_000;

/** Moc thoi gian cac request da phat trong cua so hien tai. */
const sentAt: number[] = [];

/** Xep hang tuan tu, neu khong nhieu request cung doc/ghi `sentAt` mot luc. */
let queue: Promise<void> = Promise.resolve();

async function takeSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (sentAt.length > 0 && now - sentAt[0] >= RATE_WINDOW_MS) {
      sentAt.shift();
    }

    if (sentAt.length < RATE_LIMIT) {
      sentAt.push(now);
      return;
    }

    // Doi den khi moc cu nhat roi khoi cua so, cong them 250ms cho chac.
    await sleep(RATE_WINDOW_MS - (now - sentAt[0]) + 250);
  }
}

function throttle(): Promise<void> {
  queue = queue.then(takeSlot, takeSlot);
  return queue;
}

async function fetchWithRetry(
  url: URL,
  token: string,
  revalidate: number,
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    await throttle();

    const res = await fetch(url, {
      headers: { "X-Auth-Token": token },
      next: { revalidate },
    });

    if (res.status !== 429 || attempt >= MAX_RETRIES) {
      return res;
    }

    const reset = Number.parseInt(
      res.headers.get("X-RequestCounter-Reset") ?? "",
      10,
    );
    const waitSeconds =
      Number.isFinite(reset) && reset > 0 ? reset : FALLBACK_RETRY_SECONDS;
    await sleep((waitSeconds + 1) * 1000);
  }
}

async function request<T>(
  path: string,
  revalidate: number,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const token = resolveToken();
  const url = new URL(`${BASE_URL}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }

  const res = await fetchWithRetry(url, token, revalidate);

  if (!res.ok) {
    let detail = "";
    if (res.status === 403) {
      detail =
        " Giai nay khong nam trong goi free (Europa League, FA Cup va Carabao Cup deu bi chan).";
    } else if (res.status === 429) {
      detail = ` Da thu lai ${MAX_RETRIES} lan van bi chan boi gioi han 10 request/phut.`;
    } else if (res.status === 400 || res.status === 401) {
      detail = " Kiem tra lai FOOTBALL_DATA_TOKEN trong .env.local.";
    }
    throw new FootballDataError(
      `football-data.org tra ve ${res.status} ${res.statusText}.${detail}`,
      res.status,
    );
  }

  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Chuyen doi tu kieu cua football-data.org sang kieu noi bo
// ---------------------------------------------------------------------------

/**
 * Anh xa trang thai sang bo ma viet tat ma format.ts dang dung. Giu nguyen bo
 * ma cu de STATUS_LABELS, isLive() va isFinished() khong phai sua.
 */
const STATUS_MAP: Record<string, string> = {
  SCHEDULED: "NS",
  TIMED: "NS",
  IN_PLAY: "LIVE",
  PAUSED: "HT",
  FINISHED: "FT",
  POSTPONED: "PST",
  SUSPENDED: "SUSP",
  CANCELLED: "CANC",
  AWARDED: "AWD",
};

/**
 * Ten vong doc duoc. Voi giai vo dich quoc gia thi dung so vong ("Vong 12");
 * voi cup thi dich enum stage sang ten tieng Anh trung khop voi ROUND_ORDER
 * trong bracket.ts de thu tu vong duoc sap dung.
 */
const STAGE_NAMES: Record<string, string> = {
  GROUP_STAGE: "Group Stage",
  LEAGUE_STAGE: "League Stage",
  PLAYOFFS: "Play-offs",
  PLAY_OFF_ROUND: "Play-offs",
  LAST_16: "Round of 16",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "3rd Place Final",
  FINAL: "Final",
};

function roundName(match: FdMatch): string {
  if (match.stage === "REGULAR_SEASON") {
    // Chuỗi này hiện thẳng ra giao diện nên phải có dấu. Nếu đổi cách viết ở
    // đây, sửa luôn isNotKnockout() trong lib/bracket.ts — hàm đó nhận diện
    // vòng của giải vô địch quốc gia bằng chính tiền tố này.
    return match.matchday ? `Vòng ${match.matchday}` : "Vòng đấu";
  }
  return STAGE_NAMES[match.stage] ?? match.stage.replaceAll("_", " ");
}

function toTeamRef(team: FdTeam) {
  return {
    id: team.id,
    // shortName gon hon nhieu tren mobile: "Arsenal" thay vi "Arsenal FC".
    name: team.shortName || team.name,
    logo: team.crest ?? "",
  };
}

const EMPTY_SCORE = { home: null, away: null };

export function toFixture(match: FdMatch): Fixture {
  return {
    fixture: {
      id: match.id,
      date: match.utcDate,
      timestamp: Math.floor(Date.parse(match.utcDate) / 1000),
      status: {
        long: match.status,
        short: STATUS_MAP[match.status] ?? "NS",
        elapsed: match.minute ?? null,
      },
    },
    league: {
      name: match.competition?.name ?? "",
      country: "",
      logo: match.competition?.emblem ?? "",
      season: match.season ? Number(match.season.startDate.slice(0, 4)) : 0,
      round: roundName(match),
    },
    teams: { home: toTeamRef(match.homeTeam), away: toTeamRef(match.awayTeam) },
    goals: match.score.fullTime,
    score: {
      halftime: match.score.halfTime ?? EMPTY_SCORE,
      fulltime: match.score.fullTime,
      extratime: match.score.extraTime ?? EMPTY_SCORE,
      penalty: match.score.penalties ?? EMPTY_SCORE,
    },
  };
}

function toStandingRow(row: FdStandingRow): StandingRow {
  return {
    rank: row.position,
    team: toTeamRef(row.team),
    points: row.points,
    goalsDiff: row.goalDifference,
    group: "",
    // "W,W,D,L,W" -> "WWDLW" cho khop cach StandingsTable cat 5 ky tu cuoi.
    form: row.form ? row.form.replaceAll(",", "").replaceAll(" ", "") : null,
    // football-data.org khong cung cap mo ta vung (du vong bang / xuong hang).
    description: null,
    all: {
      played: row.playedGames,
      win: row.won,
      draw: row.draw,
      lose: row.lost,
      goals: { for: row.goalsFor, against: row.goalsAgainst },
    },
  };
}

// ---------------------------------------------------------------------------
// Cac ham cong khai
// ---------------------------------------------------------------------------

/** Toan bo tran cua mot doi trong mua hien tai - 1 request. */
export async function getTeamMatches(teamId: number): Promise<Fixture[]> {
  const data = await request<FdMatchesResponse>(
    `/teams/${teamId}/matches`,
    REVALIDATE.fixtures,
  );
  return (data.matches ?? []).map(toFixture);
}

/** Toan bo tran cua mot giai trong mua hien tai - 1 request. */
export async function getCompetitionMatches(
  code: string,
  revalidate: number = REVALIDATE.fixtures,
): Promise<Fixture[]> {
  const data = await request<FdMatchesResponse>(
    `/competitions/${code}/matches`,
    revalidate,
  );
  return (data.matches ?? []).map(toFixture);
}

/** Bang xep hang cua mot giai. */
export async function getStandings(
  code: string,
): Promise<LeagueStandings | null> {
  const data = await request<FdStandingsResponse>(
    `/competitions/${code}/standings`,
    REVALIDATE.standings,
  );

  // Chi lay bang TOTAL; HOME/AWAY la cung mot giai nhin theo goc khac, hien ca
  // ba se ra ba bang trung lap.
  const groups = (data.standings ?? []).filter((g) => g.type === "TOTAL");
  if (groups.length === 0) return null;

  return {
    league: {
      name: data.competition.name,
      country: "",
      logo: data.competition.emblem ?? "",
      season: Number(data.season.startDate.slice(0, 4)),
      standings: groups.map((g) => g.table.map(toStandingRow)),
    },
  };
}

/** Danh sach CLB cua mot giai, dung cho bo loc "CLB yeu thich". */
export function clubsFromFixtures(fixtures: Fixture[]): ClubOption[] {
  const seen = new Map<number, ClubOption>();
  for (const fixture of fixtures) {
    for (const team of [fixture.teams.home, fixture.teams.away]) {
      if (!seen.has(team.id)) {
        seen.set(team.id, { id: team.id, name: team.name, logo: team.logo });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

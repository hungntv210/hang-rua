import type { Fixture } from "./types";

/**
 * Cac vong duoc xep theo THOI GIAN tran som nhat, khong theo bang ten cung.
 *
 * Ly do: moi giai dat ten vong mot kieu. FA Cup co "Extra Preliminary Round",
 * "1st Round Qualifying", "3rd Round Replays"... Neu dua vao danh sach ten thi
 * moi ten la deu rot xuong cuoi va Final bi day len tren. Xep theo ngay thi
 * dung voi moi giai vi cup luon da vong som truoc.
 *
 * Bang ten duoi day chi con dung lam tie-break khi 2 vong bat dau cung ngay.
 */
const ROUND_ORDER = [
  "Preliminary Round",
  "1st Qualifying Round",
  "2nd Qualifying Round",
  "3rd Qualifying Round",
  "Play-offs",
  "Play-off Round",
  "Knockout Round Play-offs",
  "Round of 128",
  "Round of 64",
  "Round of 32",
  "Round of 16",
  "8th Finals",
  "Quarter-finals",
  "Semi-finals",
  "3rd Place Final",
  "Final",
];

const ROUND_RANK = new Map(ROUND_ORDER.map((name, i) => [name.toLowerCase(), i]));

/**
 * Cac tran KHONG thuoc so do loai truc tiep.
 *
 * Ke tu mua 2024/25, Champions League bo vong bang va dung "League Stage" -
 * mot bang xep hang chung 36 doi. Neu khong loai ra thi 144 tran vong nay se
 * bi gom thanh mot "vong" khong lo trong bracket.
 *
 * "Vong N" la ten do roundName() sinh ra cho giai vo dich quoc gia (stage
 * REGULAR_SEASON), cung khong phai loai truc tiep.
 */
function isNotKnockout(round: string): boolean {
  // "Vòng N" là tên do roundName() sinh ra cho giải vô địch quốc gia. Chấp nhận
  // cả bản không dấu để dữ liệu cũ còn nằm trong cache không lọt vào bracket.
  return /group|league stage/i.test(round) || /^vòng\b|^vong\b/i.test(round);
}

export interface BracketTie {
  /** Khoa on dinh cho cap dau (2 doi, co the da 2 luot). */
  key: string;
  /** Cac luot dau cua cap nay, som truoc. */
  legs: Fixture[];
}

export interface BracketRound {
  name: string;
  ties: BracketTie[];
  /** Tran som nhat cua vong, dung de xep thu tu. */
  startsAt: number;
}

export interface BracketResult {
  rounds: BracketRound[];
  /** So vong dau bi cat bot (cac vong loai som cua cup lon). */
  omittedRounds: number;
}

function tieKey(fixture: Fixture): string {
  const ids = [fixture.teams.home.id, fixture.teams.away.id].sort((a, b) => a - b);
  return ids.join("-");
}

function roundRank(name: string): number {
  const rank = ROUND_RANK.get(name.toLowerCase());
  return rank === undefined ? Number.MAX_SAFE_INTEGER : rank;
}

/**
 * Dung so do loai truc tiep tu danh sach tran dau cua mot cup.
 * Bo qua vong bang; gop cac luot di/ve cua cung mot cap dau.
 *
 * `maxRounds` gioi han so vong hien thi, tinh tu vong muon nhat lui lai. FA Cup
 * mot mua co 24 vong / 879 cap ke ca nhanh nghiep du - render het ra ~2.8 MB
 * HTML, khong dung duoc.
 */
export function buildBracket(
  fixtures: Fixture[],
  maxRounds: number,
): BracketResult {
  const knockout = fixtures.filter((f) => !isNotKnockout(f.league.round));

  if (knockout.length === 0) {
    return { rounds: [], omittedRounds: 0 };
  }

  const byRound = new Map<string, Fixture[]>();
  for (const fixture of knockout) {
    const bucket = byRound.get(fixture.league.round);
    if (bucket) {
      bucket.push(fixture);
    } else {
      byRound.set(fixture.league.round, [fixture]);
    }
  }

  const rounds: BracketRound[] = [];
  for (const [name, items] of byRound) {
    const byTie = new Map<string, Fixture[]>();
    for (const fixture of items) {
      const key = tieKey(fixture);
      const bucket = byTie.get(key);
      if (bucket) {
        bucket.push(fixture);
      } else {
        byTie.set(key, [fixture]);
      }
    }

    const ties: BracketTie[] = [...byTie.entries()].map(([key, legs]) => ({
      key,
      legs: legs.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp),
    }));
    ties.sort((a, b) => a.legs[0].fixture.timestamp - b.legs[0].fixture.timestamp);

    rounds.push({
      name,
      ties,
      startsAt: ties[0].legs[0].fixture.timestamp,
    });
  }

  rounds.sort((a, b) => {
    const diff = a.startsAt - b.startsAt;
    if (diff !== 0) return diff;
    return roundRank(a.name) - roundRank(b.name);
  });

  const omittedRounds = Math.max(0, rounds.length - maxRounds);

  return {
    rounds: omittedRounds > 0 ? rounds.slice(omittedRounds) : rounds,
    omittedRounds,
  };
}

/** Tong ty so cua mot cap dau (null neu chua co tran nao da xong). */
export function aggregateScore(
  tie: BracketTie,
): { teamId: number; goals: number }[] | null {
  const totals = new Map<number, number>();
  let counted = 0;

  for (const leg of tie.legs) {
    const { home, away } = leg.goals;
    if (home === null || away === null) continue;
    counted += 1;
    totals.set(leg.teams.home.id, (totals.get(leg.teams.home.id) ?? 0) + home);
    totals.set(leg.teams.away.id, (totals.get(leg.teams.away.id) ?? 0) + away);
  }

  if (counted === 0) return null;
  return [...totals.entries()].map(([teamId, goals]) => ({ teamId, goals }));
}

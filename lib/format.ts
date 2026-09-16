import type { Fixture } from "./types";

const TIME_ZONE = "Asia/Ho_Chi_Minh";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});

const fullDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/** Ngày/tháng gọn cho nhãn khoảng thời gian của vòng đấu: "06/09". */
const dayMonthFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TIME_ZONE,
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatFullDate(iso: string): string {
  return fullDateFormatter.format(new Date(iso));
}

/**
 * Ghép tay từ formatToParts thay vì dùng thẳng format(): locale vi-VN của ICU
 * trả về dấu nối "-" cho mẫu chỉ có ngày và tháng ("22-08"), không phải "/"
 * như khi có đủ ngày tháng năm. Ghép tay để dấu phân cách luôn nhất quán.
 */
export function formatDayMonth(iso: string): string {
  const parts = dayMonthFormatter.formatToParts(new Date(iso));
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${day}/${month}`;
}

/** Khoá nhóm theo ngày (giờ Việt Nam), dạng YYYY-MM-DD. */
export function dayKey(iso: string): string {
  return dayKeyFormatter.format(new Date(iso));
}

const STATUS_LABELS: Record<string, string> = {
  TBD: "Chưa xác định",
  NS: "Chưa đá",
  "1H": "Hiệp 1",
  HT: "Nghỉ giữa hiệp",
  "2H": "Hiệp 2",
  ET: "Hiệp phụ",
  BT: "Nghỉ hiệp phụ",
  P: "Luân lưu",
  SUSP: "Tạm hoãn",
  INT: "Gián đoạn",
  LIVE: "Đang đá",
  FT: "Kết thúc",
  AET: "Sau hiệp phụ",
  PEN: "Sau luân lưu",
  PST: "Hoãn",
  CANC: "Huỷ",
  ABD: "Bỏ dở",
  AWD: "Xử thắng",
  WO: "Xử thua",
};

export function statusLabel(fixture: Fixture): string {
  const { short, elapsed } = fixture.fixture.status;
  if (isLive(fixture) && elapsed !== null) {
    return `${elapsed}'`;
  }
  return STATUS_LABELS[short] ?? short;
}

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

export function isLive(fixture: Fixture): boolean {
  return LIVE_STATUSES.has(fixture.fixture.status.short);
}

export function isFinished(fixture: Fixture): boolean {
  return FINISHED_STATUSES.has(fixture.fixture.status.short);
}

/** Tỷ số hiển thị, hoặc giờ đấu nếu trận chưa diễn ra. */
export function scoreOrKickoff(fixture: Fixture): string {
  if (isLive(fixture) || isFinished(fixture)) {
    const { home, away } = fixture.goals;
    return `${home ?? 0} - ${away ?? 0}`;
  }
  return formatTime(fixture.fixture.date);
}

/**
 * Tách danh sách trận thành "sắp tới" và "đã đá" theo mốc thời gian hiện tại.
 *
 * Với mùa chưa khởi tranh thì `recent` sẽ rỗng, với mùa đã kết thúc thì
 * `upcoming` rỗng — cả hai đều đúng, không phải lỗi.
 */
export function splitByKickoff(
  fixtures: Fixture[],
  upcomingLimit: number,
  recentLimit: number,
): { upcoming: Fixture[]; recent: Fixture[] } {
  const nowSeconds = Date.now() / 1000;
  const sorted = [...fixtures].sort(
    (a, b) => a.fixture.timestamp - b.fixture.timestamp,
  );

  const upcoming = sorted
    .filter((f) => f.fixture.timestamp >= nowSeconds && !isFinished(f))
    .slice(0, upcomingLimit);

  const recent = sorted
    .filter((f) => f.fixture.timestamp < nowSeconds || isFinished(f))
    .slice(-recentLimit);

  return { upcoming, recent };
}

/** Nhóm các trận theo ngày, giữ nguyên thứ tự thời gian tăng dần. */
export function groupByDay(fixtures: Fixture[]): Array<{
  key: string;
  label: string;
  fixtures: Fixture[];
}> {
  const sorted = [...fixtures].sort(
    (a, b) => a.fixture.timestamp - b.fixture.timestamp,
  );
  const groups = new Map<string, Fixture[]>();
  for (const fixture of sorted) {
    const key = dayKey(fixture.fixture.date);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(fixture);
    } else {
      groups.set(key, [fixture]);
    }
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    label: formatFullDate(items[0].fixture.date),
    fixtures: items,
  }));
}

export interface RoundGroup {
  /** Chính là `fixture.league.round`, ví dụ "Vòng 12" hoặc "Quarter-finals". */
  key: string;
  label: string;
  fixtures: Fixture[];
  /** Trận sớm nhất và muộn nhất của vòng (giây). */
  startsAt: number;
  endsAt: number;
  playedCount: number;
  /** Vòng đã đá xong toàn bộ. */
  complete: boolean;
  /** Có trận đang diễn ra. */
  live: boolean;
  /** Vòng gần thời điểm hiện tại nhất — mở sẵn trong accordion. */
  current: boolean;
}

/**
 * Nhóm các trận theo VÒNG ĐẤU thay vì theo ngày.
 *
 * Thứ tự vòng xếp theo THỜI GIAN trận sớm nhất, không theo tên. Lý do giống
 * lib/bracket.ts: mỗi giải đặt tên vòng một kiểu ("Vòng 12", "Quarter-finals",
 * "League Stage"), xếp theo tên thì cúp sẽ loạn thứ tự.
 *
 * "Vòng hiện tại" = vòng đầu tiên chưa kết thúc (còn trận phía trước hoặc đang
 * đá). Nếu cả mùa đã đá xong thì lấy vòng cuối. Đây là vòng được mở sẵn.
 */
export function groupByRound(fixtures: Fixture[]): RoundGroup[] {
  if (fixtures.length === 0) return [];

  const buckets = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const key = fixture.league.round || "Chưa xếp vòng";
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(fixture);
    } else {
      buckets.set(key, [fixture]);
    }
  }

  const nowSeconds = Date.now() / 1000;

  const rounds: RoundGroup[] = [...buckets.entries()].map(([key, items]) => {
    const sorted = [...items].sort(
      (a, b) => a.fixture.timestamp - b.fixture.timestamp,
    );
    const playedCount = sorted.filter(isFinished).length;

    return {
      key,
      label: key,
      fixtures: sorted,
      startsAt: sorted[0].fixture.timestamp,
      endsAt: sorted[sorted.length - 1].fixture.timestamp,
      playedCount,
      complete: playedCount === sorted.length,
      live: sorted.some(isLive),
      current: false,
    };
  });

  rounds.sort((a, b) => a.startsAt - b.startsAt);

  // Vòng đang có trận trực tiếp luôn thắng; nếu không, lấy vòng chưa đá xong
  // sớm nhất; nếu mùa đã khép lại thì lấy vòng cuối cùng.
  const liveIndex = rounds.findIndex((r) => r.live);
  const pendingIndex = rounds.findIndex(
    (r) => !r.complete || r.endsAt >= nowSeconds,
  );
  const currentIndex =
    liveIndex >= 0
      ? liveIndex
      : pendingIndex >= 0
        ? pendingIndex
        : rounds.length - 1;

  rounds[currentIndex].current = true;
  return rounds;
}

/** Nhãn khoảng thời gian của một vòng: "06/09 – 08/09", hoặc một ngày nếu gọn. */
export function formatRoundRange(round: RoundGroup): string {
  const start = formatDayMonth(round.fixtures[0].fixture.date);
  const end = formatDayMonth(
    round.fixtures[round.fixtures.length - 1].fixture.date,
  );
  return start === end ? start : `${start} – ${end}`;
}

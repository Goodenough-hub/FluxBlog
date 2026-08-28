import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { PostSummary } from "./blogTypes";

dayjs.extend(utc);
dayjs.extend(timezone);

export const CONTRIBUTION_WEEKS = 53;
export const CONTRIBUTION_WEEKDAYS = 7;
export const CONTRIBUTION_LEVELS = [0, 1, 2, 3, 4] as const;

export type ContributionLevel = (typeof CONTRIBUTION_LEVELS)[number];

export type ContributionDay = {
  /** Local calendar date in YYYY-MM-DD format. */
  date: string;
  /** Zero-based day of week, Sunday first. */
  weekday: number;
  count: number;
  /** Number of private posts included in `count`. */
  privateCount: number;
  level: ContributionLevel;
  isToday: boolean;
  isFuture: boolean;
  /** False for future cells used only to complete the current week. */
  isInRange: boolean;
};

export type ContributionMonthMarker = {
  weekIndex: number;
  year: number;
  /** One-based month number. */
  month: number;
};

export type ContributionCalendar = {
  /** First counted local date, aligned to the first displayed week. */
  startDate: string;
  /** Last counted local date. */
  endDate: string;
  weeks: ContributionDay[][];
  monthMarkers: ContributionMonthMarker[];
  totalCount: number;
  totalPrivateCount: number;
  activeDays: number;
  maxCount: number;
};

type BuildOptions = {
  timezone: string;
  now?: string | Date;
};

/** Map the daily post count to a fixed five-step color level. */
export function getContributionLevel(count: number): ContributionLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

function formatLocalDate(value: dayjs.Dayjs): string {
  return value.format("YYYY-MM-DD");
}

/**
 * Build a GitHub-like one-year contribution calendar.
 *
 * The grid always shows 53 full Sunday-first weeks. Dates after today stay as
 * invisible placeholders so the current week keeps a stable seven-day shape.
 */
export function buildContributionCalendar(
  posts: PostSummary[],
  options: BuildOptions
): ContributionCalendar {
  const today = dayjs(options.now ?? new Date())
    .tz(options.timezone)
    .startOf("day");

  if (!today.isValid()) {
    throw new Error("Invalid `now` value for contribution calendar");
  }

  const currentWeekStart = today.subtract(today.day(), "day");
  const rangeStart = currentWeekStart.subtract(CONTRIBUTION_WEEKS - 1, "week");
  const weekCount = CONTRIBUTION_WEEKS;

  const countByDate = new Map<string, number>();
  const privateCountByDate = new Map<string, number>();
  for (const post of posts) {
    if (!post.publishedAt) continue;

    const parsed = dayjs(post.publishedAt);
    if (!parsed.isValid()) continue;

    const published = parsed.tz(options.timezone).startOf("day");
    if (published.isBefore(rangeStart) || published.isAfter(today)) continue;

    const key = formatLocalDate(published);
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    if (post.visibility === "private") {
      privateCountByDate.set(key, (privateCountByDate.get(key) ?? 0) + 1);
    }
  }

  const todayKey = formatLocalDate(today);
  const weeks: ContributionDay[][] = [];

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const week: ContributionDay[] = [];

    for (let weekday = 0; weekday < CONTRIBUTION_WEEKDAYS; weekday += 1) {
      const date = rangeStart.add(
        weekIndex * CONTRIBUTION_WEEKDAYS + weekday,
        "day"
      );
      const key = formatLocalDate(date);
      const isFuture = date.isAfter(today);
      const isInRange = !date.isBefore(rangeStart) && !isFuture;
      const count = isInRange ? (countByDate.get(key) ?? 0) : 0;
      const privateCount = isInRange ? (privateCountByDate.get(key) ?? 0) : 0;

      week.push({
        date: key,
        weekday,
        count,
        privateCount,
        level: getContributionLevel(count),
        isToday: key === todayKey,
        isFuture,
        isInRange,
      });
    }

    weeks.push(week);
  }

  const monthMarkers: ContributionMonthMarker[] = [];
  let lastMarkerWeek = Number.NEGATIVE_INFINITY;

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    const week = weeks[weekIndex];
    const monthStart = week.find(
      day => day.isInRange && day.date.endsWith("-01")
    );
    const firstInRangeDay = week.find(day => day.isInRange);
    const markerDay =
      monthStart ?? (weekIndex === 0 ? firstInRangeDay : undefined);

    // Keep adjacent labels from colliding in the compact 53-week grid.
    if (!markerDay || weekIndex - lastMarkerWeek < 3) continue;

    const [year, month] = markerDay.date.split("-").map(Number);
    monthMarkers.push({ weekIndex, year, month });
    lastMarkerWeek = weekIndex;
  }

  const counts = Array.from(countByDate.values());
  const privateCounts = Array.from(privateCountByDate.values());
  return {
    startDate: formatLocalDate(rangeStart),
    endDate: formatLocalDate(today),
    weeks,
    monthMarkers,
    totalCount: counts.reduce((sum, count) => sum + count, 0),
    totalPrivateCount: privateCounts.reduce((sum, count) => sum + count, 0),
    activeDays: countByDate.size,
    maxCount: counts.length > 0 ? Math.max(...counts) : 0,
  };
}

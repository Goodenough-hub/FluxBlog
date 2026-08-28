import { describe, expect, it } from "vitest";
import type { PostSummary } from "./blogTypes";
import {
  buildContributionCalendar,
  getContributionLevel,
} from "./contributionCalendar";

function makePost(id: number, publishedAt: string | null): PostSummary {
  return {
    id,
    slug: `post-${id}`,
    title: `Post ${id}`,
    description: "",
    tags: [],
    status: "published",
    visibility: "public",
    version: 1,
    publishedAt,
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function findDay(
  calendar: ReturnType<typeof buildContributionCalendar>,
  date: string
) {
  return calendar.weeks.flat().find(day => day.date === date);
}

describe("getContributionLevel", () => {
  it("按固定阈值映射五级贡献色", () => {
    expect(getContributionLevel(0)).toBe(0);
    expect(getContributionLevel(1)).toBe(1);
    expect(getContributionLevel(2)).toBe(2);
    expect(getContributionLevel(3)).toBe(3);
    expect(getContributionLevel(4)).toBe(4);
    expect(getContributionLevel(12)).toBe(4);
  });
});

describe("buildContributionCalendar", () => {
  const options = {
    timezone: "Asia/Shanghai",
    now: "2026-08-28T12:00:00.000+08:00",
  };

  it("累计同一天发布的多篇文章", () => {
    const calendar = buildContributionCalendar(
      [
        makePost(1, "2026-08-20T09:00:00.000+08:00"),
        makePost(2, "2026-08-20T18:00:00.000+08:00"),
        makePost(3, "2026-08-21T09:00:00.000+08:00"),
      ],
      options
    );

    expect(findDay(calendar, "2026-08-20")).toMatchObject({
      count: 2,
      level: 2,
    });
    expect(findDay(calendar, "2026-08-21")).toMatchObject({
      count: 1,
      level: 1,
    });
    expect(calendar.totalCount).toBe(3);
    expect(calendar.activeDays).toBe(2);
    expect(calendar.maxCount).toBe(2);
  });

  it("按上海时区处理 UTC 日期边界", () => {
    const calendar = buildContributionCalendar(
      [makePost(1, "2026-08-26T16:30:00.000Z")],
      options
    );

    expect(findDay(calendar, "2026-08-27")).toMatchObject({
      count: 1,
      level: 1,
    });
    expect(findDay(calendar, "2026-08-26")?.count).toBe(0);
  });

  it("忽略空值、非法日期、未来日期和范围外日期", () => {
    const calendar = buildContributionCalendar(
      [
        makePost(1, null),
        makePost(2, "not-a-date"),
        makePost(3, "2026-08-29T00:00:00.000+08:00"),
        makePost(4, "2025-08-23T23:59:59.000+08:00"),
      ],
      options
    );

    expect(calendar.totalCount).toBe(0);
    expect(calendar.activeDays).toBe(0);
    expect(calendar.maxCount).toBe(0);
  });

  it("生成 53 个周日开头的完整周，并保留未来占位格", () => {
    const calendar = buildContributionCalendar([], options);

    expect(calendar.startDate).toBe("2025-08-24");
    expect(calendar.endDate).toBe("2026-08-28");
    expect(calendar.weeks).toHaveLength(53);
    expect(calendar.weeks.every(week => week.length === 7)).toBe(true);
    expect(calendar.weeks[0].every(day => day.isInRange)).toBe(true);

    // 2026-08-28 is Friday, leaving one future placeholder in the last week.
    const lastWeek = calendar.weeks.at(-1)!;
    expect(lastWeek.filter(day => day.isInRange)).toHaveLength(6);
    expect(lastWeek.filter(day => day.isFuture)).toHaveLength(1);
    expect(findDay(calendar, "2026-08-28")?.isToday).toBe(true);
  });

  it("跨年窗口保留正确的起止日期", () => {
    const calendar = buildContributionCalendar([], {
      timezone: "Asia/Shanghai",
      now: "2026-01-01T12:00:00.000+08:00",
    });

    expect(calendar.startDate).toBe("2024-12-29");
    expect(calendar.endDate).toBe("2026-01-01");
    expect(calendar.weeks).toHaveLength(53);
    expect(calendar.monthMarkers.some(marker => marker.month === 1)).toBe(true);
  });

  it("覆盖闰日所在的一年窗口", () => {
    const calendar = buildContributionCalendar(
      [makePost(1, "2024-02-29T12:00:00.000+08:00")],
      {
        timezone: "Asia/Shanghai",
        now: "2024-02-29T18:00:00.000+08:00",
      }
    );

    expect(calendar.startDate).toBe("2023-02-26");
    expect(findDay(calendar, "2024-02-29")).toMatchObject({
      count: 1,
      isToday: true,
    });
    expect(calendar.weeks).toHaveLength(53);
  });

  it("月份标签按月首所在周生成且避免过近碰撞", () => {
    const calendar = buildContributionCalendar([], options);

    expect(calendar.monthMarkers.length).toBeGreaterThan(10);
    expect(calendar.monthMarkers[0]).toMatchObject({
      weekIndex: 0,
      year: 2025,
      month: 8,
    });

    for (let index = 1; index < calendar.monthMarkers.length; index += 1) {
      expect(
        calendar.monthMarkers[index].weekIndex -
          calendar.monthMarkers[index - 1].weekIndex
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("空数据仍生成完整网格和零值统计", () => {
    const calendar = buildContributionCalendar([], options);
    const inRangeDays = calendar.weeks.flat().filter(day => day.isInRange);

    expect(inRangeDays).toHaveLength(370);
    expect(inRangeDays.every(day => day.count === 0 && day.level === 0)).toBe(
      true
    );
    expect(calendar.totalCount).toBe(0);
    expect(calendar.activeDays).toBe(0);
  });
});

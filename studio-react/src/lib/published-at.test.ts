import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import {
  isValidHistoricalPublishedAt,
  serializeHistoricalPublishedAt,
  togglePublishTiming,
} from "./published-at";

describe("历史发布时间", () => {
  const now = dayjs("2026-08-23T12:00:00.000Z");

  it("接受过去时间并序列化为 ISO 字符串", () => {
    const value = dayjs("2020-03-04T05:06:07.000Z");

    expect(isValidHistoricalPublishedAt(value, now)).toBe(true);
    expect(serializeHistoricalPublishedAt(value, now)).toBe(
      "2020-03-04T05:06:07.000Z"
    );
  });

  it("拒绝未来时间", () => {
    const value = now.add(1, "second");

    expect(isValidHistoricalPublishedAt(value, now)).toBe(false);
    expect(serializeHistoricalPublishedAt(value, now)).toBeNull();
  });

  it("拒绝空值和无效时间", () => {
    expect(serializeHistoricalPublishedAt(null, now)).toBeNull();
    expect(serializeHistoricalPublishedAt(dayjs("invalid"), now)).toBeNull();
  });

  it("开启一种发布时间会关闭另一种并清空冲突值", () => {
    expect(togglePublishTiming("historical", true)).toEqual({
      scheduleEnabled: false,
      historicalEnabled: true,
      scheduledPublishAt: null,
      publishedAt: null,
      syncCreatedAt: false,
    });
    expect(togglePublishTiming("scheduled", true)).toEqual({
      scheduleEnabled: true,
      historicalEnabled: false,
      scheduledPublishAt: null,
      publishedAt: null,
      syncCreatedAt: false,
    });
  });
});

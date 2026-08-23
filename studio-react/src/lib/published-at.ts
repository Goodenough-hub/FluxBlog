import dayjs, { type Dayjs } from "dayjs";

export type PublishTimingMode = "scheduled" | "historical";

export function isValidHistoricalPublishedAt(
  value: Dayjs | null | undefined,
  now = dayjs()
) {
  return Boolean(value?.isValid() && !value.isAfter(now));
}

export function serializeHistoricalPublishedAt(
  value: Dayjs | null | undefined,
  now = dayjs()
) {
  return isValidHistoricalPublishedAt(value, now) ? value!.toISOString() : null;
}

export function togglePublishTiming(mode: PublishTimingMode, enabled: boolean) {
  return {
    scheduleEnabled: mode === "scheduled" && enabled,
    historicalEnabled: mode === "historical" && enabled,
    scheduledPublishAt: null,
    publishedAt: null,
    syncCreatedAt: false,
  };
}

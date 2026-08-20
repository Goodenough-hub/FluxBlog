import dayjs from "dayjs";

export function formatDraftDate(value?: string | null) {
  if (!value) return null;

  const date = dayjs(value);
  return {
    dateTime: date.format("MM-DD HH:mm"),
    year: date.format("YYYY"),
  };
}

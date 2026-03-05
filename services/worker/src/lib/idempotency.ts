import dayjs from "dayjs";

export function buildIdempotencyKey(params: {
  foodItemId: string;
  targetType: string;
  scheduleType: string;
  scheduledAt: Date;
}) {
  const ymd = dayjs(params.scheduledAt).format("YYYYMMDD");
  return `notify:${params.foodItemId}:${params.targetType}:${params.scheduleType}:${ymd}`;
}

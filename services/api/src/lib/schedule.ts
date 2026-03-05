import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { ScheduleType } from "@prisma/client";
import { APP_TIMEZONE } from "./dates.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export type ScheduleSeed = {
  scheduleType: ScheduleType;
  targetType: "OWNER" | "ADMIN";
  scheduledAt: Date;
};

function atKstNine(date: dayjs.Dayjs): Date {
  return date.tz(APP_TIMEZONE).hour(9).minute(0).second(0).millisecond(0).utc().toDate();
}

export function generateInitialSchedules(expiryDate: Date): ScheduleSeed[] {
  const base = dayjs(expiryDate).tz(APP_TIMEZONE).startOf("day");

  return [
    {
      scheduleType: "OWNER_D_MINUS_3",
      targetType: "OWNER",
      scheduledAt: atKstNine(base.subtract(3, "day"))
    },
    {
      scheduleType: "OWNER_D_DAY",
      targetType: "OWNER",
      scheduledAt: atKstNine(base)
    },
    {
      scheduleType: "OWNER_D_PLUS_7",
      targetType: "OWNER",
      scheduledAt: atKstNine(base.add(7, "day"))
    },
    {
      scheduleType: "OWNER_WEEKLY",
      targetType: "OWNER",
      scheduledAt: atKstNine(base.add(14, "day"))
    },
    {
      scheduleType: "ADMIN_D_PLUS_7",
      targetType: "ADMIN",
      scheduledAt: atKstNine(base.add(7, "day"))
    }
  ];
}

export function nextWeeklySchedule(currentScheduledAt: Date): Date {
  return dayjs(currentScheduledAt).add(7, "day").toDate();
}

export function buildIdempotencyKey(params: {
  foodItemId: string;
  targetType: "OWNER" | "ADMIN";
  scheduleType: string;
  date: Date;
}): string {
  const ymd = dayjs(params.date).tz(APP_TIMEZONE).format("YYYYMMDD");
  return `notify:${params.foodItemId}:${params.targetType}:${params.scheduleType}:${ymd}`;
}

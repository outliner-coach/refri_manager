import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Seoul";

export function isExpiryWithinSixMonths(registeredAt: Date, expiryDate: Date): boolean {
  const registered = dayjs(registeredAt);
  const expiry = dayjs(expiryDate);

  if (expiry.isBefore(registered, "day")) {
    return false;
  }

  const upperBound = registered.add(6, "month").endOf("day");
  return !expiry.isAfter(upperBound);
}

export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }
  return parsed;
}

export function toKstNineAM(date: Date): Date {
  const d = dayjs(date).tz(APP_TIMEZONE);
  return d.hour(9).minute(0).second(0).millisecond(0).utc().toDate();
}

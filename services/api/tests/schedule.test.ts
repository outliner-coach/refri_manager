import { describe, expect, it } from "vitest";
import { buildIdempotencyKey, generateInitialSchedules } from "../src/lib/schedule.js";

describe("generateInitialSchedules", () => {
  it("creates 5 schedule seeds", () => {
    const expiry = new Date("2026-10-01T00:00:00Z");
    const schedules = generateInitialSchedules(expiry);

    expect(schedules).toHaveLength(5);
    expect(schedules.map((s) => s.scheduleType)).toEqual([
      "OWNER_D_MINUS_3",
      "OWNER_D_DAY",
      "OWNER_D_PLUS_7",
      "OWNER_WEEKLY",
      "ADMIN_D_PLUS_7"
    ]);
  });
});

describe("buildIdempotencyKey", () => {
  it("builds deterministic key", () => {
    const key = buildIdempotencyKey({
      foodItemId: "food-1",
      targetType: "OWNER",
      scheduleType: "OWNER_D_DAY",
      date: new Date("2026-10-01T00:00:00Z")
    });

    expect(key.startsWith("notify:food-1:OWNER:OWNER_D_DAY:")).toBe(true);
  });
});

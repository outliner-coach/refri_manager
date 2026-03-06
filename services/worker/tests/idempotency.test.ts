import { beforeAll, describe, expect, it } from "vitest";

let buildIdempotencyKey: typeof import("../src/lib/idempotency.js").buildIdempotencyKey;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "mysql://root:root@localhost:3306/refri_manager";
  ({ buildIdempotencyKey } = await import("../src/lib/idempotency.js"));
});

describe("buildIdempotencyKey", () => {
  it("builds a deterministic notification key", () => {
    const key = buildIdempotencyKey({
      foodItemId: "food-1",
      targetType: "OWNER",
      scheduleType: "OWNER_D_DAY",
      scheduledAt: new Date("2026-03-06T00:00:00Z")
    });

    expect(key).toBe("notify:food-1:OWNER:OWNER_D_DAY:20260306");
  });
});

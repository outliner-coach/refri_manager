import { beforeAll, describe, expect, it } from "vitest";

let buildOwnerReminderMessage: typeof import("../src/lib/slack.js").buildOwnerReminderMessage;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "mysql://root:root@localhost:3306/refri_manager";
  ({ buildOwnerReminderMessage } = await import("../src/lib/slack.js"));
});

describe("buildOwnerReminderMessage", () => {
  it("includes direct resolution buttons", () => {
    const message = buildOwnerReminderMessage({
      foodItemId: "food-1",
      foodName: "김치",
      expiryDate: "2026-03-09"
    });

    expect(message.text).toContain("김치");
    expect(JSON.stringify(message.blocks)).toContain("resolve_food_status");
    expect(JSON.stringify(message.blocks)).toContain("TAKEN_OUT");
    expect(JSON.stringify(message.blocks)).toContain("DISPOSED");
  });
});

import { describe, expect, it } from "vitest";
import { isExpiryWithinSixMonths } from "../src/lib/dates.js";

describe("isExpiryWithinSixMonths", () => {
  it("allows expiry within 6 months", () => {
    const registeredAt = new Date("2026-03-01T00:00:00Z");
    const expiryDate = new Date("2026-09-01T00:00:00Z");

    expect(isExpiryWithinSixMonths(registeredAt, expiryDate)).toBe(true);
  });

  it("blocks expiry after 6 months", () => {
    const registeredAt = new Date("2026-03-01T00:00:00Z");
    const expiryDate = new Date("2026-09-03T00:00:00Z");

    expect(isExpiryWithinSixMonths(registeredAt, expiryDate)).toBe(false);
  });
});

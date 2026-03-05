import { describe, expect, it } from "vitest";
import { canEditFoodItem } from "../src/lib/authorization.js";

describe("canEditFoodItem", () => {
  it("allows owner to edit", () => {
    expect(canEditFoodItem("member-1", "member-1")).toBe(true);
  });

  it("blocks non-owner", () => {
    expect(canEditFoodItem("member-1", "member-2")).toBe(false);
  });
});

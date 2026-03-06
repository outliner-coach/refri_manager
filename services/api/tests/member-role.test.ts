import { describe, expect, it } from "vitest";
import { resolveMemberRole } from "../src/lib/member-role.js";

describe("resolveMemberRole", () => {
  it("defaults to MEMBER when the sheet cell is missing", () => {
    expect(resolveMemberRole(undefined)).toBe("MEMBER");
  });

  it("parses ADMIN values case-insensitively", () => {
    expect(resolveMemberRole("admin")).toBe("ADMIN");
  });
});

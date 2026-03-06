import { beforeAll, describe, expect, it } from "vitest";

let normalizeEmail: typeof import("../src/lib/google-sheets.js").normalizeEmail;
let parseAdminEmailRows: typeof import("../src/lib/google-sheets.js").parseAdminEmailRows;
let parseMemberRows: typeof import("../src/lib/google-sheets.js").parseMemberRows;

beforeAll(async () => {
  process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
  const googleSheets = await import("../src/lib/google-sheets.js");
  normalizeEmail = googleSheets.normalizeEmail;
  parseAdminEmailRows = googleSheets.parseAdminEmailRows;
  parseMemberRows = googleSheets.parseMemberRows;
});

describe("parseAdminEmailRows", () => {
  it("collects only valid admin emails from the admin sheet", () => {
    const adminEmails = parseAdminEmailRows([
      ["관리자 이메일"],
      ["Admin@example.com"],
      [""],
      ["ops@example.com"]
    ]);

    expect([...adminEmails]).toEqual(["admin@example.com", "ops@example.com"]);
  });
});

describe("parseMemberRows", () => {
  it("assigns ADMIN role when the member email exists in the admin sheet", () => {
    const { members, failedCount } = parseMemberRows(
      [
        ["사번", "이름", "소속", "이메일"],
        ["E1001", "홍길동", "Product", "hong@example.com"],
        ["E1002", "김관리", "Ops", "admin@example.com"],
        ["", "누락", "Ops", "missing@example.com"]
      ],
      new Set(["admin@example.com"])
    );

    expect(failedCount).toBe(1);
    expect(members).toEqual([
      {
        employeeNo: "E1001",
        name: "홍길동",
        department: "Product",
        email: "hong@example.com",
        role: "MEMBER"
      },
      {
        employeeNo: "E1002",
        name: "김관리",
        department: "Ops",
        email: "admin@example.com",
        role: "ADMIN"
      }
    ]);
  });
});

describe("normalizeEmail", () => {
  it("normalizes casing and rejects non-email values", () => {
    expect(normalizeEmail(" Admin@Example.com ")).toBe("admin@example.com");
    expect(normalizeEmail("관리자 이메일")).toBeNull();
  });
});

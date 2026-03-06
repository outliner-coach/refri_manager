export type MemberRole = "MEMBER" | "ADMIN";

export function resolveMemberRole(value: unknown): MemberRole {
  return String(value).trim().toUpperCase() === "ADMIN" ? "ADMIN" : "MEMBER";
}

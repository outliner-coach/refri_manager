import { MemberRole } from "./member-role.js";

export function isAdminRole(actorRole: MemberRole | undefined): boolean {
  return actorRole === "ADMIN";
}

export function canEditFoodItem(
  actorMemberId: string,
  ownerMemberId: string,
  actorRole: MemberRole | undefined
): boolean {
  return actorMemberId === ownerMemberId || isAdminRole(actorRole);
}

export function canResolveFoodItem(
  actorMemberId: string,
  ownerMemberId: string,
  actorRole: MemberRole | undefined
): boolean {
  return actorMemberId === ownerMemberId || isAdminRole(actorRole);
}

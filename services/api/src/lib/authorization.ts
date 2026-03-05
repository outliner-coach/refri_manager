export function canEditFoodItem(actorMemberId: string, ownerMemberId: string): boolean {
  return actorMemberId === ownerMemberId;
}

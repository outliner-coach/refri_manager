import { FoodItem, FoodStatus, NotificationStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../db.js";
import { canResolveFoodItem } from "./authorization.js";
import { MemberRole } from "./member-role.js";

type DbClient = PrismaClient | Prisma.TransactionClient;
type TransitionSource = "TABLET" | "ADMIN" | "SLACK" | "API";
type ResolvableFoodStatus = "TAKEN_OUT" | "DISPOSED";

export class FoodStatusTransitionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "FoodStatusTransitionError";
  }
}

export type FoodStatusTransitionParams = {
  foodItemId: string;
  nextStatus: ResolvableFoodStatus;
  actorMemberId: string;
  actorMemberRole: MemberRole | undefined;
  source: TransitionSource;
  db?: DbClient;
};

export type FoodStatusTransitionResult = {
  foodItem: FoodItem;
  changed: boolean;
  canceledScheduleCount: number;
};

function getDbClient(db?: DbClient): DbClient {
  return db ?? prisma;
}

export async function transitionFoodItemStatus(
  params: FoodStatusTransitionParams
): Promise<FoodStatusTransitionResult> {
  const execute = async (tx: DbClient) => {
    const existing = await tx.foodItem.findUnique({
      where: { id: params.foodItemId }
    });

    if (!existing) {
      throw new FoodStatusTransitionError("Food item not found", 404);
    }

    if (!canResolveFoodItem(params.actorMemberId, existing.memberId, params.actorMemberRole)) {
      throw new FoodStatusTransitionError("You do not have permission to resolve this food item", 403);
    }

    if (existing.status === params.nextStatus) {
      return {
        foodItem: existing,
        changed: false,
        canceledScheduleCount: 0
      };
    }

    if (existing.status !== "REGISTERED") {
      throw new FoodStatusTransitionError("Only registered food items can be resolved", 409);
    }

    const updated = await tx.foodItem.update({
      where: { id: params.foodItemId },
      data: { status: params.nextStatus }
    });

    const canceledSchedules = await tx.notificationSchedule.updateMany({
      where: {
        foodItemId: params.foodItemId,
        status: {
          in: ["PENDING", "FAILED_RETRY"] satisfies NotificationStatus[]
        }
      },
      data: {
        status: "CANCELED"
      }
    });

    await tx.foodItemEvent.create({
      data: {
        foodItemId: params.foodItemId,
        actorMemberId: params.actorMemberId,
        eventType: "FOOD_STATUS_CHANGED",
        payloadJson: {
          fromStatus: existing.status,
          toStatus: params.nextStatus,
          source: params.source,
          canceledScheduleCount: canceledSchedules.count
        }
      }
    });

    return {
      foodItem: updated,
      changed: true,
      canceledScheduleCount: canceledSchedules.count
    };
  };

  const db = getDbClient(params.db);
  if ("$transaction" in db) {
    return db.$transaction(async (tx) => execute(tx));
  }

  return execute(db);
}

export function isResolvableFoodStatus(status: FoodStatus): status is ResolvableFoodStatus {
  return status === "TAKEN_OUT" || status === "DISPOSED";
}

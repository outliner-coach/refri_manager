import { FastifyInstance, FastifyReply } from "fastify";
import { CreateFoodRequestSchema, UpdateFoodRequestSchema } from "@refri/shared-types";
import { prisma } from "../db.js";
import { generateInitialSchedules } from "../lib/schedule.js";
import { isExpiryWithinSixMonths, parseDateOnly } from "../lib/dates.js";
import { canEditFoodItem } from "../lib/authorization.js";
import {
  FoodStatusTransitionError,
  isResolvableFoodStatus,
  transitionFoodItemStatus
} from "../lib/food-status.js";

function assertActor(request: { actorMemberId?: string }): string {
  if (!request.actorMemberId) {
    throw new Error("Actor member is not resolved");
  }
  return request.actorMemberId;
}

function assertActorRole(request: { actorMemberRole?: "MEMBER" | "ADMIN" }) {
  return request.actorMemberRole;
}

function sendTransitionError(reply: FastifyReply, error: unknown) {
  if (error instanceof FoodStatusTransitionError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }

  throw error;
}

export async function foodRoutes(app: FastifyInstance) {
  app.post("/v1/foods", async (request, reply) => {
    const parsed = CreateFoodRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const actorMemberId = assertActor(request);

    if (actorMemberId !== parsed.data.memberId) {
      return reply.forbidden("You can only create your own food entries");
    }

    const registeredAt = new Date();
    const expiryDate = parseDateOnly(parsed.data.expiryDate);

    if (!isExpiryWithinSixMonths(registeredAt, expiryDate)) {
      return reply.badRequest("expiryDate must be within 6 months from registration date");
    }

    const result = await prisma.$transaction(async (tx) => {
      const foodItem = await tx.foodItem.create({
        data: {
          memberId: parsed.data.memberId,
          foodName: parsed.data.foodName,
          expiryDate,
          registeredAt,
          status: "REGISTERED"
        }
      });

      await tx.foodAsset.create({
        data: {
          foodItemId: foodItem.id,
          photoObjectKey: parsed.data.photoObjectKey,
          audioObjectKey: parsed.data.audioObjectKey
        }
      });

      await tx.foodItemEvent.create({
        data: {
          foodItemId: foodItem.id,
          actorMemberId,
          eventType: "FOOD_CREATED",
          payloadJson: parsed.data
        }
      });

      const schedules = generateInitialSchedules(expiryDate);
      await tx.notificationSchedule.createMany({
        data: schedules.map((s) => ({
          foodItemId: foodItem.id,
          targetType: s.targetType,
          scheduleType: s.scheduleType,
          scheduledAt: s.scheduledAt,
          status: "PENDING"
        }))
      });

      return foodItem;
    });

    return {
      foodItemId: result.id,
      status: result.status
    };
  });

  app.patch("/v1/foods/:foodItemId", async (request, reply) => {
    const foodItemId = String((request.params as { foodItemId: string }).foodItemId);
    const parsed = UpdateFoodRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const actorMemberId = assertActor(request);
    const actorMemberRole = assertActorRole(request);

    const existing = await prisma.foodItem.findUnique({
      where: { id: foodItemId }
    });

    if (!existing) {
      return reply.notFound("Food item not found");
    }

    if (!canEditFoodItem(actorMemberId, existing.memberId, actorMemberRole)) {
      return reply.forbidden("You can only edit your own food entries");
    }

    const fieldUpdates: {
      foodName?: string;
      expiryDate?: Date;
    } = {};

    if (parsed.data.foodName) {
      fieldUpdates.foodName = parsed.data.foodName;
    }

    if (parsed.data.expiryDate) {
      const expiryDate = parseDateOnly(parsed.data.expiryDate);
      if (!isExpiryWithinSixMonths(existing.registeredAt, expiryDate)) {
        return reply.badRequest("expiryDate must be within 6 months from registeredAt");
      }
      fieldUpdates.expiryDate = expiryDate;
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        let item = existing;

        const hasFieldUpdates = Boolean(fieldUpdates.foodName || fieldUpdates.expiryDate);
        if (hasFieldUpdates) {
          item = await tx.foodItem.update({
            where: { id: foodItemId },
            data: fieldUpdates
          });

          await tx.foodItemEvent.create({
            data: {
              foodItemId,
              actorMemberId,
              eventType: "FOOD_UPDATED",
              payloadJson: {
                foodName: parsed.data.foodName,
                expiryDate: parsed.data.expiryDate
              }
            }
          });
        }

        if (parsed.data.status) {
          if (isResolvableFoodStatus(parsed.data.status)) {
            const transition = await transitionFoodItemStatus({
              db: tx,
              foodItemId,
              nextStatus: parsed.data.status,
              actorMemberId,
              actorMemberRole,
              source: actorMemberRole === "ADMIN" ? "ADMIN" : "API"
            });
            item = transition.foodItem;
          } else if (parsed.data.status !== item.status) {
            throw new FoodStatusTransitionError("This status transition is not supported", 400);
          }
        }

        return item;
      });

      return {
        foodItemId: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt
      };
    } catch (error) {
      return sendTransitionError(reply, error);
    }
  });

  app.get("/v1/foods/me", async (request) => {
    const actorMemberId = assertActor(request);
    const query = request.query as {
      status?: "REGISTERED" | "TAKEN_OUT" | "DISPOSED" | "EXPIRED";
      from?: string;
      to?: string;
    };

    const where = {
      memberId: actorMemberId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            expiryDate: {
              ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to) } : {})
            }
          }
        : {})
    };

    const items = await prisma.foodItem.findMany({
      where,
      orderBy: { registeredAt: "desc" },
      include: {
        assets: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        foodName: item.foodName,
        status: item.status,
        expiryDate: item.expiryDate,
        registeredAt: item.registeredAt,
        isOverdue: item.status === "REGISTERED" && item.expiryDate.getTime() < Date.now(),
        photoObjectKey: item.assets[0]?.photoObjectKey ?? null,
        audioObjectKey: item.assets[0]?.audioObjectKey ?? null
      }))
    };
  });
}

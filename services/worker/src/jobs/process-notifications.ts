import { NotificationStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { buildIdempotencyKey } from "../lib/idempotency.js";
import {
  buildOwnerReminderMessage,
  lookupSlackUserIdByEmail,
  sendAdminFallback,
  sendDirectMessage
} from "../lib/slack.js";

const MAX_RETRY = 5;

function nextStatusFromAttempt(success: boolean): NotificationStatus {
  return success ? "SENT" : "FAILED_RETRY";
}

export async function processDueNotifications(now = new Date()) {
  const dueSchedules = await prisma.notificationSchedule.findMany({
    where: {
      status: { in: ["PENDING", "FAILED_RETRY"] },
      scheduledAt: { lte: now }
    },
    include: {
      foodItem: {
        include: {
          member: true
        }
      }
    },
    take: 100,
    orderBy: { scheduledAt: "asc" }
  });

  for (const schedule of dueSchedules) {
    const idempotencyKey = buildIdempotencyKey({
      foodItemId: schedule.foodItemId,
      targetType: schedule.targetType,
      scheduleType: schedule.scheduleType,
      scheduledAt: schedule.scheduledAt
    });

    const existingAttempt = await prisma.notificationAttempt.findUnique({
      where: { idempotencyKey }
    });

    if (existingAttempt?.status === "SENT") {
      continue;
    }

    const attemptNo = existingAttempt ? existingAttempt.attemptNo + 1 : 1;
    if (attemptNo > MAX_RETRY) {
      await prisma.notificationSchedule.update({
        where: { id: schedule.id },
        data: { status: "FAILED_PERM" }
      });
      continue;
    }

    if (schedule.foodItem.status !== "REGISTERED") {
      await prisma.notificationSchedule.update({
        where: { id: schedule.id },
        data: { status: "CANCELED" }
      });
      continue;
    }

    const member = schedule.foodItem.member;
    let userId = member.slackUserId;

    if (!userId) {
      userId = await lookupSlackUserIdByEmail(member.email);

      if (userId) {
        await prisma.member.update({
          where: { id: member.id },
          data: { slackUserId: userId }
        });
      }
    }

    let success = false;
    let errorCode: string | null = null;
    let responseJson: Prisma.InputJsonValue = { delivered: false };

    if (schedule.targetType === "OWNER" && userId) {
      const message = buildOwnerReminderMessage({
        foodItemId: schedule.foodItem.id,
        foodName: schedule.foodItem.foodName,
        expiryDate: schedule.foodItem.expiryDate.toISOString().slice(0, 10)
      });
      const result = await sendDirectMessage(userId, message);
      success = result.ok;

      if (!result.ok) {
        errorCode = result.error;
        responseJson = {
          delivered: false,
          reason: errorCode
        } as Prisma.InputJsonObject;
      } else {
        responseJson = {
          delivered: true,
          channel: result.channel,
          ts: result.ts
        } as Prisma.InputJsonObject;
      }
    } else {
      const fallbackText = `[관리자 알림] 사용자 매핑 실패 또는 관리자 대상 ${member.email} / item=${schedule.foodItem.id}`;
      const fallbackResult = await sendAdminFallback(fallbackText);
      success = fallbackResult.ok;

      if (!fallbackResult.ok) {
        errorCode = fallbackResult.error;
        responseJson = {
          delivered: false,
          reason: errorCode
        } as Prisma.InputJsonObject;
      } else {
        responseJson = { delivered: true } as Prisma.InputJsonObject;
      }
    }

    await prisma.notificationAttempt.upsert({
      where: { idempotencyKey },
      create: {
        scheduleId: schedule.id,
        idempotencyKey,
        attemptNo,
        status: nextStatusFromAttempt(success),
        errorCode,
        responseJson,
        sentAt: success ? new Date() : null
      },
      update: {
        attemptNo,
        status: nextStatusFromAttempt(success),
        errorCode,
        responseJson,
        sentAt: success ? new Date() : null
      }
    });

    await prisma.notificationSchedule.update({
      where: { id: schedule.id },
      data: {
        status: success ? "SENT" : attemptNo >= MAX_RETRY ? "FAILED_PERM" : "FAILED_RETRY"
      }
    });

    if (schedule.scheduleType === "OWNER_WEEKLY" && success) {
      const nextWeeklyDate = new Date(schedule.scheduledAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      await prisma.notificationSchedule.create({
        data: {
          foodItemId: schedule.foodItemId,
          targetType: "OWNER",
          scheduleType: "OWNER_WEEKLY",
          scheduledAt: nextWeeklyDate,
          status: "PENDING"
        }
      });
    }
  }

  return {
    processed: dueSchedules.length
  };
}

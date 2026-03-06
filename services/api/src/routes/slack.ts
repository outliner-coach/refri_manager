import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { transitionFoodItemStatus, FoodStatusTransitionError } from "../lib/food-status.js";
import {
  lookupSlackEmailByUserId,
  postSlackEphemeralMessage,
  updateSlackResolutionMessage,
  verifySlackRequestSignature
} from "../lib/slack.js";

type SlackBlockActionPayload = {
  type: "block_actions";
  user: {
    id: string;
  };
  channel?: {
    id: string;
  };
  message?: {
    ts: string;
  };
  container?: {
    channel_id?: string;
    message_ts?: string;
  };
  actions?: Array<{
    action_id: string;
    value: string;
  }>;
};

type ResolveFoodAction = {
  foodItemId: string;
  nextStatus: "TAKEN_OUT" | "DISPOSED";
};

function getSlackMessageRef(payload: SlackBlockActionPayload) {
  return {
    channelId: payload.channel?.id ?? payload.container?.channel_id ?? null,
    messageTs: payload.message?.ts ?? payload.container?.message_ts ?? null
  };
}

export async function slackRoutes(app: FastifyInstance) {
  app.post("/v1/slack/interactivity", async (request, reply) => {
    const rawBody = typeof request.body === "string" ? request.body : "";
    if (!verifySlackRequestSignature(request.headers, rawBody)) {
      return reply.code(401).send({ error: "Invalid Slack signature" });
    }

    const payloadValue = new URLSearchParams(rawBody).get("payload");
    if (!payloadValue) {
      return reply.badRequest("payload is required");
    }

    const payload = JSON.parse(payloadValue) as SlackBlockActionPayload;
    if (payload.type !== "block_actions") {
      return { ok: true };
    }

    const action = payload.actions?.[0];
    if (!action || action.action_id !== "resolve_food_status") {
      return { ok: true };
    }

    let actor = await prisma.member.findFirst({
      where: {
        slackUserId: payload.user.id,
        status: "ACTIVE"
      }
    });

    if (!actor) {
      const slackEmail = await lookupSlackEmailByUserId(payload.user.id);

      if (slackEmail) {
        actor = await prisma.member.findFirst({
          where: {
            email: slackEmail,
            status: "ACTIVE"
          }
        });

        if (actor && actor.slackUserId !== payload.user.id) {
          actor = await prisma.member.update({
            where: { id: actor.id },
            data: { slackUserId: payload.user.id }
          });
        }
      }
    }

    const messageRef = getSlackMessageRef(payload);
    if (!messageRef.channelId) {
      return reply.badRequest("channelId is required");
    }

    if (!actor) {
      await postSlackEphemeralMessage({
        channelId: messageRef.channelId,
        userId: payload.user.id,
        text: "Slack 계정이 구성원 정보와 연결되어 있지 않습니다."
      });
      return { ok: false };
    }

    const actionValue = JSON.parse(action.value) as ResolveFoodAction;

    try {
      const transition = await transitionFoodItemStatus({
        foodItemId: actionValue.foodItemId,
        nextStatus: actionValue.nextStatus,
        actorMemberId: actor.id,
        actorMemberRole: actor.role,
        source: "SLACK"
      });

      const item = await prisma.foodItem.findUnique({
        where: { id: actionValue.foodItemId }
      });

      if (item && messageRef.messageTs) {
        await updateSlackResolutionMessage({
          channelId: messageRef.channelId,
          messageTs: messageRef.messageTs,
          foodName: item.foodName,
          status: transition.foodItem.status as "TAKEN_OUT" | "DISPOSED",
          resolvedByName: actor.name,
          alreadyResolved: !transition.changed
        });
      }

      return { ok: true };
    } catch (error) {
      if (error instanceof FoodStatusTransitionError) {
        await postSlackEphemeralMessage({
          channelId: messageRef.channelId,
          userId: payload.user.id,
          text: error.message
        });
        return { ok: false };
      }

      throw error;
    }
  });
}

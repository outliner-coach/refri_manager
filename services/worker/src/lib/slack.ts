import { Block, KnownBlock, WebClient } from "@slack/web-api";
import { env } from "@refri/config";

const client = env.SLACK_BOT_TOKEN ? new WebClient(env.SLACK_BOT_TOKEN) : null;

export function buildOwnerReminderMessage(params: {
  foodItemId: string;
  foodName: string;
  expiryDate: string;
}) {
  const buildValue = (nextStatus: "TAKEN_OUT" | "DISPOSED") =>
    JSON.stringify({
      foodItemId: params.foodItemId,
      nextStatus
    });

  return {
    text: `[냉장고 알림] ${params.foodName} / 유통기한 ${params.expiryDate}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${params.foodName}*\n유통기한: ${params.expiryDate}`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            action_id: "resolve_food_status",
            text: {
              type: "plain_text",
              text: "가져갔어요"
            },
            style: "primary",
            value: buildValue("TAKEN_OUT")
          },
          {
            type: "button",
            action_id: "resolve_food_status",
            text: {
              type: "plain_text",
              text: "폐기했어요"
            },
            style: "danger",
            value: buildValue("DISPOSED")
          }
        ]
      }
    ] as Array<Block | KnownBlock>
  };
}

export async function lookupSlackUserIdByEmail(email: string): Promise<string | null> {
  if (!client) return null;

  try {
    const result = await client.users.lookupByEmail({ email });
    return result.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function sendDirectMessage(
  userId: string,
  message: {
    text: string;
    blocks?: Array<Block | KnownBlock>;
  }
) {
  if (!client) {
    return { ok: false as const, error: "SLACK_BOT_TOKEN_NOT_SET" };
  }

  try {
    const payload: {
      channel: string;
      text: string;
      blocks?: Array<Block | KnownBlock>;
    } = {
      channel: userId,
      text: message.text
    };
    if (message.blocks) {
      payload.blocks = message.blocks;
    }
    const result = await client.chat.postMessage(payload);
    return {
      ok: true as const,
      channel: result.channel ?? null,
      ts: result.ts ?? null
    };
  } catch (error) {
    return { ok: false as const, error: String(error) };
  }
}

export async function sendAdminFallback(text: string) {
  if (!client) {
    return { ok: false as const, error: "SLACK_BOT_TOKEN_NOT_SET" };
  }

  try {
    await client.chat.postMessage({ channel: env.ADMIN_ALERT_CHANNEL, text });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: String(error) };
  }
}

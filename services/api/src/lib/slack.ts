import { env } from "@refri/config";
import { WebClient } from "@slack/web-api";
import { createHmac, timingSafeEqual } from "node:crypto";

const client = env.SLACK_BOT_TOKEN ? new WebClient(env.SLACK_BOT_TOKEN) : null;
const SLACK_SIGNATURE_VERSION = "v0";
const MAX_SLACK_TIMESTAMP_SKEW_SECONDS = 60 * 5;

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

export function verifySlackRequestSignature(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string
): boolean {
  if (!env.SLACK_SIGNING_SECRET) {
    return false;
  }

  const slackSignature = normalizeHeaderValue(headers["x-slack-signature"]);
  const slackTimestamp = normalizeHeaderValue(headers["x-slack-request-timestamp"]);

  if (!slackSignature || !slackTimestamp) {
    return false;
  }

  const parsedTimestamp = Number(slackTimestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    return false;
  }

  if (Math.abs(Math.floor(Date.now() / 1000) - parsedTimestamp) > MAX_SLACK_TIMESTAMP_SKEW_SECONDS) {
    return false;
  }

  const baseString = `${SLACK_SIGNATURE_VERSION}:${slackTimestamp}:${rawBody}`;
  const expectedSignature = `${SLACK_SIGNATURE_VERSION}=${createHmac("sha256", env.SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest("hex")}`;

  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(slackSignature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function updateSlackResolutionMessage(params: {
  channelId: string;
  messageTs: string;
  foodName: string;
  status: "TAKEN_OUT" | "DISPOSED";
  resolvedByName: string;
  alreadyResolved?: boolean;
}) {
  if (!client) {
    return { ok: false as const, error: "SLACK_BOT_TOKEN_NOT_SET" };
  }

  const statusLabel = params.status === "TAKEN_OUT" ? "가져감" : "폐기";
  const detail = params.alreadyResolved ? "이미 처리된 항목입니다." : "상태가 처리되었습니다.";

  try {
    await client.chat.update({
      channel: params.channelId,
      ts: params.messageTs,
      text: `[냉장고 알림] ${params.foodName} / ${statusLabel} 처리`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${params.foodName}*\n${statusLabel} 처리 완료`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `${detail} 담당: ${params.resolvedByName}`
            }
          ]
        }
      ]
    });

    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: String(error) };
  }
}

export async function lookupSlackUserIdByEmail(email: string): Promise<string | null> {
  if (!client) {
    return null;
  }

  try {
    const result = await client.users.lookupByEmail({ email });
    return result.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function lookupSlackEmailByUserId(userId: string): Promise<string | null> {
  if (!client) {
    return null;
  }

  try {
    const result = await client.users.info({ user: userId });
    return result.user?.profile?.email ?? null;
  } catch {
    return null;
  }
}

export async function postSlackEphemeralMessage(params: {
  channelId: string;
  userId: string;
  text: string;
}) {
  if (!client) {
    return { ok: false as const, error: "SLACK_BOT_TOKEN_NOT_SET" };
  }

  try {
    await client.chat.postEphemeral({
      channel: params.channelId,
      user: params.userId,
      text: params.text
    });

    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: String(error) };
  }
}

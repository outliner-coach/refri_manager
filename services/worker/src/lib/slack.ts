import { WebClient } from "@slack/web-api";
import { env } from "@refri/config";

const client = env.SLACK_BOT_TOKEN ? new WebClient(env.SLACK_BOT_TOKEN) : null;

export async function lookupSlackUserIdByEmail(email: string): Promise<string | null> {
  if (!client) return null;

  try {
    const result = await client.users.lookupByEmail({ email });
    return result.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function sendDirectMessage(userId: string, text: string) {
  if (!client) {
    return { ok: false as const, error: "SLACK_BOT_TOKEN_NOT_SET" };
  }

  try {
    await client.chat.postMessage({ channel: userId, text });
    return { ok: true as const };
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

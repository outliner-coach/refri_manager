import { google } from "googleapis";
import { env } from "@refri/config";
import { prisma } from "../db.js";
import { MemberRole } from "./member-role.js";
import { lookupSlackUserIdByEmail } from "./slack.js";

export type SyncResult = {
  syncedCount: number;
  updatedCount: number;
  failedCount: number;
};

export type ParsedSheetMember = {
  employeeNo: string;
  name: string;
  department: string;
  email: string;
  role: MemberRole;
};

function getGoogleAuthJson() {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required");
  }
  return JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

function normalizeCell(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeEmail(value: unknown): string | null {
  const normalized = normalizeCell(value).toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

export function parseAdminEmailRows(rows: unknown[][]): Set<string> {
  const adminEmails = new Set<string>();

  for (const row of rows) {
    const adminEmail = normalizeEmail(row[0]);
    if (adminEmail) {
      adminEmails.add(adminEmail);
    }
  }

  return adminEmails;
}

export function parseMemberRows(
  rows: unknown[][],
  adminEmails: Set<string>
): {
  members: ParsedSheetMember[];
  failedCount: number;
} {
  if (rows.length === 0) {
    return {
      members: [],
      failedCount: 0
    };
  }

  const members: ParsedSheetMember[] = [];
  let failedCount = 0;

  for (const row of rows.slice(1)) {
    const employeeNo = normalizeCell(row[0]);
    const name = normalizeCell(row[1]);
    const department = normalizeCell(row[2]);
    const email = normalizeCell(row[3]);
    const normalizedEmail = normalizeEmail(email);

    if (!employeeNo || !name || !department || !normalizedEmail) {
      failedCount += 1;
      continue;
    }

    members.push({
      employeeNo,
      name,
      department,
      email,
      role: adminEmails.has(normalizedEmail) ? "ADMIN" : "MEMBER"
    });
  }

  return {
    members,
    failedCount
  };
}

export async function syncMembersFromSheets(): Promise<SyncResult> {
  if (!env.GOOGLE_SHEETS_ID) {
    throw new Error("GOOGLE_SHEETS_ID is required");
  }

  const authJson = getGoogleAuthJson();
  const auth = new google.auth.GoogleAuth({
    credentials: authJson,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    ranges: [env.GOOGLE_SHEETS_MEMBERS_RANGE, env.GOOGLE_SHEETS_ADMINS_RANGE]
  });

  const valueRanges = response.data.valueRanges ?? [];
  const memberRows = valueRanges[0]?.values ?? [];
  const adminRows = valueRanges[1]?.values ?? [];

  const adminEmails = parseAdminEmailRows(adminRows);
  const { members, failedCount: parseFailedCount } = parseMemberRows(memberRows, adminEmails);
  const slackUserIdCache = new Map<string, string | null>();
  const shouldSyncSlackUserId = Boolean(env.SLACK_BOT_TOKEN);

  let syncedCount = 0;
  let updatedCount = 0;
  let failedCount = parseFailedCount;

  for (const member of members) {
    const normalizedEmail = normalizeEmail(member.email) ?? member.email.toLowerCase();
    let slackUserId = slackUserIdCache.get(normalizedEmail) ?? null;

    if (shouldSyncSlackUserId && !slackUserIdCache.has(normalizedEmail)) {
      slackUserId = await lookupSlackUserIdByEmail(member.email);
      slackUserIdCache.set(normalizedEmail, slackUserId);
    }

    try {
      const result = await prisma.member.upsert({
        where: { employeeNo: member.employeeNo },
        update: {
          name: member.name,
          department: member.department,
          email: member.email,
          status: "ACTIVE",
          role: member.role,
          ...(shouldSyncSlackUserId ? { slackUserId } : {}),
          syncedAt: new Date()
        },
        create: {
          employeeNo: member.employeeNo,
          name: member.name,
          department: member.department,
          email: member.email,
          status: "ACTIVE",
          role: member.role,
          slackUserId: shouldSyncSlackUserId ? slackUserId : null,
          syncedAt: new Date()
        }
      });

      syncedCount += 1;
      if (result) {
        updatedCount += 1;
      }
    } catch {
      failedCount += 1;
    }
  }

  return { syncedCount, updatedCount, failedCount };
}

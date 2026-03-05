import { google } from "googleapis";
import { env } from "@refri/config";
import { prisma } from "../db.js";

export type SyncResult = {
  syncedCount: number;
  updatedCount: number;
  failedCount: number;
};

function getGoogleAuthJson() {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required");
  }
  return JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
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
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    range: env.GOOGLE_SHEETS_RANGE
  });

  const rows = response.data.values ?? [];
  const dataRows = rows.slice(1);

  let syncedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (const row of dataRows) {
    const [employeeNo, name, department, email, status, slackUserId] = row;

    if (!employeeNo || !name || !department || !email) {
      failedCount += 1;
      continue;
    }

    try {
      const result = await prisma.member.upsert({
        where: { employeeNo: String(employeeNo) },
        update: {
          name: String(name),
          department: String(department),
          email: String(email),
          status: String(status) === "INACTIVE" ? "INACTIVE" : "ACTIVE",
          slackUserId: slackUserId ? String(slackUserId) : null,
          syncedAt: new Date()
        },
        create: {
          employeeNo: String(employeeNo),
          name: String(name),
          department: String(department),
          email: String(email),
          status: String(status) === "INACTIVE" ? "INACTIVE" : "ACTIVE",
          slackUserId: slackUserId ? String(slackUserId) : null,
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

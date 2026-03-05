import { FastifyInstance } from "fastify";
import { syncMembersFromSheets } from "../lib/google-sheets.js";

export async function internalRoutes(app: FastifyInstance) {
  app.post("/v1/internal/sync/members", async () => {
    const result = await syncMembersFromSheets();
    return result;
  });
}

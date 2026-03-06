import { FastifyInstance } from "fastify";
import { UploadUrlRequestSchema } from "@refri/shared-types";
import { env } from "@refri/config";
import { createUploadUrl } from "../lib/storage.js";

export async function assetsRoutes(app: FastifyInstance) {
  app.post("/v1/assets/upload-url", async (request, reply) => {
    const parsed = UploadUrlRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const forwardedHost = request.headers["x-forwarded-host"];
    const rawHost = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost ?? request.headers.host ?? request.hostname;
    const host = rawHost?.split(",")[0]?.trim()?.replace(/:\d+$/, "");

    const forwardedProto = request.headers["x-forwarded-proto"];
    const protoFromHeader = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const protocol = protoFromHeader?.split(",")[0]?.trim() || request.protocol || "http";

    const signingEndpoint = host
      ? protocol === "https"
        ? `${protocol}://${host}`
        : `${protocol}://${host}:${env.MINIO_PUBLIC_PORT}`
      : env.MINIO_PUBLIC_ENDPOINT;

    const result = await createUploadUrl(parsed.data, signingEndpoint);
    if (host && protocol === "https") {
      const url = new URL(result.uploadUrl);
      url.pathname = `/storage${url.pathname}`;
      result.uploadUrl = url.toString();
    }
    return result;
  });
}

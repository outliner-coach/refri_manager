import fp from "fastify-plugin";
import { FastifyRequest } from "fastify";
import { prisma } from "../db.js";
import { MemberRole } from "../lib/member-role.js";

declare module "fastify" {
  interface FastifyRequest {
    actorMemberId?: string;
    actorMemberRole?: MemberRole;
  }
}

async function resolveActor(request: FastifyRequest) {
  const employeeNo = request.headers["x-employee-no"];
  if (employeeNo && !Array.isArray(employeeNo)) {
    const member = await prisma.member.findUnique({
      where: { employeeNo }
    });
    return member?.status === "ACTIVE" ? member : null;
  }

  const memberId = request.headers["x-member-id"];
  if (memberId && !Array.isArray(memberId)) {
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });
    return member?.status === "ACTIVE" ? member : null;
  }

  return null;
}

export const actorPlugin = fp(async (fastify) => {
  fastify.decorateRequest("actorMemberId", undefined);
  fastify.decorateRequest("actorMemberRole", undefined);

  fastify.addHook("preHandler", async (request) => {
    const url = request.url.split("?")[0];
    if (
      url === "/v1/auth/employee-lookup" ||
      url === "/v1/auth/name-lookup" ||
      url === "/v1/intake/transcribe" ||
      url === "/v1/slack/interactivity" ||
      url === "/health" ||
      url === "/v1/internal/sync/members"
    ) {
      return;
    }

    const member = await resolveActor(request);
    if (!member) {
      throw fastify.httpErrors.unauthorized(
        "x-employee-no or x-member-id header is required and must match an active member"
      );
    }

    request.actorMemberId = member.id;
    request.actorMemberRole = member.role;
  });
});

import { FastifyInstance } from "fastify";
import { EmployeeLookupRequestSchema, NameLookupRequestSchema } from "@refri/shared-types";
import { prisma } from "../db.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/v1/auth/employee-lookup", async (request, reply) => {
    const parsed = EmployeeLookupRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const member = await prisma.member.findUnique({
      where: { employeeNo: parsed.data.employeeNo }
    });

    if (!member) {
      return reply.notFound("Member not found");
    }

    return {
      memberId: member.id,
      employeeNo: member.employeeNo,
      name: member.name,
      department: member.department,
      email: member.email,
      status: member.status
    };
  });

  app.post("/v1/auth/name-lookup", async (request, reply) => {
    const parsed = NameLookupRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const nameQuery = parsed.data.nameQuery.trim();
    if (!nameQuery) {
      return reply.badRequest("nameQuery is required");
    }

    const candidates = await prisma.member.findMany({
      where: {
        status: "ACTIVE",
        name: {
          contains: nameQuery
        }
      },
      orderBy: [{ name: "asc" }, { employeeNo: "asc" }],
      take: 10
    });

    return {
      candidates: candidates.map((member) => ({
        memberId: member.id,
        name: member.name,
        department: member.department,
        employeeNoLast4: member.employeeNo.slice(-4),
        email: member.email,
        status: member.status
      }))
    };
  });
}

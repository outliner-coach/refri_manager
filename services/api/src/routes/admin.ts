import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { isAdminRole } from "../lib/authorization.js";
import { parseDateOnly } from "../lib/dates.js";
import { prisma } from "../db.js";

type AdminFoodQuery = {
  q?: string;
  status?: "ALL" | "REGISTERED" | "TAKEN_OUT" | "DISPOSED" | "EXPIRED";
  from?: string;
  to?: string;
  limit?: string;
};

function buildSearchWhere(search: string | undefined): Prisma.FoodItemWhereInput {
  if (!search) {
    return {};
  }

  return {
    OR: [
      {
        foodName: {
          contains: search
        }
      },
      {
        member: {
          is: {
            name: {
              contains: search
            }
          }
        }
      },
      {
        member: {
          is: {
            employeeNo: {
              contains: search
            }
          }
        }
      },
      {
        member: {
          is: {
            email: {
              contains: search
            }
          }
        }
      }
    ]
  };
}

function buildExpiryWhere(query: AdminFoodQuery): Prisma.DateTimeFilter | undefined {
  if (!query.from && !query.to) {
    return undefined;
  }

  return {
    ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
    ...(query.to ? { lte: parseDateOnly(query.to) } : {})
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/v1/admin/foods", async (request, reply) => {
    if (!isAdminRole(request.actorMemberRole)) {
      return reply.forbidden("Admin role is required");
    }

    const query = request.query as AdminFoodQuery;
    const search = query.q?.trim();
    const limit = Math.min(Math.max(Number(query.limit ?? 100) || 100, 1), 200);
    const statusFilter = query.status && query.status !== "ALL" ? query.status : undefined;
    const now = new Date();
    const searchWhere = buildSearchWhere(search);
    const expiryWhere = buildExpiryWhere(query);
    const baseWhere: Prisma.FoodItemWhereInput = {
      ...searchWhere,
      ...(expiryWhere ? { expiryDate: expiryWhere } : {})
    };
    const filteredWhere: Prisma.FoodItemWhereInput = {
      ...baseWhere,
      ...(statusFilter ? { status: statusFilter } : {})
    };
    const overdueWhere: Prisma.FoodItemWhereInput = {
      ...searchWhere,
      status: "REGISTERED",
      expiryDate: {
        ...(expiryWhere ?? {}),
        lt: now
      }
    };

    const [items, totalCount, registeredCount, takenOutCount, disposedCount, expiredCount, overdueCount] =
      await prisma.$transaction([
        prisma.foodItem.findMany({
          where: filteredWhere,
          include: {
            member: true,
            assets: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          },
          orderBy: [{ registeredAt: "desc" }, { expiryDate: "asc" }],
          take: limit
        }),
        prisma.foodItem.count({ where: baseWhere }),
        prisma.foodItem.count({ where: { ...baseWhere, status: "REGISTERED" } }),
        prisma.foodItem.count({ where: { ...baseWhere, status: "TAKEN_OUT" } }),
        prisma.foodItem.count({ where: { ...baseWhere, status: "DISPOSED" } }),
        prisma.foodItem.count({ where: { ...baseWhere, status: "EXPIRED" } }),
        prisma.foodItem.count({ where: overdueWhere })
      ]);

    return {
      summary: {
        total: totalCount,
        registered: registeredCount,
        takenOut: takenOutCount,
        disposed: disposedCount,
        expired: expiredCount,
        overdue: overdueCount
      },
      limit,
      items: items.map((item) => ({
        id: item.id,
        foodName: item.foodName,
        expiryDate: item.expiryDate,
        registeredAt: item.registeredAt,
        status: item.status,
        isOverdue: item.status === "REGISTERED" && item.expiryDate.getTime() < now.getTime(),
        owner: {
          memberId: item.member.id,
          name: item.member.name,
          department: item.member.department,
          employeeNoLast4: item.member.employeeNo.slice(-4),
          email: item.member.email
        },
        photoObjectKey: item.assets[0]?.photoObjectKey ?? null
      }))
    };
  });
}

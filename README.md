# Refri Manager

M1+M2 implementation scaffold for company fridge operations automation.

## Stack

- Node.js + TypeScript
- Fastify API + Prisma (MySQL)
- Worker (scheduling + notification skeleton)
- Next.js apps (tablet-web, admin-web)
- MinIO/S3 compatible object storage

## Quick start

1. Fill `.env` from `.env.example`
2. Install dependencies: `pnpm install`
3. Start API: `pnpm dev:api`
4. Start worker: `pnpm dev:worker`
5. Start tablet app: `pnpm dev:tablet`

## Docker (local infra)

### Full stack up (MySQL + MinIO + API + Worker)

```bash
pnpm docker:up
```

### Smoke test

```bash
pnpm docker:smoke
```

This smoke test validates:
- health check
- employee lookup
- food registration
- list my foods

### Shutdown

```bash
pnpm docker:down
```

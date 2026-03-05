FROM node:20-alpine

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY services/api ./services/api
COPY services/worker ./services/worker

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @refri/api prisma:generate

CMD ["pnpm", "--filter", "@refri/worker", "start"]

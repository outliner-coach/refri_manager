#!/usr/bin/env bash
set -euo pipefail
pnpm install
pnpm --filter @refri/api prisma:generate

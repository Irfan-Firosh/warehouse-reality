# syntax=docker/dockerfile:1
# Live app image: one long-lived Node process serving Next.js standalone output.
# Runs are held in memory (lib/run/registry.ts), so run exactly one instance.
# See docs/deploy.md.

# Matches .nvmrc. Debian slim (glibc) because pnpm 12 runs as a native binary.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Pinned corepack; it installs the pnpm version named in package.json's packageManager.
RUN npm install -g corepack@0.36.0 && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# next build copies .env and .env.production into the standalone output.
# .dockerignore keeps them out; fail the build if one ever gets in.
RUN test -z "$(find .next/standalone -maxdepth 1 -name '.env*')"

FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# server.js does not serve public/ or .next/static unless they sit beside it.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

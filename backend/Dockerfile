# Multi-stage Dockerfile for the Vista Chase Express API
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS dependencies
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV production
ENV PORT 4000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/media ./media
COPY --from=builder --chown=api:nodejs /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts/start-production.js ./scripts/start-production.js

USER api
EXPOSE 4000

# Applies pending migrations, then starts the API (the worker overrides this command).
CMD ["node", "scripts/start-production.js"]

# Multi-stage production-ready Dockerfile for the Vista Chase Next.js frontend
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS dependencies
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
# The /api/* rewrite target is baked in at build time
ARG BACKEND_URL=http://backend:4000
ENV BACKEND_URL $BACKEND_URL
RUN npm run build

FROM base AS runner
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

USER nextjs
EXPOSE 3000

CMD ["npm", "run", "start"]

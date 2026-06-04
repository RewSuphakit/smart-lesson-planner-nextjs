# ================================
# Stage 1: Dependencies
# ================================
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# ================================
# Stage 1.5: Production Dependencies
# ================================
FROM node:20-alpine AS deps-prod
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

# ================================
# Stage 1.7: Migration Builder
# ================================
FROM node:20-alpine AS migration-builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="mysql://mariadb:WAQnqzyxpPb7D5wpXhcbbtRdNeI0TUI0w67RevIFE8WQZbDkgHQ61SV8I5Jpw8U9@185.241.210.72:5433/smart_lesson_planner"
RUN npx prisma generate

# ================================
# Stage 2: Builder
# ================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set dummy variables for build time
ENV DATABASE_URL="mysql://mariadb:WAQnqzyxpPb7D5wpXhcbbtRdNeI0TUI0w67RevIFE8WQZbDkgHQ61SV8I5Jpw8U9@185.241.210.72:5433/smart_lesson_planner"
ENV JWT_SECRET="change-this-to-a-secure-secret-key"

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# ================================
# Stage 3: Runner
# ================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma


USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node server.js"]

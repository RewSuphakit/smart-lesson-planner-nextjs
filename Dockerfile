# ================================
# ขั้นที่ 1: ติดตั้ง dependency ทั้งหมด (สำหรับ build)
# ================================
FROM node:20-alpine AS deps
WORKDIR /app

# ติดตั้ง OpenSSL สำหรับ Prisma engine บน Alpine
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# ================================
# ขั้นที่ 2: ติดตั้งเฉพาะ dependency สำหรับ production
# ================================
FROM node:20-alpine AS deps-prod
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

# ================================
# ขั้นที่ 3: Build แอป Next.js
# ================================
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ใช้ DATABASE_URL ปลอมสำหรับ Prisma ตอน build เท่านั้น
# ค่าจริงจะถูกส่งเข้ามาตอน runtime ผ่าน environment variables
ENV DATABASE_URL="mysql://user:password@localhost:3306/placeholder"
ENV JWT_SECRET="build-time-placeholder"
ENV NEXT_TELEMETRY_DISABLED=1


# สร้าง Prisma client + build Next.js (standalone output)
RUN npx prisma generate && npm run build

# ================================
# ขั้นที่ 4: รัน production
# ================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache openssl

# สร้าง user ที่ไม่ใช่ root เพื่อความปลอดภัย
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# คัดลอกแอปที่ build แล้วจาก builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# คัดลอก Prisma schema + client ที่ generate แล้ว สำหรับรัน migration ตอน startup
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# คัดลอก node_modules สำหรับ production (เขียนทับ modules ที่ standalone มีไม่ครบ)
COPY --from=deps-prod /app/node_modules ./node_modules
# คัดลอก Prisma client ที่ generate แล้วทับอีกครั้ง (deps-prod ไม่มี)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# สร้างโฟลเดอร์ uploads และตั้งค่า ownership
RUN mkdir -p /app/public/uploads && \
    chown -R nextjs:nodejs /app

# Entrypoint script: รัน migration ก่อนแล้วค่อยเริ่ม server
COPY --chown=nextjs:nodejs <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e
echo "🔄 Running Prisma schema sync (db push)..."
npx prisma db push --skip-generate
echo "✅ Database schema synced"
echo "🚀 Starting Next.js server..."
exec node server.js
EOF
RUN chmod +x /app/entrypoint.sh && sed -i 's/\r$//' /app/entrypoint.sh

USER nextjs

EXPOSE 3000

CMD ["/app/entrypoint.sh"]

# ================================
# ขั้นที่ 5: รัน migration (ใช้โดย db-migrate service ใน docker-compose)
# ================================
FROM node:20-alpine AS migration-builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# URL ปลอม — ค่าจริงจะถูกส่งเข้ามาตอน runtime โดย docker-compose
ENV DATABASE_URL="mysql://user:password@localhost:3306/placeholder"

RUN npx prisma generate

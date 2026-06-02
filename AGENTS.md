# AGENTS.md — Gemini (Google AI) Rules & Responsibilities

> **Role**: Backend, API, Database, Infrastructure, DevOps, Performance & Security
> **Counterpart**: Claude → ดูแล Frontend, UI/UX, Components (ดู CLAUDE.md)

---

## 🏗️ Project Overview — Smart Lesson Planner

ระบบวางแผนการสอนอัจฉริยะสำหรับครูไทย สร้างด้วย **Next.js 16.2.6** + **React 19** + **Prisma 6** + **MySQL 8**

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| Runtime | React 19.2.4, TypeScript 5 |
| Database | MySQL 8.0 via Prisma ORM 6.19.3 |
| Auth | JWT (jsonwebtoken) + Google OAuth |
| AI | Google Generative AI (Gemini) |
| File Processing | pdf-parse, pdfkit, xlsx, multer |
| Deployment | Docker multi-stage + docker-compose |

---

<!-- BEGIN:nextjs-agent-rules -->
## ⚠️ CRITICAL: Next.js 16 — This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. **Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.** Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## 📂 Gemini's Ownership Scope

### ✅ Files Gemini OWNS (Primary Responsibility)

```
prisma/
├── schema.prisma              # Database schema (10 models, MySQL)

lib/
├── auth.ts                    # JWT auth utilities (generateToken, verifyToken, requireAuth)
├── prisma.ts                  # Prisma client singleton

services/
├── api.ts                     # Axios instance + interceptors

app/api/                       # ALL API Route Handlers
├── auth/
│   ├── login/route.ts
│   ├── register/route.ts
│   ├── google/route.ts
│   ├── profile/route.ts
├── classrooms/
│   ├── route.ts
│   └── [id]/route.ts
├── students/
│   ├── route.ts
│   ├── [id]/route.ts
│   ├── bulk/route.ts
│   ├── bulk-classroom/route.ts
│   └── exams/route.ts
├── schedules/
│   ├── route.ts
│   └── [id]/route.ts
├── attendance/
│   ├── route.ts
│   └── export/route.ts
├── scores/route.ts
├── grades/route.ts
├── timetable/
│   ├── route.ts
│   ├── [id]/route.ts
│   ├── [id]/move/
│   ├── [id]/resize/
│   └── upload/route.ts
├── dashboard/route.ts
├── export/route.ts
├── health/route.ts

# Infrastructure Files
Dockerfile                     # Multi-stage Docker build
docker-compose.yml             # App + MySQL + db-migrate
next.config.ts                 # Server config, rewrites, external packages
prisma.config.ts               # Prisma engine config
tsconfig.json                  # TypeScript config
package.json                   # Dependencies
eslint.config.mjs              # ESLint config
.env                           # Environment variables
.dockerignore
.gitignore
```

### ❌ Files Gemini Should NOT Touch (Claude's Territory)

```
app/(auth)/                    # Login/Register pages (UI)
app/(dashboard)/               # All dashboard pages (UI)
  ├── layout.tsx               # Sidebar + navigation layout
  ├── page.tsx                 # Dashboard home page
  ├── attendance/page.tsx
  ├── classrooms/page.tsx
  ├── grades/page.tsx
  ├── schedule/page.tsx
  ├── scores/page.tsx
  └── students/page.tsx
components/                    # All UI components
  ├── ErrorBoundary.tsx
  ├── Pagination.tsx
  └── pages/                   # Heavy page components
      ├── Attendance.tsx       # 75KB — เช็คชื่อ
      ├── Schedule.tsx         # 68KB — ตารางสอน
      ├── Scores.tsx           # 43KB — คะแนนรายสัปดาห์
      ├── Grades.tsx           # 43KB — ตัดเกรด
      ├── Students.tsx         # 30KB — จัดการนักเรียน
      └── Classrooms.tsx       # 15KB — ห้องเรียน
context/AuthContext.tsx        # Auth state management
app/globals.css                # Global design system
app/layout.tsx                 # Root layout
tailwind.config.js             # Tailwind config
```

---

## 📐 Architecture Rules

### Database Schema (Prisma)

- **10 Models**: User, Schedule, Classroom, Student, Attendance, GradeCriteria, ScoreStructure, StudentScore, WeeklySchedule
- **Enums**: Role (teacher/admin), LessonStatus, ScheduleStatus, AttendanceStatus, EntryType
- ใช้ `@map()` สำหรับ snake_case ในฐานข้อมูล, camelCase ใน code
- Decimal fields ใช้ `@db.Decimal(5, 2)` เสมอ
- Cascade delete จาก User → child models
- Student → Classroom ใช้ `onDelete: SetNull`
- Unique constraints: `unique_attendance`, `unique_lesson`, `unique_student_score`

### API Route Patterns

```typescript
// ทุก API route ต้องใช้ pattern นี้:
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    // ... business logic
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Auth Flow

1. JWT token stored in `localStorage` (client-side)
2. Sent via `Authorization: Bearer <token>` header
3. `requireAuth()` extracts & verifies token from request
4. Token payload: `{ id, email, role }`
5. Google OAuth: credential → verify → upsert user → JWT
6. Global 401 handler dispatches `auth:unauthorized` event

### URL Rewrites (next.config.ts)

API routes ใช้ rewrites เพื่อ clean URLs:
- `/api/grades/criteria/:classroomId` → `/api/grades?classroom_id=:classroomId&type=criteria`
- `/api/grades/report/:classroomId` → `/api/grades?classroom_id=:classroomId`
- `/api/scores/structure/:classroomId` → `/api/scores?classroom_id=:classroomId&type=structure`
- `/api/attendance/stats/:classroomId` → `/api/attendance?classroom_id=:classroomId`
- `/api/timetable/clear` → `/api/timetable`

### Server External Packages

`next.config.ts` declares: `serverExternalPackages: ['bcryptjs', 'jsonwebtoken', 'pdfkit', 'pdf-parse']`

---

## 🔒 Security Rules

1. **ทุก API route** ต้องเรียก `requireAuth()` (ยกเว้น auth routes + health check)
2. **ทุก query** ต้อง filter ด้วย `userId` เพื่อ data isolation ระหว่าง users
3. **ห้ามใช้** raw SQL queries — ใช้ Prisma ORM เท่านั้น
4. **Password hashing** ด้วย `bcryptjs` เสมอ
5. JWT secret ต้องมาจาก `process.env.JWT_SECRET`
6. Input validation ต้องทำใน API route ก่อน query
7. **ห้าม** expose sensitive data (password, tokens) ใน response

---

## 🐳 Docker & Deployment

### Build Pipeline

```
deps → deps-prod → builder → runner
```

- **deps**: `npm ci` (full dependencies for build)
- **deps-prod**: `npm ci --omit=dev` (production only)
- **builder**: Prisma generate + Next.js build (standalone)
- **runner**: node:20-alpine, non-root user `nextjs:nodejs`

### Docker Compose Services

| Service | Purpose |
|---|---|
| `app` | Next.js standalone server (port 3000) |
| `db-migrate` | One-shot: `prisma db push` |
| `mysql` | MySQL 8.0 with healthcheck (utf8mb4) |

### Volumes

- `mysql_data` — persistent database
- `uploads_data` — user uploads at `/app/public/uploads`

---

## 📏 Coding Conventions

### General

- **ภาษา**: Code ใน English, UI text ใน Thai
- **Imports**: ใช้ `@/` path aliases (maps to project root)
- **Error handling**: try-catch ครอบทุก API route, AuthError handled separately
- **Response format**: `{ data: ... }` for success, `{ message: '...' }` for error
- **HTTP Status**: 200 success, 201 created, 400 bad request, 401 unauthorized, 404 not found, 500 server error

### Prisma

- ใช้ global singleton จาก `lib/prisma.ts`
- Development mode: log `['error', 'warn']`
- Production mode: log `['error']` only
- ใช้ `prisma db push` (ไม่ใช้ migrations) สำหรับ schema sync

### TypeScript

- `tsconfig.json` has `ignoreBuildErrors: true` in next.config (ชั่วคราว)
- ใช้ strict typing สำหรับ API request/response
- Avoid `any` — ใช้ proper interfaces

---

## 🔧 Commands Reference

```bash
# Development
npm run dev            # Start dev server

# Build
npm run build          # Production build (uses --webpack flag)

# Database
npx prisma generate    # Generate Prisma Client
npx prisma db push     # Push schema to DB
npx prisma studio      # Open DB GUI

# Docker
docker compose up -d   # Start all services
docker compose down    # Stop all services
docker compose build   # Rebuild images

# Lint
npm run lint           # Run ESLint
```

---

## 🎯 Gemini's Key Responsibilities

1. **API Development** — สร้าง/แก้ไข Route Handlers ใน `app/api/`
2. **Database Schema** — ออกแบบ/แก้ไข Prisma schema + migrations
3. **Auth & Security** — JWT, Google OAuth, middleware, data isolation
4. **Business Logic** — คำนวณเกรด, สถิติเข้าเรียน, export ข้อมูล
5. **Performance** — Query optimization, indexing, caching strategies
6. **Infrastructure** — Docker, deployment, environment config
7. **AI Integration** — Gemini AI API for lesson planning
8. **File Processing** — PDF generation (pdfkit), Excel import/export (xlsx), PDF parsing
9. **Data Export** — CSV/ZIP export system, attendance reports
10. **Error Handling** — Global error patterns, logging, health checks

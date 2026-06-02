# CLAUDE.md — Claude (Anthropic) Rules & Responsibilities

> **Role**: Frontend, UI/UX, Components, State Management, Design System & Accessibility
> **Counterpart**: Gemini → ดูแล Backend, API, Database, Infrastructure (ดู AGENTS.md)

---

## 🏗️ Project Overview — Smart Lesson Planner

ระบบวางแผนการสอนอัจฉริยะสำหรับครูไทย สร้างด้วย **Next.js 16.2.6** + **React 19** + **TailwindCSS 3.4** + **TypeScript 5**

### Tech Stack (Frontend)

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| UI Library | React 19.2.4 |
| Styling | TailwindCSS 3.4 + Custom CSS Design System |
| Icons | lucide-react |
| HTTP Client | axios (via `services/api.ts`) |
| Drag & Drop | @hello-pangea/dnd |
| Date Utils | date-fns (Thai locale) |
| Notifications | react-hot-toast |
| Fonts | IBM Plex Sans Thai + Inter (Google Fonts) |

---

## ⚠️ CRITICAL: Next.js 16 — This is NOT the Next.js you know

@AGENTS.md

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. **Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.** Heed deprecation notices.

---

## 📂 Claude's Ownership Scope

### ✅ Files Claude OWNS (Primary Responsibility)

```
app/(auth)/                        # Authentication Pages
├── login/page.tsx                 # หน้าล็อกอิน (3.7KB)
└── register/page.tsx              # หน้าสมัครสมาชิก (5.9KB)

app/(dashboard)/                   # Dashboard Pages
├── layout.tsx                     # Sidebar + navigation layout (7.1KB)
├── page.tsx                       # Dashboard home — stats, tasks, at-risk students (14KB)
├── attendance/page.tsx            # Route wrapper → Attendance component
├── classrooms/page.tsx            # Route wrapper → Classrooms component
├── grades/page.tsx                # Route wrapper → Grades component
├── schedule/page.tsx              # Route wrapper → Schedule component
├── scores/page.tsx                # Route wrapper → Scores component
└── students/page.tsx              # Route wrapper → Students component

components/                        # Shared Components
├── ErrorBoundary.tsx              # Class-based error boundary (2KB)
├── Pagination.tsx                 # Reusable pagination component (5KB)
└── pages/                         # Feature Page Components (Heavy)
    ├── Attendance.tsx             # เช็คชื่อนักเรียน (75KB) ⚡ largest
    ├── Schedule.tsx               # ตารางสอน + Timetable (68KB) ⚡
    ├── Scores.tsx                 # คะแนนรายสัปดาห์ (43KB)
    ├── Grades.tsx                 # ตัดเกรด + เกณฑ์ (43KB)
    ├── Students.tsx               # จัดการนักเรียน (30KB)
    └── Classrooms.tsx             # จัดการห้องเรียน (15KB)

context/
└── AuthContext.tsx                # Auth provider + hooks (3.1KB)

app/globals.css                    # Global design system (13.7KB)
app/layout.tsx                     # Root layout + providers (1.4KB)
tailwind.config.js                 # Tailwind configuration (1.2KB)
postcss.config.js                  # PostCSS config
```

### ❌ Files Claude Should NOT Touch (Gemini's Territory)

```
app/api/**                         # All API Route Handlers
prisma/                            # Database schema
lib/auth.ts                        # Server-side auth utilities
lib/prisma.ts                      # Prisma client
Dockerfile                         # Docker build
docker-compose.yml                 # Container orchestration
next.config.ts                     # Server config (rewrites, external packages)
prisma.config.ts                   # Prisma engine config
eslint.config.mjs                  # ESLint config
.env                               # Environment variables
```

### 🤝 Shared Files (Coordinate with Gemini)

```
services/api.ts                    # Axios instance — Claude uses, Gemini designs
package.json                       # Both may add dependencies
tsconfig.json                      # Both may need changes
```

---

## 🎨 Design System

### Theme — Light Pastel Glassmorphism

| Token | Value | Usage |
|---|---|---|
| Background | `#f0f4ff` | Page background |
| Foreground | `#334155` | Primary text |
| Primary | `#818cf8` / `#6366f1` | Indigo accent |
| Accent | `#34d399` / `#10b981` | Emerald success |
| Purple | `#a78bfa` / `#7c3aed` | Violet highlights |
| Danger | `#fb7185` / `#f43f5e` | Error/delete |
| Warning | `#fbbf24` / `#d97706` | Amber warnings |

### CSS Class System (globals.css)

```
# Cards
.glass           — Primary card (white/75%, blur-24, rounded-20)
.glass-light     — Secondary card (white/50%, blur-12, rounded-14)
.stat-card       — Dashboard stat card with hover lift + accent stripe

# Buttons
.btn             — Base button with hover shimmer effect
.btn-primary     — Indigo gradient (main action)
.btn-accent      — Emerald gradient (success action)
.btn-danger      — Rose gradient (delete action)
.btn-ghost       — Transparent with border

# Badges
.badge           — Base badge (pill shape)
.badge-primary   — Indigo badge
.badge-accent    — Emerald badge
.badge-warning   — Amber badge
.badge-danger    — Rose badge
.badge-purple    — Violet badge

# Forms
.form-input      — Styled input (border-indigo, focus glow)
.form-label      — Styled label (slate, uppercase-ish)

# Utilities
.gradient-text   — Animated gradient text
.skeleton        — Loading placeholder shimmer
.divider         — Gradient line separator
.progress-bar    — Progress container
.progress-fill   — Progress fill (indigo→emerald gradient)
.modal-overlay   — Blurred fullscreen overlay
.list-item       — Hover slide-right effect
.calendar-cell   — Calendar day cell
.glow-*          — Box glow effects (primary, accent, purple)
```

### Animations

| Class | Effect |
|---|---|
| `animate-fade-in-up` | Fade in + slide up (0.6s) |
| `animate-slide-in-left` | Slide from left (0.5s) |
| `animate-pulse-glow` | Pulsing box shadow (3s loop) |
| `animate-float` | Gentle float up-down (6s loop) |
| `delay-100` to `delay-400` | Stagger animation delays |

### Typography

- **Primary Font**: IBM Plex Sans Thai (supports Thai)
- **Secondary Font**: Inter (Latin fallback)
- **Weight scale**: 300–800

---

## 🧩 Component Architecture

### Page Components Pattern

Dashboard pages ใช้ thin page wrapper → heavy component:

```tsx
// app/(dashboard)/attendance/page.tsx (thin wrapper)
import Attendance from '@/components/pages/Attendance';
export default function AttendancePage() {
  return <Attendance />;
}

// components/pages/Attendance.tsx (heavy logic + UI)
'use client';
// ... all state, effects, handlers, and JSX
```

### Auth Flow (Client-side)

```
AuthContext.tsx (Provider)
├── State: user, loading
├── Methods: login, register, googleLogin, logout
├── Token storage: localStorage ('token', 'user')
├── Profile fetch: GET /api/auth/profile on mount
└── Unauthorized handler: listens for 'auth:unauthorized' event
```

### API Communication Pattern

```tsx
import api from '@/services/api';

// Always use the api instance (auto-attaches Bearer token)
const { data } = await api.get('/students?classroom_id=1');
const { data } = await api.post('/students', { name, email });
const { data } = await api.put('/students/1', { name });
await api.delete('/students/1');
```

### Dashboard Layout (app/(dashboard)/layout.tsx)

```
┌─────────────────────────────────────────────┐
│ Sidebar (270px, fixed on desktop)           │
│ ├── Logo (Smart Planner + gradient icon)    │
│ ├── Navigation (7 items)                    │
│ │   ├── แดชบอร์ด      /                     │
│ │   ├── ห้องเรียน     /classrooms           │
│ │   ├── ตารางสอน     /schedule              │
│ │   ├── นักเรียน      /students             │
│ │   ├── เช็คชื่อ       /attendance           │
│ │   ├── คะแนนรายสัปดาห์ /scores             │
│ │   └── ตัดเกรด       /grades               │
│ └── User Profile (animal emoji avatar)      │
├─────────────────────────────────────────────┤
│ Main Content (flex-1, scrollable)           │
│ ├── Mobile Header (hamburger menu, lg:hidden)│
│ └── <ErrorBoundary>{children}</ErrorBoundary>│
└─────────────────────────────────────────────┘
```

### Animal Avatar System

ใช้ emoji avatars ตาม user ID:
```tsx
const animalAvatars = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', ...];
// Selected by: animalAvatars[(user.id || 1) % animalAvatars.length]
```

---

## 📏 Coding Conventions

### General

- **ภาษา**: Code ใน English, **UI text ใน Thai** เสมอ (ระบบสำหรับครูไทย)
- **Directive**: ทุก page/component ที่ใช้ hooks ต้องมี `'use client'` at top
- **Imports**: ใช้ `@/` path alias (maps to project root)
- **Icons**: ใช้ `lucide-react` เท่านั้น — import เฉพาะ icons ที่ใช้
- **Dates**: ใช้ `date-fns` + `th` locale สำหรับ format ภาษาไทย

### State Management

- **Auth state**: ผ่าน `useAuth()` hook (from AuthContext)
- **Page state**: Local `useState` + `useEffect` (ไม่มี global state lib)
- **API calls**: Use `AbortController` for cleanup ใน useEffect
- **Loading**: Show `.skeleton` components during data fetch
- **Toast**: ใช้ `react-hot-toast` สำหรับ success/error notifications

### Responsive Design

- **Mobile**: < 1024px — sidebar hidden, hamburger menu
- **Desktop**: >= 1024px (`lg:`) — sidebar always visible
- **Grid**: ใช้ Tailwind responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- **Sidebar width**: 270px fixed

### Accessibility (WCAG AA)

- globals.css มี contrast overrides สำหรับทุก text color class
- ทุก interactive element ต้องมี `title` หรือ `aria-label`
- ใช้ semantic HTML (`<nav>`, `<main>`, `<aside>`, `<header>`)
- Focus states ต้อง visible (form-input มี focus ring)
- Minimum contrast ratio: 4.5:1 สำหรับ normal text

---

## 📐 Key API Endpoints (For Reference)

Claude ไม่แก้ API code แต่ต้องรู้ endpoints ที่ใช้:

### Auth
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Login (email, password) |
| POST | `/api/auth/register` | Register (name, email, password) |
| POST | `/api/auth/google` | Google OAuth login |
| GET | `/api/auth/profile` | Get current user profile |

### Data
| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/api/classrooms` | List/Create classrooms |
| GET/PUT/DELETE | `/api/classrooms/[id]` | CRUD single classroom |
| GET/POST | `/api/students` | List/Create students |
| GET/PUT/DELETE | `/api/students/[id]` | CRUD single student |
| POST | `/api/students/bulk` | Bulk import students |
| POST | `/api/students/bulk-classroom` | Bulk assign to classroom |
| PUT | `/api/students/exams` | Update exam scores |
| GET/POST | `/api/attendance` | Get/Save attendance records |
| GET | `/api/attendance/export` | Export attendance data |
| GET/POST/PUT | `/api/scores` | Score CRUD (structures + student scores) |
| GET/POST/PUT | `/api/grades` | Grade criteria + report |
| GET/POST | `/api/schedules` | List/Create schedules |
| GET/PUT/DELETE | `/api/schedules/[id]` | CRUD single schedule |
| GET/POST/DELETE | `/api/timetable` | Weekly timetable CRUD |
| PUT/DELETE | `/api/timetable/[id]` | Edit/Delete timetable entry |
| POST | `/api/timetable/upload` | Upload PDF timetable (AI parse) |
| PUT | `/api/timetable/[id]/move` | Move timetable entry |
| PUT | `/api/timetable/[id]/resize` | Resize timetable entry |
| GET | `/api/dashboard` | Dashboard summary data |
| GET | `/api/export` | Export all data |

### Rewrite URLs (Clean API Paths)

ระบบใช้ rewrites ใน `next.config.ts` — ฝั่ง frontend เรียก clean path ได้:
- `GET /api/grades/criteria/:classroomId` → criteria for classroom
- `GET /api/grades/report/:classroomId` → grade report for classroom
- `GET /api/scores/structure/:classroomId` → score structure for classroom
- `GET /api/attendance/stats/:classroomId` → attendance stats

---

## 🎯 Claude's Key Responsibilities

1. **UI Development** — สร้าง/แก้ไข pages และ components ทั้งหมด
2. **Design System** — ดูแล globals.css, Tailwind config, visual consistency
3. **Component Architecture** — แยก components ให้ reusable, optimize rendering
4. **State Management** — AuthContext, page-level state, form handling
5. **Responsive Design** — Mobile-first, sidebar collapse, responsive grids
6. **Accessibility** — WCAG AA compliance, contrast, keyboard navigation
7. **User Experience** — Loading states, error handling, toast notifications, animations
8. **Form Handling** — Validation, error messages, multi-step forms
9. **Data Display** — Tables, charts, calendars, stat cards
10. **Drag & Drop** — Timetable management with @hello-pangea/dnd
11. **Export UI** — Client-side CSV/ZIP generation + download flow
12. **Thai Localization** — ทุก UI text ต้องเป็นภาษาไทย ถูกต้องตามหลักภาษา

---

## 🚨 Important Notes

### Component Sizes

Page components ใน `components/pages/` มีขนาดใหญ่มาก:
- `Attendance.tsx` — 75KB (ระบบเช็คชื่อ + สถิติ + export)
- `Schedule.tsx` — 68KB (ตารางสอน + timetable grid + drag-drop)
- `Scores.tsx` / `Grades.tsx` — 43KB each (scoring + grading complex logic)

**เมื่อแก้ไข**: ระวังเรื่อง performance, อย่า re-render ทั้ง component ถ้าเปลี่ยนแค่ส่วนเดียว. พิจารณาแยก sub-components ถ้าจำเป็น.

### Build Note

`next.config.ts` มี `typescript.ignoreBuildErrors: true` — หมายความว่า TypeScript errors จะไม่ block build แต่ **Claude ต้องเขียน type-safe code** อยู่ดี.

### Dashboard Export

Dashboard page โหลด JSZip จาก CDN dynamically — ตรวจสอบ CSP policy ถ้า deploy ที่มี restrictions.

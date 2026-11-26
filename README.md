# Repz — Class Representative Attendance Management System

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg)](https://supabase.com/)

Repz is a modern, responsive web application designed exclusively for **Class Representatives** to manage attendance, student details, semester timetables, and academic deadlines for their assigned class.

> **Design & Persona Requirement:**  
> Repz is built specifically for **two class representatives sharing the same class** (Primary Rep & Co-Rep). Both representatives access identical, synchronized class records in real-time. There are **no administrator, faculty, teacher, or student login roles**.

---

## 🎨 Visual Identity & Theme

The user interface takes visual inspiration from the latest **WhatsApp Android interface**, tailored for a clean, professional college academic environment.

- **Primary Color:** Azure Blue (`#0878D1`)
- **Deep Blue Accent:** `#005A9E`
- **Light Blue Surface:** `#EAF4FC`
- **Background:** `#F3F6FA` (Light) / `#0B111A` (Dark)
- **Absent Status Indicator:** Red (`#DC2626`)
- **Success / Present Indicator:** Emerald Green (`#059669`)
- **Navigation:** Bottom navigation bar on mobile; expandable sidebar on desktop.
- **Theme Support:** Native Light and Dark modes.

---

## 🚀 Key Modules & Capabilities

### 1. Username & Password Authentication
- **Controlled Account Provisioning**: Self-registration is disabled. Only appointed representatives provisioned by the department can log in.
- **Username Lookup**: Unique representative username (e.g., `aarav.rep`, `priya.rep`, `gopinath.rep`) internally resolved to their authorized Supabase Auth account.
- **Credential Security**: Passwords are **never** stored in plain-text in PostgreSQL and **never** stored in browser storage.
- **Show/Hide Password**: Quick visibility toggle for mobile ease.
- **Remember Me**: Safely remembers the username across sessions without saving credentials.
- **Password Recovery**: Secure password reset process dispatched to the representative's registered recovery email.

### 2. Representative Dashboard
- **Total Students Counter**: Live active class roster count.
- **Today's Attendance Summary**: Track marked vs. total periods for today.
- **Present & Absent Counts**: Prominent, high-contrast indicators.
- **Attendance Percentage**: Today's recorded attendance rate or semester average.
- **Today's Selected Day Order**: Display and 1-tap switcher for Day Orders (A, B, C, D, E, F).
- **Today's Class Timetable**: Dynamically displays scheduled periods and subjects, with quick "Mark Now" or "Edit" buttons.
- **Upcoming Reminders**: Real-time deadlines with category badges and calendar sync status.
- **Recent Attendance Activity**: Shows the latest submissions within the 7-day retention period.
- **Quick Action Bar**: 1-tap shortcuts to Mark Attendance, View Students, View Timetable, and Add Reminders.

### 3. Student Details Module
- **Contact List Layout**: WhatsApp-style student rows with profile avatars/initials.
- **Add & Edit Students**: Real-time form with validation and duplicate register number prevention per class.
- **Excel & CSV Import**: Bulk upload rosters via SheetJS (`.xlsx` and `.csv`).
- **Customizable Columns**: Dynamic custom fields (e.g. Lab Batch, Elective Track, Residence).
- **Search & Sort**: Instant search by name or register number; sort by name or attendance percentage.
- **Export to Excel**: One-click download of the active roster.

### 4. Semester Timetable Setup
- **Semester Configuration**: Name, academic year, and date ranges.
- **Customizable Day Orders**: Create and manage day orders (e.g. A, B, C, D, E, F).
- **Period & Subject Management**: Configure periods per day, subject codes, faculty names, and session types (Lecture / Lab / Tutorial).
- **Reusable Timetable Grid**: Configure once and reuse throughout the entire semester without re-entering daily schedules.
- **Dynamic Daily Day Order**: Representative selects the day order for each attendance date; subjects automatically load.

### 5. Attendance Management Register
- **Streamlined Attendance Workflow**:
  1. Select Date (defaults to today in IST).
  2. Select Day Order (auto-retrieves configured schedule).
  3. Select Period (auto-loads subject and timing).
  4. All students are set to **PRESENT** by default.
  5. Tap any student to toggle them to **ABSENT**.
  6. Confirm and Save.
- **Duplicate Prevention**: Database constraints prevent duplicate records for the same class, date, and period.
- **Editing Mode**: Easily reopen and update previously submitted attendance sessions.

### 6. Attendance History & 7-Day Automatic Retention
- **Date-Wise & Period-Wise Filter**: Inspect attendance logs across the last 7 days.
- **Absentee Breakdown**: View exact names and register numbers of absent students.
- **Automated Permanent Deletion (Server-Side Scheduled Job)**:
  - Attendance records older than **seven days** in the `Asia/Kolkata` timezone are permanently deleted via Supabase `pg_cron`.
  - Runs once daily at **00:05 IST** (`18:35 UTC`).
  - Cascades to attendance entries while leaving students, classes, timetables, and representative accounts intact.

### 7. Reminders & Google Calendar Integration
- **Strict Categories**:
  - `Assignments`
  - `Examinations`
  - `Submissions`
  - `College Events`
- **Upcoming vs. Completed Tabs**: Filter active deadlines and mark items complete.
- **Google Calendar Sync**:
  - One-click **"Google Cal"** button generates pre-filled calendar templates.
  - Saves `google_calendar_event_id` to prevent duplicate events.
  - Operates offline and gracefully falls back if API credentials are not set.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + TypeScript 5.7 |
| **Build Tool** | Vite 7 |
| **Styling & Theme** | Tailwind CSS v4 + Lucide React Icons |
| **Database & Auth** | Supabase (PostgreSQL 15+, Auth, Row Level Security) |
| **Scheduled Jobs** | Supabase `pg_cron` (Asia/Kolkata timezone) |
| **File Processing** | SheetJS (`xlsx`) for Excel/CSV parsing and export |
| **Routing** | React Router DOM v7 |

---

## 📂 Project Structure

```
repz/
├── public/
│   └── _redirects             # SPA rewrite for Netlify / Cloudflare Pages
├── src/
│   ├── components/
│   │   ├── layout/            # AppShell, TopAppBar, BottomNav, DesktopSidebar
│   │   └── ui/                # Button, Card, Badge, Modal, StatTile, Toast, Avatar
│   ├── context/
│   │   ├── AuthContext.tsx    # Session management, representative auth & co-rep pairing
│   │   └── ThemeContext.tsx   # Light/Dark mode state
│   ├── data/
│   │   └── mockData.ts        # Baseline mock roster, class profile, and schedule
│   ├── lib/
│   │   └── supabase.ts        # Supabase client initialization
│   ├── pages/
│   │   ├── AttendanceHistoryPage.tsx  # 7-day attendance audit & absentee logs
│   │   ├── AttendancePage.tsx         # Attendance register
│   │   ├── DashboardPage.tsx          # Main Representative Dashboard
│   │   ├── LoginPage.tsx              # Username & password authentication
│   │   ├── RemindersPage.tsx          # 4-category reminders & Google Calendar sync
│   │   ├── SettingsPage.tsx           # Class profile, theme, and sign out
│   │   ├── StudentDetailsPage.tsx     # Student roster, Excel import/export
│   │   └── TimetableSetupPage.tsx     # Semester, Day Order, and period configuration
│   ├── services/
│   │   ├── attendanceService.ts       # Attendance CRUD & 7-day retention filters
│   │   ├── authService.ts             # Username login, password reset, and class data
│   │   ├── googleCalendarService.ts   # Google Calendar web intent generator
│   │   ├── remindersService.ts        # Reminders CRUD
│   │   ├── studentService.ts          # Student management & custom columns
│   │   └── timetableService.ts        # Semesters, day orders, and daily logs
│   ├── types/
│   │   └── index.ts                   # Core domain interfaces and types
│   ├── utils/
│   │   └── retentionUtils.ts          # Asia/Kolkata timezone date utilities
│   ├── App.tsx                        # Protected routes & app shell
│   └── main.tsx                       # React root entry
├── supabase/
│   └── migrations/                    # SQL migrations (000000 to 000006)
├── .env.example                       # Documented environment variables
├── DEPLOYMENT.md                      # Comprehensive production deployment guide
├── vercel.json                        # SPA rewrite for Vercel
└── vite.config.ts                     # Optimized manual chunking config
```

---

## ⚡ Getting Started Locally

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd repz
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

*(If you run the app without Supabase keys, it automatically runs in **Local Preview Mode** with pre-configured mock data).*

### 3. Start the Development Server

```bash
npm run dev
```

Open your browser at **[http://localhost:5173/](http://localhost:5173/)**.

---

## 🗄️ Supabase Database Setup

Run the migrations located in `supabase/migrations/` in sequence via the **Supabase SQL Editor**:

1. `20261125000000_repz_auth_schema.sql` — Classes, representatives, RLS functions.
2. `20261125000001_students_schema.sql` — Students roster and custom columns.
3. `20261125000002_timetable_schema.sql` — Semesters, day orders, timetable periods.
4. `20261125000003_attendance_schema.sql` — Attendance sessions and entries.
5. `20261125000004_retention_cleanup_schema.sql` — `pg_cron` 7-day automatic deletion.
6. `20261125000005_reminders_schema.sql` — Class reminders and Google Calendar event tracking.
7. `20261125000006_username_auth_schema.sql` — Username authentication and provisioning.

### Provisioning a Representative Account

Run this SQL query in Supabase to link a representative username to a class:

```sql
select public.provision_class_representative(
  'a0000000-0000-0000-0000-000000000001',   -- Class ID (CSE-3A)
  'Primary Rep',                             -- 'Primary Rep' or 'Co-Rep'
  'gopinath.rep',                            -- Representative Username
  'imgopinathr@gmail.com',                   -- Representative Email
  'Gopinath R',                              -- Full Name
  '24CS001',                                 -- Roll Number
  '+91 98765 43210'                          -- Phone
);
```

Then in **Supabase Dashboard -> Authentication -> Users**, add the user with that email and choose your password.

---

## 🔐 Credentials for Testing

In local preview mode or using the demo seed:

| Role | Username | Password |
|---|---|---|
| **Primary Rep** | `aarav.rep` | `password123` |
| **Co-Representative** | `priya.rep` | `password123` |

*(You can also click the quick **"Sign In →"** demo button on the login screen).*

---

## 🚢 Production Build & Deployment

Build the optimized production bundle:

```bash
npm run build
```

- **Vercel**: Deploy directly (`vercel --prod`). `vercel.json` ensures client-side routing rewrites.
- **Netlify**: Deploy using `netlify deploy --prod --dir=dist`. `public/_redirects` ensures routing rewrites.

For full database security verification queries and `pg_cron` setup details, refer to [DEPLOYMENT.md](file:///d:/jostel_app/repz/DEPLOYMENT.md).

---

## 📄 License
This project is proprietary software built for college class representative administration.

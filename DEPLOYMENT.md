# Repz — Production Deployment & Database Setup Guide

Repz is an attendance management web application exclusively built for Class Representatives (paired in slots: Primary Rep & Co-Rep) to manage their assigned class without any administrator, faculty, teacher, or student login roles.

---

## 1. Architecture & Security Specifications

- **Role-Free Single Authority**: Authorization is governed by verified Google OAuth email matching `public.representatives(email)` linked via `public.class_representatives` to `public.classes`.
- **Dual Representative Access**: Exactly two authorized representatives are linked per class. Both access identical, synchronized class data.
- **Strict Row Level Security (RLS)**: Enforced via `public.current_assigned_class_id()`. Representatives cannot read, write, update, or delete data belonging to any other class.
- **Automated 7-Day Permanent Retention**: Attendance records older than seven days in the `Asia/Kolkata` timezone are automatically deleted via `pg_cron` without deleting students, classes, semesters, subjects, timetable configurations, or representative accounts.
- **Client-Side Secret Isolation**: No Google Client Secrets or Supabase Service Role keys are shipped to the client bundle. Google Calendar synchronization operates with Google Calendar Web/Mobile Intents or client-scoped OAuth tokens.

---

## 2. Supabase Database Setup

### Step 2.1: Execute Migrations in Order
Run the SQL migration files located in `supabase/migrations/` in sequence via the Supabase SQL Editor or Supabase CLI (`supabase db push`):

1. **`20261125000000_repz_auth_schema.sql`**
   - Creates `classes`, `representatives`, `class_representatives`.
   - Creates `representative_slot` enum (`Primary Rep`, `Co-Rep`).
   - Configures RLS helper functions `current_representative_id()` and `current_assigned_class_id()`.
   - Attaches `handle_representative_login()` trigger on `auth.users`.

2. **`20261125000001_students_schema.sql`**
   - Creates `students` and `class_custom_columns` tables.
   - Enforces unique register numbers per class (`unique (class_id, register_number)`).
   - Auto-updates `total_students` on `classes` via trigger.

3. **`20261125000002_timetable_schema.sql`**
   - Creates `semesters`, `day_orders`, `subjects`, `timetable_periods`, and `daily_day_order_logs`.
   - Enforces unique period number per day order (`unique (day_order_id, period_number)`).
   - Binds daily day order selection to `class_id` and `date`.

4. **`20261125000003_attendance_schema.sql`**
   - Creates `attendance_sessions` and `attendance_entries`.
   - Enforces duplicate prevention constraint: `unique (class_id, date, period_number)`.
   - Cascades foreign keys to entries.

5. **`20261125000004_retention_cleanup_schema.sql`**
   - Enables `pg_cron` extension.
   - Creates `cleanup_expired_attendance_records()` calculating the retention cutoff in `Asia/Kolkata` timezone (`((timezone('Asia/Kolkata', now()))::date - interval '7 days')::date`).
   - Schedules cron job `daily_attendance_7day_retention_cleanup` to run daily at 00:05 IST (`35 18 * * *` UTC).

6. **`20261125000005_reminders_schema.sql`**
   - Creates `reminders` table with category check constraint: `Assignments`, `Examinations`, `Submissions`, `College Events`.
   - Stores `google_calendar_event_id` and `google_calendar_synced_at` to prevent duplicate calendar scheduling.

---

### Step 2.2: Configure Google OAuth in Supabase

1. Open your **Google Cloud Console** -> **APIs & Services** -> **Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Set **Authorized redirect URIs** to:
   ```
   https://<your-supabase-project-id>.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** and **Client Secret**.
5. In your **Supabase Dashboard**:
   - Navigate to **Authentication** -> **Providers** -> **Google**.
   - Enable Google provider.
   - Paste Client ID and Client Secret.
   - Ensure "Skip nonce check" is unchecked and save.

---

### Step 2.3: Seed Initial Representatives & Class

Run this SQL snippet in Supabase SQL Editor to authorize your two class representatives:

```sql
-- 1. Create the class
insert into public.classes (id, class_code, department, semester, section, academic_year, class_join_code)
values (
  'a0000000-0000-0000-0000-000000000001',
  'CSE-3A',
  'Computer Science & Engineering',
  'Semester 5',
  'Section A',
  '2026-2027',
  'REPZ-CSE3A-2026'
) on conflict (class_code) do nothing;

-- 2. Insert Authorized Representatives (Replace with real Google emails)
insert into public.representatives (id, email, full_name, roll_number)
values
  ('b0000000-0000-0000-0000-000000000001', 'rep1.college@gmail.com', 'Aarav Menon', '24CS012'),
  ('b0000000-0000-0000-0000-000000000002', 'rep2.college@gmail.com', 'Priya Nair', '24CS045')
on conflict (email) do nothing;

-- 3. Pair Representatives to Class
insert into public.class_representatives (class_id, representative_id, slot)
values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Primary Rep'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Co-Rep')
on conflict do nothing;
```

---

## 3. Web Application Deployment

### Environment Variables
Configure the following in your hosting provider (Vercel, Netlify, Cloudflare Pages):

| Variable Name | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | **Yes** | Your Supabase project URL (`https://<project-id>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Supabase anon public API key |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Google OAuth Client ID for direct REST sync |

### Hosting Platforms

#### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```
*SPA routing rewrite is pre-configured via `vercel.json`.*

#### Deploy to Netlify
```bash
# Build locally
npm run build

# Deploy via Netlify CLI or Git connection
netlify deploy --prod --dir=dist
```
*SPA routing rewrite is pre-configured via `public/_redirects`.*

---

## 4. Security & Retention Verification Queries

### Verify Row Level Security (RLS) is Active on All Tables
```sql
select tablename, rowsecurity 
from pg_tables 
where schemaname = 'public';
```
*(All tables should return `rowsecurity = true`)*.

### Test 7-Day Automatic Retention Cleanup Execution
```sql
-- Manually run the cleanup function to verify
select public.cleanup_expired_attendance_records();

-- Check next scheduled pg_cron execution
select jobid, jobname, schedule, command, active 
from cron.job 
where jobname = 'daily_attendance_7day_retention_cleanup';
```

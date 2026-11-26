-- ==============================================================================
-- Repz — Semester Timetable Configuration Schema
-- Supports multiple semesters, customizable day orders (A, B, C, D, E, F),
-- configurable periods, subjects, and reusable timetable configurations.
-- ==============================================================================

-- 1. SEMESTERS TABLE
create table if not exists public.semesters (
    id uuid primary key default uuid_generate_v4(),
    class_id uuid not null references public.classes(id) on delete cascade,
    name text not null,                        -- e.g. "Semester 5 (Autumn 2026)"
    academic_year text not null,               -- e.g. "2026-2027"
    start_date date not null,
    end_date date not null,
    total_periods_per_day integer not null default 5, -- e.g. 4, 5, 6, 7, 8
    is_active boolean not null default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint check_dates check (end_date >= start_date)
);

-- 2. DAY_ORDERS TABLE
-- Customizable day orders such as Day Order A, Day Order B, Day Order C, etc.
create table if not exists public.day_orders (
    id uuid primary key default uuid_generate_v4(),
    semester_id uuid not null references public.semesters(id) on delete cascade,
    code text not null,                        -- e.g. "A", "B", "C", "D", "E", "F"
    name text not null,                        -- e.g. "Day Order A"
    description text default '',               -- e.g. "Theory + Lab Schedule"
    sort_order integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_day_order_code_per_semester unique (semester_id, code)
);

-- 3. SUBJECTS TABLE
-- Master subjects configured for the semester
create table if not exists public.subjects (
    id uuid primary key default uuid_generate_v4(),
    semester_id uuid not null references public.semesters(id) on delete cascade,
    code text not null,                        -- e.g. "CS501"
    name text not null,                        -- e.g. "Operating Systems"
    color text default '#0878D1',              -- Tag color
    session_type text default 'Lecture' not null, -- 'Lecture' | 'Lab' | 'Tutorial'
    faculty_name text default '',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_subject_code_per_semester unique (semester_id, code)
);

-- 4. TIMETABLE_PERIODS (GRID SLOTS)
-- Maps a specific period under a Day Order to a Subject, time, and room
create table if not exists public.timetable_periods (
    id uuid primary key default uuid_generate_v4(),
    semester_id uuid not null references public.semesters(id) on delete cascade,
    day_order_id uuid not null references public.day_orders(id) on delete cascade,
    period_number integer not null,            -- 1, 2, 3, 4, 5, etc.
    start_time text not null,                  -- e.g. "09:00 AM"
    end_time text not null,                    -- e.g. "09:50 AM"
    subject_id uuid references public.subjects(id) on delete set null,
    room text default 'LH-302',
    notes text default '',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_period_per_day_order unique (day_order_id, period_number)
);

-- 5. DAILY_DAY_ORDER_LOGS
-- Records which Day Order was manually chosen by the representative for each attendance date
create table if not exists public.daily_day_order_logs (
    id uuid primary key default uuid_generate_v4(),
    class_id uuid not null references public.classes(id) on delete cascade,
    date date not null,
    day_order_id uuid not null references public.day_orders(id) on delete cascade,
    selected_by_rep_id uuid references public.representatives(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_date_per_class unique (class_id, date)
);

-- 6. INDEXES
create index if not exists idx_semesters_class_id on public.semesters(class_id);
create index if not exists idx_day_orders_semester on public.day_orders(semester_id);
create index if not exists idx_subjects_semester on public.subjects(semester_id);
create index if not exists idx_timetable_periods_sem on public.timetable_periods(semester_id);
create index if not exists idx_timetable_periods_do on public.timetable_periods(day_order_id);
create index if not exists idx_daily_day_logs_class_date on public.daily_day_order_logs(class_id, date);

-- 7. ROW LEVEL SECURITY (RLS)
alter table public.semesters enable row level security;
alter table public.day_orders enable row level security;
alter table public.subjects enable row level security;
alter table public.timetable_periods enable row level security;
alter table public.daily_day_order_logs enable row level security;

-- Policies for SEMESTERS
create policy "Representatives can view semesters in assigned class"
on public.semesters for select
using (class_id = public.current_assigned_class_id());

create policy "Representatives can insert semesters in assigned class"
on public.semesters for insert
with check (class_id = public.current_assigned_class_id());

create policy "Representatives can update semesters in assigned class"
on public.semesters for update
using (class_id = public.current_assigned_class_id());

create policy "Representatives can delete semesters in assigned class"
on public.semesters for delete
using (class_id = public.current_assigned_class_id());

-- Policies for DAY_ORDERS
create policy "Representatives can view day orders for class semesters"
on public.day_orders for select
using (semester_id in (select id from public.semesters where class_id = public.current_assigned_class_id()));

create policy "Representatives can manage day orders for class semesters"
on public.day_orders for all
using (semester_id in (select id from public.semesters where class_id = public.current_assigned_class_id()))
with check (semester_id in (select id from public.semesters where class_id = public.current_assigned_class_id()));

-- Policies for SUBJECTS
create policy "Representatives can view subjects for class semesters"
on public.subjects for select
using (semester_id in (select id from public.semesters where class_id = public.current_assigned_class_id()));

create policy "Representatives can manage subjects for class semesters"
on public.subjects for all
using (semester_id in (select id from public.semesters where class_id = public.current_assigned_class_id()))
with check (semester_id in (select id from public.semesters where class_id = public.current_assigned_class_id()));

-- Policies for TIMETABLE_PERIODS
create policy "Representatives can view timetable periods for class semesters"
on public.timetable_periods for select
using (semester_id in (select id from public.semesters where class_id = public.current_assigned_class_id()));

create policy "Representatives can manage timetable periods for class semesters"
on public.timetable_periods for all
using (semester_id in (select id from public.semesters where class_id = public.current_assigned_class_id()))
with check (semester_id in (select id from public.semesters where class_id = public.current_assigned_class_id()));

-- Policies for DAILY_DAY_ORDER_LOGS
create policy "Representatives can view and log daily day orders"
on public.daily_day_order_logs for all
using (class_id = public.current_assigned_class_id())
with check (class_id = public.current_assigned_class_id());

-- ==============================================================================
-- Repz — Complete Attendance Sessions and Records Schema
-- Prevents duplicate records for the same class, date and period.
-- Ensures Row Level Security so both representatives access identical records.
-- ==============================================================================

-- 1. ATTENDANCE_SESSIONS TABLE
-- Represents a single marked attendance register for a specific period on a date
create table if not exists public.attendance_sessions (
    id uuid primary key default uuid_generate_v4(),
    class_id uuid not null references public.classes(id) on delete cascade,
    semester_id uuid references public.semesters(id) on delete set null,
    date date not null,
    day_order_id uuid references public.day_orders(id) on delete set null,
    day_order_code text not null default 'A',       -- e.g. "A", "B", "C"
    period_number integer not null,                 -- e.g. 1, 2, 3...
    time_range text not null,                       -- e.g. "09:00 AM - 09:50 AM"
    subject_id uuid references public.subjects(id) on delete set null,
    subject_code text not null,                     -- e.g. "CS501"
    subject_name text not null,                     -- e.g. "Operating Systems"
    room text default 'LH-302',
    total_students integer not null default 0,
    present_count integer not null default 0,
    absent_count integer not null default 0,
    marked_by_rep_id uuid references public.representatives(id) on delete set null,
    marked_by_rep_name text not null,
    marked_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    -- CRITICAL REQUIREMENT: Prevent duplicate attendance records for same class, date and period
    constraint unique_attendance_session_per_period unique (class_id, date, period_number)
);

-- 2. ATTENDANCE_ENTRIES TABLE
-- Individual student attendance status for each attendance session
create table if not exists public.attendance_entries (
    id uuid primary key default uuid_generate_v4(),
    session_id uuid not null references public.attendance_sessions(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    status text not null check (status in ('present', 'absent')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_student_entry_per_session unique (session_id, student_id)
);

-- 3. INDEXES
create index if not exists idx_att_sess_class_date on public.attendance_sessions(class_id, date);
create index if not exists idx_att_sess_period on public.attendance_sessions(class_id, date, period_number);
create index if not exists idx_att_entries_session on public.attendance_entries(session_id);
create index if not exists idx_att_entries_student on public.attendance_entries(student_id);

-- 4. ROW LEVEL SECURITY (RLS)
alter table public.attendance_sessions enable row level security;
alter table public.attendance_entries enable row level security;

-- Policies for ATTENDANCE_SESSIONS
create policy "Representatives can view attendance sessions in assigned class"
on public.attendance_sessions for select
using (class_id = public.current_assigned_class_id());

create policy "Representatives can insert attendance sessions in assigned class"
on public.attendance_sessions for insert
with check (class_id = public.current_assigned_class_id());

create policy "Representatives can update attendance sessions in assigned class"
on public.attendance_sessions for update
using (class_id = public.current_assigned_class_id());

create policy "Representatives can delete attendance sessions in assigned class"
on public.attendance_sessions for delete
using (class_id = public.current_assigned_class_id());

-- Policies for ATTENDANCE_ENTRIES
create policy "Representatives can view attendance entries for assigned class"
on public.attendance_entries for select
using (
    session_id in (
        select id from public.attendance_sessions
        where class_id = public.current_assigned_class_id()
    )
);

create policy "Representatives can manage attendance entries for assigned class"
on public.attendance_entries for all
using (
    session_id in (
        select id from public.attendance_sessions
        where class_id = public.current_assigned_class_id()
    )
)
with check (
    session_id in (
        select id from public.attendance_sessions
        where class_id = public.current_assigned_class_id()
    )
);

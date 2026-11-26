-- ==============================================================================
-- Repz — Class Reminders Schema & Google Calendar Sync Metadata
-- Supports categories: Assignments, Examinations, Submissions, College Events
-- Stored in Supabase and associated with the class. Both representatives view
-- identical shared class reminders with RLS.
-- ==============================================================================

-- 1. REMINDERS TABLE
create table if not exists public.reminders (
    id uuid primary key default uuid_generate_v4(),
    class_id uuid not null references public.classes(id) on delete cascade,
    title text not null,
    description text default '',
    due_date date not null,
    due_time text default '09:00 AM',               -- e.g. "09:00 AM", "11:30 AM", "05:00 PM"
    category text not null check (
        category in ('Assignments', 'Examinations', 'Submissions', 'College Events')
    ),
    priority text not null default 'normal' check (
        priority in ('normal', 'high')
    ),
    completed boolean not null default false,
    assigned_to_rep_id text default 'both',        -- 'both' or specific representative id
    google_calendar_event_id text,                  -- Stored Google Calendar Event ID to prevent duplicate calendar events
    google_calendar_synced_at timestamp with time zone,
    created_by_rep_id uuid references public.representatives(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. INDEXES
create index if not exists idx_reminders_class_id on public.reminders(class_id);
create index if not exists idx_reminders_due_date on public.reminders(due_date);
create index if not exists idx_reminders_category on public.reminders(category);
create index if not exists idx_reminders_gcal_id on public.reminders(google_calendar_event_id);

-- 3. ROW LEVEL SECURITY (RLS)
alter table public.reminders enable row level security;

-- Policy: Representatives can view reminders for their assigned class
create policy "Representatives can view reminders in assigned class"
on public.reminders for select
using (
    class_id = public.current_assigned_class_id()
);

-- Policy: Representatives can insert reminders for their assigned class
create policy "Representatives can insert reminders in assigned class"
on public.reminders for insert
with check (
    class_id = public.current_assigned_class_id()
);

-- Policy: Representatives can update reminders in their assigned class
create policy "Representatives can update reminders in assigned class"
on public.reminders for update
using (
    class_id = public.current_assigned_class_id()
);

-- Policy: Representatives can delete reminders in their assigned class
create policy "Representatives can delete reminders in assigned class"
on public.reminders for delete
using (
    class_id = public.current_assigned_class_id()
);

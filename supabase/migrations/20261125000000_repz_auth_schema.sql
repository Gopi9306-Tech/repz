-- ==============================================================================
-- Repz — Class Representative Attendance Management Schema
-- Supabase SQL Migration
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. ENUMS & DOMAINS
create type representative_slot as enum ('Primary Rep', 'Co-Rep');

-- 3. CLASSES TABLE
-- Supports multi-department and multi-class scaling without any admin or teacher roles
create table if not exists public.classes (
    id uuid primary key default uuid_generate_v4(),
    class_code text not null unique,               -- e.g. 'CSE-3A'
    department text not null,                      -- e.g. 'Computer Science & Engineering'
    semester text not null,                        -- e.g. 'Semester 5'
    section text not null,                         -- e.g. 'Section A'
    academic_year text not null,                   -- e.g. '2026-2027'
    class_join_code text not null unique,          -- pairing invite code
    total_students integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. REPRESENTATIVES TABLE
-- Only authorized representatives have records here.
-- Email is the primary authority matching Google OAuth claims.
create table if not exists public.representatives (
    id uuid primary key default uuid_generate_v4(),
    email text not null unique,                    -- Authorized representative email (checked on Google OAuth login)
    full_name text not null,
    roll_number text not null,
    phone text default '',
    avatar_url text,
    auth_user_id uuid references auth.users(id) on delete set null, -- Associated Supabase Auth user ID once logged in
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. CLASS_REPRESENTATIVES (JUNCTION TABLE)
-- Links representatives to their assigned class.
-- Constraint ensures maximum of 2 representatives per class and 1 class per representative slot.
create table if not exists public.class_representatives (
    id uuid primary key default uuid_generate_v4(),
    class_id uuid not null references public.classes(id) on delete cascade,
    representative_id uuid not null references public.representatives(id) on delete cascade,
    slot representative_slot not null,
    assigned_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(class_id, representative_id),
    unique(class_id, slot) -- Max 1 Primary Rep and 1 Co-Rep per class
);

-- 6. INDEXES FOR PERFORMANCE
create index if not exists idx_rep_email on public.representatives(lower(email));
create index if not exists idx_rep_auth_user_id on public.representatives(auth_user_id);
create index if not exists idx_class_rep_class_id on public.class_representatives(class_id);
create index if not exists idx_class_rep_rep_id on public.class_representatives(representative_id);

-- 7. ROW LEVEL SECURITY (RLS)
alter table public.classes enable row level security;
alter table public.representatives enable row level security;
alter table public.class_representatives enable row level security;

-- Helper security definer function to get the representative ID of current authenticated user
create or replace function public.current_representative_id()
returns uuid
language sql
security definer
stable
as $$
  select id from public.representatives
  where auth_user_id = auth.uid()
     or lower(email) = lower(auth.jwt()->>'email')
  limit 1;
$$;

-- Helper security definer function to get the assigned class ID of current authenticated user
create or replace function public.current_assigned_class_id()
returns uuid
language sql
security definer
stable
as $$
  select cr.class_id
  from public.class_representatives cr
  inner join public.representatives r on r.id = cr.representative_id
  where r.auth_user_id = auth.uid()
     or lower(r.email) = lower(auth.jwt()->>'email')
  limit 1;
$$;

-- RLS: CLASSES
-- A representative can only read their assigned class
create policy "Representatives can view their assigned class"
on public.classes
for select
using (
    id = public.current_assigned_class_id()
);

-- Representatives can update metadata of their assigned class
create policy "Representatives can update their assigned class"
on public.classes
for update
using (
    id = public.current_assigned_class_id()
);

-- RLS: REPRESENTATIVES
-- Representatives can only view themselves and their assigned Co-Representative in the same class
create policy "Representatives can view reps in their assigned class"
on public.representatives
for select
using (
    id in (
        select cr.representative_id
        from public.class_representatives cr
        where cr.class_id = public.current_assigned_class_id()
    )
    or lower(email) = lower(auth.jwt()->>'email')
);

-- A representative can update their own profile info
create policy "Representatives can update their own profile"
on public.representatives
for update
using (
    id = public.current_representative_id()
);

-- RLS: CLASS_REPRESENTATIVES
-- Representatives can view mapping for their assigned class
create policy "Representatives can view class representatives in their class"
on public.class_representatives
for select
using (
    class_id = public.current_assigned_class_id()
);

-- 8. AUTH TRIGGER: Automatically link auth.users to public.representatives on login
create or replace function public.handle_representative_login()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Check if user email is an authorized representative
  update public.representatives
  set auth_user_id = new.id,
      avatar_url = coalesce(new.raw_user_meta_data->>'avatar_url', avatar_url),
      full_name = coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), full_name)
  where lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_representative_login();

-- 9. SEED DATA (Example: 1 Class with 2 Authorized Representatives)
-- Rep 1: Primary Rep
-- Rep 2: Co-Rep
insert into public.classes (id, class_code, department, semester, section, academic_year, class_join_code, total_students)
values (
    'a0000000-0000-0000-0000-000000000001',
    'CSE-3A',
    'Computer Science & Engineering',
    'Semester 5',
    'Section A',
    '2026-2027',
    'REPZ-CSE3A-26',
    16
) on conflict (class_code) do nothing;

insert into public.representatives (id, email, full_name, roll_number, phone)
values 
(
    'b0000000-0000-0000-0000-000000000001',
    'aarav.menon@college.edu',
    'Aarav Menon',
    '24CS001',
    '+91 98450 11204'
),
(
    'b0000000-0000-0000-0000-000000000002',
    'priya.nair@college.edu',
    'Priya Nair',
    '24CS034',
    '+91 98450 44891'
) on conflict (email) do nothing;

insert into public.class_representatives (class_id, representative_id, slot)
values 
(
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Primary Rep'
),
(
    'a0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'Co-Rep'
) on conflict do nothing;

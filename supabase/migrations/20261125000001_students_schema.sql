-- ==============================================================================
-- Repz — Students Table & Customizable Columns Migration
-- ==============================================================================

-- 1. STUDENTS TABLE
create table if not exists public.students (
    id uuid primary key default uuid_generate_v4(),
    class_id uuid not null references public.classes(id) on delete cascade,
    register_number text not null,               -- Mandatory register number (unique within class)
    name text not null,                          -- Student full name
    roll_number text default '',                 -- Optional roll number
    email text default '',                       -- Student email
    phone text default '',                       -- Student contact phone
    extra_data jsonb default '{}'::jsonb not null, -- Stores customizable additional column values dynamically
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_reg_no_per_class unique (class_id, register_number)
);

-- 2. CLASS_CUSTOM_COLUMNS TABLE
-- Stores definitions for custom columns added by class representatives
create table if not exists public.class_custom_columns (
    id uuid primary key default uuid_generate_v4(),
    class_id uuid not null references public.classes(id) on delete cascade,
    name text not null,                          -- e.g. 'Lab Batch', 'Hostel Block', 'Elective'
    key text not null,                           -- slug / key e.g. 'lab_batch'
    data_type text default 'text' not null,      -- 'text', 'number', 'select', 'boolean'
    options jsonb default '[]'::jsonb,           -- optional predefined options for dropdowns
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_col_key_per_class unique (class_id, key)
);

-- 3. INDEXES
create index if not exists idx_students_class_id on public.students(class_id);
create index if not exists idx_students_reg_no on public.students(lower(register_number));
create index if not exists idx_students_name on public.students(lower(name));
create index if not exists idx_custom_cols_class_id on public.class_custom_columns(class_id);

-- 4. ROW LEVEL SECURITY (RLS)
alter table public.students enable row level security;
alter table public.class_custom_columns enable row level security;

-- Policy: Representatives can view students in their assigned class
create policy "Representatives can view students in assigned class"
on public.students
for select
using (
    class_id = public.current_assigned_class_id()
);

-- Policy: Representatives can insert students in their assigned class
create policy "Representatives can insert students in assigned class"
on public.students
for insert
with check (
    class_id = public.current_assigned_class_id()
);

-- Policy: Representatives can update students in their assigned class
create policy "Representatives can update students in assigned class"
on public.students
for update
using (
    class_id = public.current_assigned_class_id()
);

-- Policy: Representatives can delete students in their assigned class
create policy "Representatives can delete students in assigned class"
on public.students
for delete
using (
    class_id = public.current_assigned_class_id()
);

-- RLS for class_custom_columns
create policy "Representatives can view custom columns in assigned class"
on public.class_custom_columns
for select
using (
    class_id = public.current_assigned_class_id()
);

create policy "Representatives can manage custom columns in assigned class"
on public.class_custom_columns
for all
using (
    class_id = public.current_assigned_class_id()
)
with check (
    class_id = public.current_assigned_class_id()
);

-- 5. FUNCTION & TRIGGER to keep total_students count updated
create or replace function public.update_class_student_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.classes
    set total_students = (select count(*) from public.students where class_id = NEW.class_id)
    where id = NEW.class_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update public.classes
    set total_students = (select count(*) from public.students where class_id = OLD.class_id)
    where id = OLD.class_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists on_student_change_count on public.students;
create trigger on_student_change_count
  after insert or delete on public.students
  for each row execute function public.update_class_student_count();

-- 6. SEED INITIAL CUSTOM COLUMNS & ROSTER FOR DEMO CLASS (CSE-3A)
insert into public.class_custom_columns (class_id, name, key, data_type)
values 
  ('a0000000-0000-0000-0000-000000000001', 'Lab Batch', 'lab_batch', 'text'),
  ('a0000000-0000-0000-0000-000000000001', 'Elective Track', 'elective_track', 'text'),
  ('a0000000-0000-0000-0000-000000000001', 'Hostel / Day Scholar', 'residence', 'text')
on conflict do nothing;

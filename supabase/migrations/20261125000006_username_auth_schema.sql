-- ==============================================================================
-- Repz — Username & Password Authentication Schema Migration
-- Replaces Google OAuth with controlled Username + Password authentication.
-- Passwords are never stored in plain text (managed securely via Supabase Auth auth.users).
-- Representatives have unique usernames resolved to their recovery email.
-- ==============================================================================

-- 1. ADD USERNAME COLUMN TO REPRESENTATIVES
alter table public.representatives 
add column if not exists username text;

-- Backfill existing representative usernames
update public.representatives 
set username = 'aarav.rep' 
where (id = 'b0000000-0000-0000-0000-000000000001' or email = 'aarav.menon@college.edu') 
  and username is null;

update public.representatives 
set username = 'priya.rep' 
where (id = 'b0000000-0000-0000-0000-000000000002' or email = 'priya.nair@college.edu') 
  and username is null;

-- Fallback for any other representative
update public.representatives 
set username = lower(split_part(email, '@', 1)) 
where username is null;

-- Enforce NOT NULL and unique constraint on username
alter table public.representatives 
alter column username set not null;

create unique index if not exists idx_rep_username 
on public.representatives (lower(username));

-- 2. SECURE USERNAME LOOKUP FUNCTION (Called by client before Supabase password login)
create or replace function public.get_representative_email_by_username(p_username text)
returns text
language sql
security definer
stable
as $$
  select email from public.representatives
  where lower(username) = lower(trim(p_username))
  limit 1;
$$;

grant execute on function public.get_representative_email_by_username(text) to anon, authenticated, service_role;

-- 3. RECOVERY EMAIL LOOKUP FOR FORGOT PASSWORD
create or replace function public.get_representative_recovery_info(p_username text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_email text;
  v_masked text;
  v_parts text[];
  v_name text;
  v_domain text;
begin
  select email into v_email from public.representatives
  where lower(username) = lower(trim(p_username))
     or lower(email) = lower(trim(p_username))
  limit 1;

  if v_email is null then
    return jsonb_build_object('found', false);
  end if;

  v_parts := string_to_array(v_email, '@');
  v_name := v_parts[1];
  v_domain := v_parts[2];
  if length(v_name) > 2 then
    v_masked := substr(v_name, 1, 2) || '***@' || v_domain;
  else
    v_masked := substr(v_name, 1, 1) || '***@' || v_domain;
  end if;

  return jsonb_build_object(
    'found', true,
    'email', v_email,
    'maskedEmail', v_masked
  );
end;
$$;

grant execute on function public.get_representative_recovery_info(text) to anon, authenticated, service_role;

-- 4. CONTROLLED ACCOUNT PROVISIONING FUNCTION
-- Admin/college staff can call this to provision a representative for a class
create or replace function public.provision_class_representative(
  p_class_id uuid,
  p_slot representative_slot,
  p_username text,
  p_email text,
  p_full_name text,
  p_roll_number text,
  p_phone text default ''
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_rep_id uuid;
begin
  -- Validate username uniqueness across other reps
  if exists (
    select 1 from public.representatives 
    where lower(username) = lower(trim(p_username)) 
      and lower(email) != lower(trim(p_email))
  ) then
    raise exception 'Username "%" is already taken by another representative.', p_username;
  end if;

  insert into public.representatives (email, username, full_name, roll_number, phone)
  values (lower(trim(p_email)), lower(trim(p_username)), trim(p_full_name), trim(p_roll_number), trim(p_phone))
  on conflict (email) do update
  set username = excluded.username,
      full_name = excluded.full_name,
      roll_number = excluded.roll_number,
      phone = excluded.phone
  returning id into v_rep_id;

  -- Clear any prior slot or rep mapping for this class to satisfy both unique constraints
  delete from public.class_representatives 
  where class_id = p_class_id and (representative_id = v_rep_id or slot = p_slot);

  -- Link to class slot (ensures exactly 1 Primary Rep and 1 Co-Rep per class)
  insert into public.class_representatives (class_id, representative_id, slot)
  values (p_class_id, v_rep_id, p_slot);

  return v_rep_id;
end;
$$;

-- 5. SEED / UPDATE DEFAULT CLASS REPRESENTATIVE CREDENTIALS
update public.representatives
set username = 'aarav.rep'
where id = 'b0000000-0000-0000-0000-000000000001';

update public.representatives
set username = 'priya.rep'
where id = 'b0000000-0000-0000-0000-000000000002';

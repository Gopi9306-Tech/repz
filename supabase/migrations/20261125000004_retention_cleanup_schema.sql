-- ==============================================================================
-- Repz — 7-Day Automatic Attendance Retention & Scheduled Deletion
-- Automatically and permanently deletes attendance records older than seven days
-- using Supabase scheduled database jobs (pg_cron) calculated in Asia/Kolkata timezone.
--
-- Referential Integrity:
-- 1. Deleting from public.attendance_sessions cascades to public.attendance_entries.
-- 2. Leaves students, semesters, subjects, classes, timetable_periods, and
--    representatives completely intact.
-- ==============================================================================

-- 1. ENABLE EXTENSIONS
create extension if not exists "pg_cron";

-- 2. CLEANUP FUNCTION WITH ASIA/KOLKATA TIMEZONE CALCULATION
create or replace function public.cleanup_expired_attendance_records()
returns integer
language plpgsql
security definer
as $$
declare
    deleted_count integer := 0;
    cutoff_date date;
begin
    -- REQUIREMENT: Use Asia/Kolkata timezone when calculating the retention cutoff.
    -- Records older than seven days (i.e. date < current_date_in_ist - 7 days) are permanently deleted.
    cutoff_date := ((timezone('Asia/Kolkata', now()))::date - interval '7 days')::date;

    -- Delete attendance sessions older than cutoff_date.
    -- Foreign key cascade automatically removes associated public.attendance_entries.
    with deleted_rows as (
        delete from public.attendance_sessions
        where date < cutoff_date
        returning id
    )
    select count(*) into deleted_count from deleted_rows;

    -- Log notice in Postgres logs
    raise notice 'Attendance cleanup completed at % (Asia/Kolkata). Cutoff date: %. Deleted % sessions.',
        timezone('Asia/Kolkata', now()), cutoff_date, deleted_count;

    return deleted_count;
end;
$$;

-- Grant execution permission to service_role / postgres
grant execute on function public.cleanup_expired_attendance_records() to postgres, service_role;

-- 3. REGISTER PG_CRON SCHEDULED JOB (RUNS DAILY AT 00:05 IST / 18:35 UTC)
-- De-duplicate any existing cron job with the same name first
do $$
begin
    if exists (select 1 from cron.job where jobname = 'daily_attendance_7day_retention_cleanup') then
        perform cron.unschedule('daily_attendance_7day_retention_cleanup');
    end if;
end $$;

-- Schedule: Runs once daily at 00:05 AM Asia/Kolkata time (which is 18:35 UTC previous day)
-- Cron expression in UTC: 35 18 * * * (18:35 UTC = 00:05 IST)
select cron.schedule(
    'daily_attendance_7day_retention_cleanup',
    '35 18 * * *',
    $$select public.cleanup_expired_attendance_records()$$
);

-- 4. HELPER FUNCTION TO RETRIEVE CUTOFF DATE IN ASIA/KOLKATA TIMEZONE
create or replace function public.get_attendance_retention_cutoff_ist()
returns date
language sql
stable
security definer
as $$
    select ((timezone('Asia/Kolkata', now()))::date - interval '7 days')::date;
$$;

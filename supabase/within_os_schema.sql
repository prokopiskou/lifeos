-- ============================================================
-- WITHIN OS — Phase 1 data model + RLS
-- Τρέξε το ΟΛΟ στο Supabase SQL Editor (μία φορά).
-- Idempotent: μπορεί να ξανατρέξει χωρίς να σπάσει.
-- ============================================================

-- ---------- 5.1 profiles (επέκταση υπάρχοντος) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists identity_gender text;            -- 'f'|'m'|'n'
alter table public.profiles add column if not exists identity_statement text;
alter table public.profiles add column if not exists identity_locked_until date;
alter table public.profiles add column if not exists within_path_stage text default 'awake'; -- awake|pause|remember|align|embody
alter table public.profiles add column if not exists stage_updated_at timestamptz;
alter table public.profiles add column if not exists onboarding_done boolean not null default false;
alter table public.profiles add column if not exists notify_time time default '21:00';

-- ---------- 5.2 daily_checkins ----------
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  grid_x numeric not null,                 -- ενέργεια 0..1
  grid_y numeric not null,                 -- καθαρότητα 0..1
  quadrant text,                           -- aligned|restorative|reactive|depleted (derived)
  identity_answer text,                    -- yes|partial|no
  tasks_total int default 3,
  tasks_completed int default 0,
  word text,
  checkin_time timestamptz default now(),
  response_latency_sec int,
  opened_not_completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists idx_daily_checkins_user_date on public.daily_checkins(user_id, date desc);

-- ---------- 5.3 user_state_daily (γράφεται από cron) ----------
create table if not exists public.user_state_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  ar_7d numeric,
  trajectory text,                         -- rising|flat|falling
  volatility numeric,
  engagement_integrity numeric,            -- 0..1
  body_gap numeric,
  state text,                              -- 1 από τις 7
  signals jsonb default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists idx_user_state_user_date on public.user_state_daily(user_id, date desc);

-- ---------- 5.4 task_calibration (cron -> πρωί) ----------
create table if not exists public.task_calibration (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  task_size text not null,                 -- full|half|minimal|none
  tone_profile text not null,
  primary key (user_id, date)
);

-- ---------- 5.5 evidence_tasks ----------
create table if not exists public.evidence_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  task_text text not null,
  position int not null,                   -- 1..3
  completed boolean not null default false
);
create index if not exists idx_evidence_user_date on public.evidence_tasks(user_id, date desc);

-- ---------- 5.6 pattern_mirrors ----------
create table if not exists public.pattern_mirrors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  rule_triggered int,                      -- 1..15
  mirror_text text,
  delivered_at timestamptz,
  is_manual boolean not null default false
);
create index if not exists idx_mirrors_user_week on public.pattern_mirrors(user_id, week_start desc);

-- ---------- 5.7 path_letters (admin-triggered) ----------
create table if not exists public.path_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_stage text,
  to_stage text,
  letter_text text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists idx_letters_user on public.path_letters(user_id, created_at desc);

-- ---------- 5.8 health_daily (Apple Health, nullable) ----------
create table if not exists public.health_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep_minutes int,
  resting_hr int,
  primary key (user_id, date)
);

-- ============================================================
-- ROW LEVEL SECURITY — κάθε χρήστης βλέπει ΜΟΝΟ τα δικά του.
-- Το service role (cron/admin) παρακάμπτει αυτόματα το RLS.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','daily_checkins','user_state_daily','task_calibration',
    'evidence_tasks','pattern_mirrors','path_letters','health_daily'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);

    -- profiles χρησιμοποιεί στήλη id, οι υπόλοιποι user_id
    if t = 'profiles' then
      execute format($f$
        drop policy if exists "%1$s_select_own" on public.%1$I;
        create policy "%1$s_select_own" on public.%1$I for select using (auth.uid() = id);
        drop policy if exists "%1$s_modify_own" on public.%1$I;
        create policy "%1$s_modify_own" on public.%1$I for all using (auth.uid() = id) with check (auth.uid() = id);
      $f$, t);
    else
      execute format($f$
        drop policy if exists "%1$s_select_own" on public.%1$I;
        create policy "%1$s_select_own" on public.%1$I for select using (auth.uid() = user_id);
        drop policy if exists "%1$s_modify_own" on public.%1$I;
        create policy "%1$s_modify_own" on public.%1$I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
      $f$, t);
    end if;
  end loop;
end $$;

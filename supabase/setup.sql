-- Life Dashboard Lite
-- Fresh Supabase project setup.
-- Run this file first, then run seed.sql.

create extension if not exists pgcrypto;

create table if not exists public.life_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_type text not null default 'other'
    check (meal_type in ('breakfast','lunch','dinner','snack','supplement','other')),
  name text not null,
  quantity_text text,
  kcal numeric(8,2) check (kcal is null or kcal >= 0),
  protein_g numeric(8,2) check (protein_g is null or protein_g >= 0),
  fat_g numeric(8,2) check (fat_g is null or fat_g >= 0),
  carbs_g numeric(8,2) check (carbs_g is null or carbs_g >= 0),
  is_estimated boolean not null default true,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_meals_user_eaten_at_idx
  on public.life_meals (user_id, eaten_at desc);

create table if not exists public.life_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  session_type text not null default 'strength'
    check (session_type in ('strength','mixed','other')),
  rpe numeric(3,1) check (rpe is null or (rpe >= 0 and rpe <= 10)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_workout_sessions_user_started_idx
  on public.life_workout_sessions (user_id, started_at desc);

create table if not exists public.life_strength_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.life_workout_sessions(id) on delete cascade,
  exercise text not null,
  set_number smallint not null check (set_number > 0),
  weight_kg numeric(8,2) check (weight_kg is null or weight_kg >= 0),
  reps integer check (reps is null or reps >= 0),
  rir numeric(3,1) check (rir is null or (rir >= 0 and rir <= 10)),
  set_type text not null default 'normal'
    check (set_type in ('warmup','normal','drop','backoff','failure','other')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists life_strength_sets_session_idx
  on public.life_strength_sets (session_id, set_number);

create table if not exists public.life_cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  activity_type text not null default 'run',
  distance_km numeric(8,3) check (distance_km is null or distance_km >= 0),
  duration_sec integer check (duration_sec is null or duration_sec >= 0),
  avg_hr integer check (avg_hr is null or avg_hr > 0),
  max_hr integer check (max_hr is null or max_hr > 0),
  rpe numeric(3,1) check (rpe is null or (rpe >= 0 and rpe <= 10)),
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_cardio_sessions_user_started_idx
  on public.life_cardio_sessions (user_id, started_at desc);

create table if not exists public.life_targets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calories_kcal numeric(8,2) check (calories_kcal is null or calories_kcal >= 0),
  protein_g numeric(8,2) check (protein_g is null or protein_g >= 0),
  fat_g numeric(8,2) check (fat_g is null or fat_g >= 0),
  carbs_g numeric(8,2) check (carbs_g is null or carbs_g >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_food_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  serving_text text,
  kcal numeric(8,2) check (kcal is null or kcal >= 0),
  protein_g numeric(8,2) check (protein_g is null or protein_g >= 0),
  fat_g numeric(8,2) check (fat_g is null or fat_g >= 0),
  carbs_g numeric(8,2) check (carbs_g is null or carbs_g >= 0),
  is_estimated boolean not null default true,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists life_food_catalog_user_name_idx
  on public.life_food_catalog (user_id, name);

create table if not exists public.life_nutrient_definitions (
  code text primary key,
  name_ja text not null,
  unit text not null,
  category text not null check (category in ('vitamin','mineral','other')),
  sort_order integer not null default 0
);

create table if not exists public.life_meal_nutrients (
  meal_id uuid not null references public.life_meals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nutrient_code text not null references public.life_nutrient_definitions(code),
  amount numeric not null check (amount >= 0),
  is_estimated boolean not null default true,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (meal_id, nutrient_code)
);

create index if not exists life_meal_nutrients_user_idx
  on public.life_meal_nutrients (user_id);
create index if not exists life_meal_nutrients_code_idx
  on public.life_meal_nutrients (nutrient_code);

create table if not exists public.life_food_nutrients (
  food_id uuid not null references public.life_food_catalog(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nutrient_code text not null references public.life_nutrient_definitions(code),
  amount_per_serving numeric not null check (amount_per_serving >= 0),
  is_estimated boolean not null default true,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (food_id, nutrient_code)
);

create index if not exists life_food_nutrients_user_idx
  on public.life_food_nutrients (user_id);

create table if not exists public.life_nutrient_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  nutrient_code text not null references public.life_nutrient_definitions(code),
  target_min numeric check (target_min is null or target_min >= 0),
  target_ideal numeric check (target_ideal is null or target_ideal >= 0),
  target_max numeric check (target_max is null or target_max >= 0),
  source text,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, nutrient_code),
  check (target_min is null or target_max is null or target_min <= target_max)
);

-- RLS
alter table public.life_profiles enable row level security;
alter table public.life_meals enable row level security;
alter table public.life_workout_sessions enable row level security;
alter table public.life_strength_sets enable row level security;
alter table public.life_cardio_sessions enable row level security;
alter table public.life_targets enable row level security;
alter table public.life_food_catalog enable row level security;
alter table public.life_nutrient_definitions enable row level security;
alter table public.life_meal_nutrients enable row level security;
alter table public.life_food_nutrients enable row level security;
alter table public.life_nutrient_targets enable row level security;

drop policy if exists life_profiles_own_row on public.life_profiles;
create policy life_profiles_own_row
on public.life_profiles for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists life_meals_own_rows on public.life_meals;
create policy life_meals_own_rows
on public.life_meals for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists life_workout_sessions_own_rows on public.life_workout_sessions;
create policy life_workout_sessions_own_rows
on public.life_workout_sessions for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists life_strength_sets_select_own on public.life_strength_sets;
create policy life_strength_sets_select_own
on public.life_strength_sets for select to authenticated
using (
  exists (
    select 1 from public.life_workout_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists life_strength_sets_insert_own on public.life_strength_sets;
create policy life_strength_sets_insert_own
on public.life_strength_sets for insert to authenticated
with check (
  exists (
    select 1 from public.life_workout_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists life_strength_sets_update_own on public.life_strength_sets;
create policy life_strength_sets_update_own
on public.life_strength_sets for update to authenticated
using (
  exists (
    select 1 from public.life_workout_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.life_workout_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists life_strength_sets_delete_own on public.life_strength_sets;
create policy life_strength_sets_delete_own
on public.life_strength_sets for delete to authenticated
using (
  exists (
    select 1 from public.life_workout_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists life_cardio_sessions_own_rows on public.life_cardio_sessions;
create policy life_cardio_sessions_own_rows
on public.life_cardio_sessions for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists life_targets_own_row on public.life_targets;
create policy life_targets_own_row
on public.life_targets for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists life_food_catalog_own_rows on public.life_food_catalog;
create policy life_food_catalog_own_rows
on public.life_food_catalog for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists life_nutrient_definitions_select_authenticated on public.life_nutrient_definitions;
create policy life_nutrient_definitions_select_authenticated
on public.life_nutrient_definitions for select to authenticated
using (true);

drop policy if exists life_meal_nutrients_select_own on public.life_meal_nutrients;
create policy life_meal_nutrients_select_own
on public.life_meal_nutrients for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists life_meal_nutrients_insert_own on public.life_meal_nutrients;
create policy life_meal_nutrients_insert_own
on public.life_meal_nutrients for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.life_meals m
    where m.id = meal_id and m.user_id = (select auth.uid())
  )
);

drop policy if exists life_meal_nutrients_update_own on public.life_meal_nutrients;
create policy life_meal_nutrients_update_own
on public.life_meal_nutrients for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.life_meals m
    where m.id = meal_id and m.user_id = (select auth.uid())
  )
);

drop policy if exists life_meal_nutrients_delete_own on public.life_meal_nutrients;
create policy life_meal_nutrients_delete_own
on public.life_meal_nutrients for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists life_food_nutrients_select_own on public.life_food_nutrients;
create policy life_food_nutrients_select_own
on public.life_food_nutrients for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists life_food_nutrients_insert_own on public.life_food_nutrients;
create policy life_food_nutrients_insert_own
on public.life_food_nutrients for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.life_food_catalog f
    where f.id = food_id and f.user_id = (select auth.uid())
  )
);

drop policy if exists life_food_nutrients_update_own on public.life_food_nutrients;
create policy life_food_nutrients_update_own
on public.life_food_nutrients for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.life_food_catalog f
    where f.id = food_id and f.user_id = (select auth.uid())
  )
);

drop policy if exists life_food_nutrients_delete_own on public.life_food_nutrients;
create policy life_food_nutrients_delete_own
on public.life_food_nutrients for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists life_nutrient_targets_select_own on public.life_nutrient_targets;
create policy life_nutrient_targets_select_own
on public.life_nutrient_targets for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists life_nutrient_targets_insert_own on public.life_nutrient_targets;
create policy life_nutrient_targets_insert_own
on public.life_nutrient_targets for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists life_nutrient_targets_update_own on public.life_nutrient_targets;
create policy life_nutrient_targets_update_own
on public.life_nutrient_targets for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists life_nutrient_targets_delete_own on public.life_nutrient_targets;
create policy life_nutrient_targets_delete_own
on public.life_nutrient_targets for delete to authenticated
using ((select auth.uid()) = user_id);

-- Data API privileges. anon receives no table access.
revoke all on public.life_profiles from anon, authenticated;
revoke all on public.life_meals from anon, authenticated;
revoke all on public.life_workout_sessions from anon, authenticated;
revoke all on public.life_strength_sets from anon, authenticated;
revoke all on public.life_cardio_sessions from anon, authenticated;
revoke all on public.life_targets from anon, authenticated;
revoke all on public.life_food_catalog from anon, authenticated;
revoke all on public.life_nutrient_definitions from anon, authenticated;
revoke all on public.life_meal_nutrients from anon, authenticated;
revoke all on public.life_food_nutrients from anon, authenticated;
revoke all on public.life_nutrient_targets from anon, authenticated;

grant select, insert, update, delete on public.life_profiles to authenticated;
grant select, insert, update, delete on public.life_meals to authenticated;
grant select, insert, update, delete on public.life_workout_sessions to authenticated;
grant select, insert, update, delete on public.life_strength_sets to authenticated;
grant select, insert, update, delete on public.life_cardio_sessions to authenticated;
grant select, insert, update, delete on public.life_targets to authenticated;
grant select, insert, update, delete on public.life_food_catalog to authenticated;
grant select on public.life_nutrient_definitions to authenticated;
grant select, insert, update, delete on public.life_meal_nutrients to authenticated;
grant select, insert, update, delete on public.life_food_nutrients to authenticated;
grant select, insert, update, delete on public.life_nutrient_targets to authenticated;

-- Local-day views use each user's configured timezone.
create or replace view public.life_meals_local
with (security_invoker = true)
as
select
  m.id, m.user_id, m.eaten_at, m.meal_type, m.name, m.quantity_text,
  m.kcal, m.protein_g, m.fat_g, m.carbs_g, m.is_estimated,
  m.source, m.notes, m.created_at, m.updated_at,
  (m.eaten_at at time zone coalesce(p.timezone, 'Asia/Tokyo'))::date as day
from public.life_meals m
left join public.life_profiles p on p.user_id = m.user_id;

create or replace view public.life_workout_sessions_local
with (security_invoker = true)
as
select
  s.id, s.user_id, s.started_at, s.ended_at, s.session_type, s.rpe,
  s.notes, s.created_at, s.updated_at,
  (s.started_at at time zone coalesce(p.timezone, 'Asia/Tokyo'))::date as day
from public.life_workout_sessions s
left join public.life_profiles p on p.user_id = s.user_id;

create or replace view public.life_cardio_sessions_local
with (security_invoker = true)
as
select
  c.id, c.user_id, c.started_at, c.activity_type, c.distance_km, c.duration_sec,
  c.avg_hr, c.max_hr, c.rpe, c.source, c.notes, c.created_at, c.updated_at,
  (c.started_at at time zone coalesce(p.timezone, 'Asia/Tokyo'))::date as day
from public.life_cardio_sessions c
left join public.life_profiles p on p.user_id = c.user_id;

create or replace view public.life_nutrition_daily
with (security_invoker = true)
as
select
  m.user_id,
  (m.eaten_at at time zone coalesce(p.timezone, 'Asia/Tokyo'))::date as day,
  count(*)::integer as item_count,
  count(m.kcal)::integer as calories_known_count,
  sum(m.kcal) as calories_kcal,
  count(m.protein_g)::integer as protein_known_count,
  sum(m.protein_g) as protein_g,
  count(m.fat_g)::integer as fat_known_count,
  sum(m.fat_g) as fat_g,
  count(m.carbs_g)::integer as carbs_known_count,
  sum(m.carbs_g) as carbs_g,
  count(*) filter (where m.is_estimated)::integer as estimated_count
from public.life_meals m
left join public.life_profiles p on p.user_id = m.user_id
group by m.user_id, (m.eaten_at at time zone coalesce(p.timezone, 'Asia/Tokyo'))::date;

create or replace view public.life_micronutrition_daily
with (security_invoker = true)
as
with meal_counts as (
  select
    m.user_id,
    (m.eaten_at at time zone coalesce(p.timezone, 'Asia/Tokyo'))::date as day,
    count(*)::integer as item_count
  from public.life_meals m
  left join public.life_profiles p on p.user_id = m.user_id
  group by m.user_id, (m.eaten_at at time zone coalesce(p.timezone, 'Asia/Tokyo'))::date
),
nutrient_sums as (
  select
    m.user_id,
    (m.eaten_at at time zone coalesce(p.timezone, 'Asia/Tokyo'))::date as day,
    mn.nutrient_code,
    sum(mn.amount) as amount,
    count(distinct m.id)::integer as known_meal_count,
    count(*) filter (where mn.is_estimated)::integer as estimated_value_count
  from public.life_meals m
  join public.life_meal_nutrients mn
    on mn.meal_id = m.id and mn.user_id = m.user_id
  left join public.life_profiles p on p.user_id = m.user_id
  group by
    m.user_id,
    (m.eaten_at at time zone coalesce(p.timezone, 'Asia/Tokyo'))::date,
    mn.nutrient_code
)
select
  s.user_id, s.day, s.nutrient_code, s.amount,
  s.known_meal_count, mc.item_count, s.estimated_value_count
from nutrient_sums s
join meal_counts mc using (user_id, day);

create or replace view public.life_daily_summary
with (security_invoker = true)
as
with day_keys as (
  select user_id, day from public.life_meals_local
  union
  select user_id, day from public.life_workout_sessions_local
  union
  select user_id, day from public.life_cardio_sessions_local
),
strength_totals as (
  select user_id, day, count(*)::integer as strength_sessions
  from public.life_workout_sessions_local
  group by user_id, day
),
cardio_totals as (
  select
    user_id, day,
    count(*)::integer as cardio_sessions,
    sum(distance_km) as cardio_distance_km,
    sum(duration_sec) as cardio_duration_sec
  from public.life_cardio_sessions_local
  group by user_id, day
)
select
  d.user_id,
  d.day,
  n.calories_kcal,
  n.protein_g,
  n.fat_g,
  n.carbs_g,
  coalesce(s.strength_sessions, 0) as strength_sessions,
  coalesce(c.cardio_sessions, 0) as cardio_sessions,
  c.cardio_distance_km,
  c.cardio_duration_sec
from day_keys d
left join public.life_nutrition_daily n using (user_id, day)
left join strength_totals s using (user_id, day)
left join cardio_totals c using (user_id, day);

revoke all on public.life_meals_local from anon, authenticated;
revoke all on public.life_workout_sessions_local from anon, authenticated;
revoke all on public.life_cardio_sessions_local from anon, authenticated;
revoke all on public.life_nutrition_daily from anon, authenticated;
revoke all on public.life_micronutrition_daily from anon, authenticated;
revoke all on public.life_daily_summary from anon, authenticated;

grant select on public.life_meals_local to authenticated;
grant select on public.life_workout_sessions_local to authenticated;
grant select on public.life_cardio_sessions_local to authenticated;
grant select on public.life_nutrition_daily to authenticated;
grant select on public.life_micronutrition_daily to authenticated;
grant select on public.life_daily_summary to authenticated;

comment on view public.life_micronutrition_daily is
  'Missing nutrients remain absent rather than being treated as zero. known_meal_count/item_count exposes completeness.';

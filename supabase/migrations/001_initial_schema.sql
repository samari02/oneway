-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- HABITS
-- ============================================

create table habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  icon text,
  "order" int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table habit_check_ins (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid references habits(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  completed_at timestamptz default now(),
  unique(habit_id, date)
);

-- ============================================
-- BLOCKING
-- ============================================

create table blocking_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  pattern text not null,
  is_active boolean default true,
  mode text default 'focus' check (mode in ('off', 'focus', 'morning_routine')),
  created_at timestamptz default now()
);

create table blocking_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text default 'off' check (mode in ('off', 'focus', 'morning_routine')),
  active_until timestamptz,
  morning_routine_completed boolean default false,
  updated_at timestamptz default now()
);

-- ============================================
-- USER SETTINGS
-- ============================================

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  morning_routine_habits uuid[] default '{}',
  default_blocking_mode text default 'off',
  updated_at timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table habits enable row level security;
alter table habit_check_ins enable row level security;
alter table blocking_rules enable row level security;
alter table blocking_state enable row level security;
alter table user_settings enable row level security;

-- Habits: users can only see/edit their own
create policy "Users can manage own habits"
  on habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Check-ins: users can only see/edit their own
create policy "Users can manage own check-ins"
  on habit_check_ins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Blocking rules: users can only see/edit their own
create policy "Users can manage own blocking rules"
  on blocking_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Blocking state: users can only see/edit their own
create policy "Users can manage own blocking state"
  on blocking_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- User settings: users can only see/edit their own
create policy "Users can manage own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================

create index idx_habits_user_id on habits(user_id);
create index idx_check_ins_habit_date on habit_check_ins(habit_id, date);
create index idx_check_ins_user_date on habit_check_ins(user_id, date);
create index idx_blocking_rules_user_id on blocking_rules(user_id);

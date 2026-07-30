-- ============================================================
-- NotifyMVP - Supabase Database Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROJECTS TABLE
-- ============================================================
create table if not exists public.projects (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  app_id          text not null unique,
  api_key         text not null,
  firebase_json_path text,           -- path in private Supabase Storage bucket
  created_at      timestamptz not null default now()
);

-- Index for fast lookups by user
create index if not exists projects_user_id_idx on public.projects(user_id);
-- Index for device registration validation
create index if not exists projects_app_id_idx on public.projects(app_id);

-- ============================================================
-- DEVICES TABLE
-- ============================================================
create table if not exists public.devices (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  device_id   text not null,
  fcm_token   text not null,
  platform    text not null check (platform in ('android', 'ios', 'flutter', 'react-native')),
  app_version text,
  created_at  timestamptz not null default now(),
  -- A device_id is unique per project
  unique (project_id, device_id)
);

create index if not exists devices_project_id_idx on public.devices(project_id);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
create table if not exists public.notifications (
  id               uuid primary key default uuid_generate_v4(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  title            text not null,
  body             text not null,
  status           text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  recipient_count  int not null default 0,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists notifications_project_id_idx on public.notifications(project_id);
create index if not exists notifications_sent_at_idx   on public.notifications(sent_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Projects: users can only CRUD their own projects
alter table public.projects enable row level security;

create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Devices: accessible only via service-role (API routes) or by project owner
alter table public.devices enable row level security;

create policy "Project owners can view devices"
  on public.devices for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = devices.project_id and p.user_id = auth.uid()
    )
  );

-- Service role bypasses RLS — device registration uses service role key

-- Notifications: accessible only by project owner
alter table public.notifications enable row level security;

create policy "Project owners can view notifications"
  on public.notifications for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = notifications.project_id and p.user_id = auth.uid()
    )
  );

create policy "Project owners can insert notifications"
  on public.notifications for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = notifications.project_id and p.user_id = auth.uid()
    )
  );

-- ============================================================
-- STORAGE BUCKET (run separately or via Supabase dashboard)
-- ============================================================
-- insert into storage.buckets (id, name, public)
-- values ('firebase-credentials', 'firebase-credentials', false);
--
-- Storage policy: only the owning user can read/write their files
-- (configure via Supabase dashboard → Storage → firebase-credentials → Policies)

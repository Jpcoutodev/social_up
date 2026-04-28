-- ============================================
-- usage_log table — tracks every AI call per user
-- Used for: cost monitoring, abuse detection, and (later) plan quotas
-- ============================================

create table if not exists public.usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  provider text not null,          -- 'minimax' | 'gemini'
  action text not null,            -- 'chat' | 'image' | 'image_edit' | 'tts'
  units_in integer default 0,      -- input tokens or seconds (for cost calc)
  units_out integer default 0,     -- output tokens, images, or seconds
  estimated_cost_usd numeric(10,6) default 0,
  metadata jsonb,                  -- extra context (model used, scene index, etc.)
  created_at timestamptz default now()
);

create index if not exists usage_log_user_id_idx on public.usage_log (user_id, created_at desc);
create index if not exists usage_log_created_at_idx on public.usage_log (created_at desc);

alter table public.usage_log enable row level security;

-- Users can read their own logs
drop policy if exists "Users can view their own usage" on public.usage_log;
create policy "Users can view their own usage"
  on public.usage_log for select
  using (auth.uid() = user_id);

-- Admin (coutodev7@gmail.com) can read all
drop policy if exists "Admin can view all usage" on public.usage_log;
create policy "Admin can view all usage"
  on public.usage_log for select
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'coutodev7@gmail.com'
    )
  );

-- Inserts happen only via Edge Functions using the service_role key
-- (no INSERT policy needed because service_role bypasses RLS)

-- Run in Supabase SQL Editor
-- This sets up user-scoped booking and waitlist tables with RLS.

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'canceled')),
  created_at timestamptz not null default now(),
  service_id text not null,
  service_name text not null,
  duration_min integer not null,
  price_from numeric not null default 0,
  deposit numeric not null default 0,
  stylist_id text not null default 'auto',
  stylist_name text not null default 'Egal (automatisch)',
  date_iso date not null,
  time text not null,
  customer jsonb not null default '{}'::jsonb,
  deposit_paid boolean not null default false
);

create index if not exists bookings_user_created_idx on public.bookings(user_id, created_at desc);
create index if not exists bookings_user_date_idx on public.bookings(user_id, date_iso);

alter table public.bookings enable row level security;

drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own"
on public.bookings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "bookings_insert_own" on public.bookings;
create policy "bookings_insert_own"
on public.bookings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "bookings_update_own" on public.bookings;
create policy "bookings_update_own"
on public.bookings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "bookings_delete_own" on public.bookings;
create policy "bookings_delete_own"
on public.bookings
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  service_id text not null,
  service_name text not null,
  email text not null,
  phone text not null,
  note text default ''
);

create index if not exists waitlist_user_created_idx on public.waitlist(user_id, created_at desc);

alter table public.waitlist enable row level security;

drop policy if exists "waitlist_select_own" on public.waitlist;
create policy "waitlist_select_own"
on public.waitlist
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "waitlist_insert_own" on public.waitlist;
create policy "waitlist_insert_own"
on public.waitlist
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "waitlist_update_own" on public.waitlist;
create policy "waitlist_update_own"
on public.waitlist
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "waitlist_delete_own" on public.waitlist;
create policy "waitlist_delete_own"
on public.waitlist
for delete
to authenticated
using (auth.uid() = user_id);


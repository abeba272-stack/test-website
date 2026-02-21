-- Run in Supabase SQL Editor.
-- This migration adds:
-- 1) profiles + role model (customer/staff/admin)
-- 2) bookings/waitlist with strict RLS
-- 3) secure RPC functions for slot checks + booking create/cancel/status updates
-- 4) payment tracking fields for Stripe checkout/webhook integration

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
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
  deposit_paid boolean not null default false,
  payment_status text not null default 'unpaid',
  payment_provider text,
  payment_reference text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  payment_receipt_url text,
  paid_at timestamptz
);

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  service_id text not null,
  service_name text not null,
  email text not null,
  phone text not null,
  note text default ''
);

alter table public.bookings add column if not exists payment_status text not null default 'unpaid';
alter table public.bookings add column if not exists payment_provider text;
alter table public.bookings add column if not exists payment_reference text;
alter table public.bookings add column if not exists stripe_checkout_session_id text;
alter table public.bookings add column if not exists stripe_payment_intent_id text;
alter table public.bookings add column if not exists payment_receipt_url text;
alter table public.bookings add column if not exists paid_at timestamptz;

update public.bookings
set payment_status = case when deposit_paid then 'paid' else 'unpaid' end
where payment_status is null or payment_status = '';

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists bookings_user_created_idx on public.bookings(user_id, created_at desc);
create index if not exists bookings_date_status_idx on public.bookings(date_iso, status);
create index if not exists bookings_stylist_date_idx on public.bookings(stylist_id, date_iso);
create index if not exists bookings_payment_status_idx on public.bookings(payment_status);
create index if not exists waitlist_user_created_idx on public.waitlist(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at
before update on public.bookings
for each row execute procedure public.set_updated_at();

drop trigger if exists set_waitlist_updated_at on public.waitlist;
create trigger set_waitlist_updated_at
before update on public.waitlist
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

create or replace function public.user_role(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role from public.profiles p where p.id = p_user_id), 'customer');
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.user_role(auth.uid());
$$;

create or replace function public.is_staff_role(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_role(p_user_id) in ('staff', 'admin');
$$;

create or replace function public.minutes_from_time(p_time text)
returns integer
language sql
immutable
as $$
  select (extract(hour from p_time::time)::integer * 60) + extract(minute from p_time::time)::integer;
$$;

create or replace function public.slot_is_available(
  p_date_iso date,
  p_time text,
  p_duration_min integer,
  p_stylist_id text default 'auto',
  p_exclude_booking_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with desired as (
    select
      public.minutes_from_time(p_time) as start_min,
      public.minutes_from_time(p_time) + p_duration_min as end_min
  ),
  active as (
    select b.*
    from public.bookings b
    where b.date_iso = p_date_iso
      and b.status <> 'canceled'
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
  )
  select
    case
      when coalesce(p_stylist_id, 'auto') <> 'auto' then
        not exists (
          select 1
          from active b, desired d
          where b.stylist_id = p_stylist_id
            and public.minutes_from_time(b.time) < d.end_min
            and d.start_min < (public.minutes_from_time(b.time) + b.duration_min)
        )
      else
        (
          select count(*)
          from active b, desired d
          where public.minutes_from_time(b.time) < d.end_min
            and d.start_min < (public.minutes_from_time(b.time) + b.duration_min)
        ) < 4
    end;
$$;

create or replace function public.create_booking_secure(
  p_service_id text,
  p_service_name text,
  p_duration_min integer,
  p_price_from numeric,
  p_deposit numeric,
  p_stylist_id text,
  p_stylist_name text,
  p_date_iso date,
  p_time text,
  p_customer jsonb,
  p_deposit_paid boolean default false
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_duration_min is null or p_duration_min <= 0 then
    raise exception 'INVALID_DURATION';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_date_iso::text || '|' || coalesce(p_stylist_id, 'auto')));

  if not public.slot_is_available(
    p_date_iso,
    p_time,
    p_duration_min,
    coalesce(p_stylist_id, 'auto'),
    null
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  insert into public.bookings (
    user_id,
    status,
    service_id,
    service_name,
    duration_min,
    price_from,
    deposit,
    stylist_id,
    stylist_name,
    date_iso,
    time,
    customer,
    deposit_paid,
    payment_status
  )
  values (
    v_user_id,
    'requested',
    p_service_id,
    p_service_name,
    p_duration_min,
    coalesce(p_price_from, 0),
    coalesce(p_deposit, 0),
    coalesce(p_stylist_id, 'auto'),
    coalesce(p_stylist_name, 'Egal (automatisch)'),
    p_date_iso,
    p_time,
    coalesce(p_customer, '{}'::jsonb),
    coalesce(p_deposit_paid, false),
    case when coalesce(p_deposit_paid, false) then 'paid' else 'unpaid' end
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

create or replace function public.cancel_my_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.bookings
  set status = 'canceled'
  where id = p_booking_id
    and user_id = v_user_id
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN';
  end if;

  return v_booking;
end;
$$;

create or replace function public.set_booking_status(
  p_booking_id uuid,
  p_status text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_staff_role(v_user_id) then
    raise exception 'FORBIDDEN';
  end if;

  if p_status not in ('requested', 'confirmed', 'canceled') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.bookings
  set status = p_status
  where id = p_booking_id
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  return v_booking;
end;
$$;

alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.waitlist enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_staff_role(auth.uid()));

drop policy if exists "bookings_select_own" on public.bookings;
drop policy if exists "bookings_select" on public.bookings;
create policy "bookings_select"
on public.bookings
for select
to authenticated
using (user_id = auth.uid() or public.is_staff_role(auth.uid()));

drop policy if exists "bookings_insert_own" on public.bookings;
create policy "bookings_insert_own"
on public.bookings
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "bookings_update_own" on public.bookings;
drop policy if exists "bookings_update_staff" on public.bookings;
create policy "bookings_update_staff"
on public.bookings
for update
to authenticated
using (public.is_staff_role(auth.uid()))
with check (public.is_staff_role(auth.uid()));

drop policy if exists "bookings_delete_own" on public.bookings;
drop policy if exists "bookings_delete_own_or_staff" on public.bookings;
create policy "bookings_delete_own_or_staff"
on public.bookings
for delete
to authenticated
using (user_id = auth.uid() or public.is_staff_role(auth.uid()));

drop policy if exists "waitlist_select_own" on public.waitlist;
drop policy if exists "waitlist_select" on public.waitlist;
create policy "waitlist_select"
on public.waitlist
for select
to authenticated
using (user_id = auth.uid() or public.is_staff_role(auth.uid()));

drop policy if exists "waitlist_insert_own" on public.waitlist;
create policy "waitlist_insert_own"
on public.waitlist
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "waitlist_update_own" on public.waitlist;
drop policy if exists "waitlist_update_staff" on public.waitlist;
create policy "waitlist_update_staff"
on public.waitlist
for update
to authenticated
using (public.is_staff_role(auth.uid()))
with check (public.is_staff_role(auth.uid()));

drop policy if exists "waitlist_delete_own" on public.waitlist;
drop policy if exists "waitlist_delete_own_or_staff" on public.waitlist;
create policy "waitlist_delete_own_or_staff"
on public.waitlist
for delete
to authenticated
using (user_id = auth.uid() or public.is_staff_role(auth.uid()));

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.slot_is_available(date, text, integer, text, uuid) to authenticated;
grant execute on function public.create_booking_secure(text, text, integer, numeric, numeric, text, text, date, text, jsonb, boolean) to authenticated;
grant execute on function public.cancel_my_booking(uuid) to authenticated;
grant execute on function public.set_booking_status(uuid, text) to authenticated;

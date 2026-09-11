-- =====================================================================
-- Theme Park / Water Park Booking System — Supabase (PostgreSQL) schema
-- =====================================================================
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Design notes:
--  - `capacity_slots` is the single source of truth for inventory. Both the
--    online booking flow AND the POS adapter must decrement/increment
--    `booked_count` here so online + on-site sales never oversell.
--  - Money is stored in the smallest currency unit (centavos) as integers
--    to avoid floating point rounding errors.
--  - RLS is enabled everywhere. Public (anon) users can only READ published
--    ticket types/add-ons and slot availability. Writes to bookings/payments
--    happen through server-side code using the service role key (API routes),
--    never directly from the browser.
--  - `admin_users` mirrors `auth.users` (Supabase Auth) so we can attach
--    role-based permissions without touching the built-in auth schema.
-- =====================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type ticket_type_category as enum ('day_pass', 'season_pass', 'group_pass', 'addon');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pricing_tier as enum ('off_peak', 'peak', 'holiday');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('pending', 'confirmed', 'cancelled', 'expired', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_provider as enum ('maya', 'pos_cash', 'pos_card');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum ('issued', 'used', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sale_channel as enum ('online', 'pos');
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('super_admin', 'manager', 'gate_staff');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- ticket_types: day pass, season pass, group pass, etc.
-- ---------------------------------------------------------------------
create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category ticket_type_category not null default 'day_pass',
  -- base price in centavos (PHP smallest unit); peak/holiday pricing overrides live in capacity_slots
  base_price_cents integer not null check (base_price_cents >= 0),
  min_guests integer not null default 1 check (min_guests >= 1),
  max_guests integer, -- null = no per-order cap (group passes may set this)
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ticket_types is 'Sellable ticket products (day/season/group passes).';

-- ---------------------------------------------------------------------
-- ticket_addons: locker rental, cabana rental, etc.
-- ---------------------------------------------------------------------
create table if not exists public.ticket_addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price_cents integer not null check (price_cents >= 0),
  -- if set, this addon has its own daily inventory cap (e.g. only 20 cabanas)
  daily_stock integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ticket_addons is 'Optional add-ons purchasable alongside a ticket (lockers, cabanas, etc).';

-- ---------------------------------------------------------------------
-- capacity_slots: date + time slot + max capacity + booked count
-- This is the SINGLE SOURCE OF TRUTH for inventory (online + POS share it).
-- ---------------------------------------------------------------------
create table if not exists public.capacity_slots (
  id uuid primary key default gen_random_uuid(),
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  slot_date date not null,
  -- nullable start/end for parks that only cap per-day (not per timeslot)
  start_time time,
  end_time time,
  pricing_tier pricing_tier not null default 'off_peak',
  -- overrides ticket_types.base_price_cents when set (peak/off-peak/holiday pricing)
  price_cents_override integer check (price_cents_override >= 0),
  max_capacity integer not null check (max_capacity >= 0),
  booked_count integer not null default 0 check (booked_count >= 0),
  is_blackout boolean not null default false, -- true = no sales allowed regardless of capacity
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capacity_not_exceeded check (booked_count <= max_capacity),
  unique (ticket_type_id, slot_date, start_time)
);

create index if not exists idx_capacity_slots_lookup on public.capacity_slots (ticket_type_id, slot_date);

comment on table public.capacity_slots is 'Daily/time-slot inventory caps. booked_count is atomically incremented by both online bookings and POS sales via the reserve_capacity() function.';

-- ---------------------------------------------------------------------
-- bookings: one row per guest checkout/order
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique, -- short human-friendly code shown to guest
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  status booking_status not null default 'pending',
  payment_status payment_status not null default 'pending',
  sale_channel sale_channel not null default 'online',
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'PHP',
  notes text,
  -- expiry for pending/unpaid bookings so their held capacity can be released
  reserved_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bookings_status on public.bookings (status, payment_status);
create index if not exists idx_bookings_created_at on public.bookings (created_at desc);

comment on table public.bookings is 'Guest order/checkout. One booking can contain multiple booking_items (tickets + add-ons).';

-- ---------------------------------------------------------------------
-- booking_items: line items within a booking (a ticket or an add-on)
-- ---------------------------------------------------------------------
create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  item_type text not null check (item_type in ('ticket', 'addon')),
  ticket_type_id uuid references public.ticket_types(id),
  ticket_addon_id uuid references public.ticket_addons(id),
  capacity_slot_id uuid references public.capacity_slots(id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  -- QR e-ticket fields (one ticket_uuid per admitted guest; quantity > 1 tickets
  -- are represented as separate rows created at confirmation time, see below)
  ticket_uuid uuid unique default gen_random_uuid(),
  ticket_status ticket_status not null default 'issued',
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint booking_item_type_ref check (
    (item_type = 'ticket' and ticket_type_id is not null and ticket_addon_id is null)
    or
    (item_type = 'addon' and ticket_addon_id is not null and ticket_type_id is null)
  )
);

create index if not exists idx_booking_items_booking on public.booking_items (booking_id);
create index if not exists idx_booking_items_ticket_uuid on public.booking_items (ticket_uuid);

comment on table public.booking_items is 'Line items per booking. Ticket items carry a unique ticket_uuid used for the QR e-ticket / gate validation.';

-- ---------------------------------------------------------------------
-- payments: Maya (or POS) payment attempts/records for a booking
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider payment_provider not null default 'maya',
  provider_checkout_id text, -- Maya checkoutId
  provider_payment_id text, -- Maya paymentId once captured
  status payment_status not null default 'pending',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'PHP',
  raw_response jsonb, -- last raw payload from Maya for debugging/audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_booking on public.payments (booking_id);
create index if not exists idx_payments_checkout_id on public.payments (provider_checkout_id);

comment on table public.payments is 'Payment attempts/records, primarily Maya Checkout API. POS payments (cash/card at gate) also logged here for unified reporting.';

-- ---------------------------------------------------------------------
-- pos_sync_log: audit trail of every call made to/from the POS adapter
-- ---------------------------------------------------------------------
create table if not exists public.pos_sync_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  direction text not null check (direction in ('push', 'pull')),
  operation text not null, -- e.g. 'syncBooking', 'getInventory', 'pushSaleRecord'
  request_payload jsonb,
  response_payload jsonb,
  success boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_sync_log_booking on public.pos_sync_log (booking_id);

comment on table public.pos_sync_log is 'Audit log of every POSAdapter call so gate/back-office sync issues can be diagnosed.';

-- ---------------------------------------------------------------------
-- admin_users: park staff who can log into the admin dashboard
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role admin_role not null default 'gate_staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is 'Maps Supabase Auth users to staff roles for the admin dashboard (RBAC).';

-- =====================================================================
-- TRIGGERS: keep updated_at fresh
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['ticket_types','ticket_addons','capacity_slots','bookings','payments']
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t, t
    );
  end loop;
end $$;

-- =====================================================================
-- FUNCTION: reserve_capacity — atomic, race-safe capacity reservation.
-- Both the online booking API and the POS adapter MUST call this (or the
-- equivalent RPC) instead of updating booked_count directly, so concurrent
-- online + on-site sales can never oversell a slot.
-- =====================================================================
create or replace function public.reserve_capacity(
  p_capacity_slot_id uuid,
  p_quantity integer
) returns public.capacity_slots
language plpgsql
as $$
declare
  v_slot public.capacity_slots;
begin
  update public.capacity_slots
     set booked_count = booked_count + p_quantity
   where id = p_capacity_slot_id
     and is_blackout = false
     and booked_count + p_quantity <= max_capacity
  returning * into v_slot;

  if v_slot.id is null then
    raise exception 'CAPACITY_UNAVAILABLE: slot % cannot fit % more guest(s)', p_capacity_slot_id, p_quantity;
  end if;

  return v_slot;
end;
$$;

create or replace function public.release_capacity(
  p_capacity_slot_id uuid,
  p_quantity integer
) returns public.capacity_slots
language plpgsql
as $$
declare
  v_slot public.capacity_slots;
begin
  update public.capacity_slots
     set booked_count = greatest(booked_count - p_quantity, 0)
   where id = p_capacity_slot_id
  returning * into v_slot;

  return v_slot;
end;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.ticket_types enable row level security;
alter table public.ticket_addons enable row level security;
alter table public.capacity_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.payments enable row level security;
alter table public.pos_sync_log enable row level security;
alter table public.admin_users enable row level security;

-- Public (anon + authenticated) can read active/published catalog + slot availability.
create policy "public read active ticket_types" on public.ticket_types
  for select using (is_active = true);

create policy "public read active ticket_addons" on public.ticket_addons
  for select using (is_active = true);

create policy "public read capacity_slots" on public.capacity_slots
  for select using (true);

-- Bookings/payments/booking_items are NOT readable/writable by anon directly.
-- All guest-facing writes go through server-side API routes using the
-- Supabase service role key, which bypasses RLS by design.
-- Admins (authenticated + present in admin_users) get full read access for the dashboard.
create policy "admins read bookings" on public.bookings
  for select using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.is_active));

create policy "admins read booking_items" on public.booking_items
  for select using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.is_active));

create policy "admins read payments" on public.payments
  for select using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.is_active));

create policy "admins read pos_sync_log" on public.pos_sync_log
  for select using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.is_active));

create policy "admins manage ticket_types" on public.ticket_types
  for all using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role in ('super_admin','manager')))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role in ('super_admin','manager')));

create policy "admins manage ticket_addons" on public.ticket_addons
  for all using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role in ('super_admin','manager')))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role in ('super_admin','manager')));

create policy "admins manage capacity_slots" on public.capacity_slots
  for all using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role in ('super_admin','manager')))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role in ('super_admin','manager')));

create policy "users read own admin_users row" on public.admin_users
  for select using (id = auth.uid());

-- NOTE (TODO for client): refine RLS further once real staff roles/permissions
-- and any guest self-service "view my booking" flow (e.g. via magic link) are defined.

-- =====================================================================
-- SEED DATA (demo/prototype only — remove or replace before production)
-- =====================================================================
insert into public.ticket_types (name, slug, description, category, base_price_cents, max_guests, sort_order)
values
  ('Day Pass - Adult', 'day-pass-adult', 'Full-day access to all water park attractions.', 'day_pass', 150000, null, 1),
  ('Day Pass - Child', 'day-pass-child', 'Full-day access for children 4-12 yrs old.', 'day_pass', 100000, null, 2),
  ('Season Pass', 'season-pass', 'Unlimited visits for 12 months.', 'season_pass', 500000, null, 3),
  ('Group Pass (10 pax)', 'group-pass-10', 'Discounted day pass bundle for groups of 10.', 'group_pass', 1300000, 10, 4)
on conflict (slug) do nothing;

insert into public.ticket_addons (name, slug, description, price_cents, daily_stock, sort_order)
values
  ('Locker Rental', 'locker-rental', 'Small locker for the day.', 15000, 100, 1),
  ('Cabana Rental', 'cabana-rental', 'Private cabana for up to 6 guests.', 250000, 20, 2)
on conflict (slug) do nothing;

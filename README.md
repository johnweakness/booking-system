# Splash Cove — Theme Park / Water Park Booking System

A prototype ticketing & booking platform for a theme park / water park, built with Next.js (App Router, TypeScript, Tailwind CSS) and Supabase (Postgres + Auth).

## Stack

- **Frontend/Backend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS, API routes for backend logic.
- **Database**: Supabase (PostgreSQL), Supabase Auth for admin/staff login, Row Level Security everywhere.
- **Payments**: Maya (PayMaya) Checkout API (redirect-based), sandbox-first.
- **POS integration**: vendor-agnostic `POSAdapter` interface with a mock/sandbox implementation so the system is demoable without a real POS connection.
- **QR e-tickets**: generated with the `qrcode` package, validated via `/api/tickets/validate`.

## Getting started

1. Create a Supabase project, then run [supabase/schema.sql](supabase/schema.sql) in the SQL editor. This creates all tables, RLS policies, the `reserve_capacity`/`release_capacity` functions, and seeds a few demo ticket types/add-ons.
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project settings.
   - `MAYA_PUBLIC_KEY` / `MAYA_SECRET_KEY` sandbox keys from the [Maya developer portal](https://developers.maya.ph/).
   - Leave `POS_PROVIDER=mock` until a real POS vendor is confirmed (see below).
3. Create an admin user: sign a user up via Supabase Auth (dashboard or `supabase.auth.admin.createUser`), then insert a matching row into `admin_users` with their `auth.users.id` and a `role`.
4. Install deps and run the dev server:
   ```bash
   npm install
   npm run dev
   ```
5. Visit `http://localhost:3000` for the guest booking flow, `/admin/login` for the staff dashboard.

## Architecture notes

- **Single source of truth for inventory**: `capacity_slots.booked_count` in Postgres. Both the online booking flow (`src/lib/bookings/bookingService.ts`) and the POS adapter path go through the `reserve_capacity()` / `release_capacity()` SQL functions, which use a guarded `UPDATE ... WHERE booked_count + qty <= max_capacity` to avoid overselling under concurrent online + on-site sales.
- **POS abstraction**: `src/lib/pos/types.ts` defines the `POSAdapter` interface (`syncBooking`, `getInventory`, `pushSaleRecord`). `src/lib/pos/mockAdapter.ts` is a working sandbox implementation. `src/lib/pos/index.ts` is a factory (`getPOSAdapter()`) — swap in a real vendor by implementing the interface and adding a branch there. Every call is also logged to `pos_sync_log` for auditability.
- **Maya integration**: `src/lib/maya/client.ts` wraps the Checkout API (`createMayaCheckout`) and webhook signature verification (`verifyMayaWebhookSignature`). Routes: `POST /api/payments/create-checkout` (start payment) and `POST /api/payments/webhook` (authoritative payment status updates — never trust the redirect URL alone).
- **Booking flow**: guest picks a ticket type → date/slot (respecting live capacity) → add-ons → guest details → redirected to Maya → confirmation page renders one QR code per ticket (`booking_items.ticket_uuid`).
- **Admin dashboard**: `/admin/*`, gated by Supabase Auth (`requireAdmin()` helper) + `admin_users` table. CRUD for ticket types & capacity/pricing slots, bookings list with filters, and a basic sales report.

## Known assumptions / TODOs for the client

- **POS vendor is not finalized.** `POS_PROVIDER=mock` is used everywhere. Once confirmed, implement `POSAdapter` for that vendor and switch `POS_PROVIDER`.
- **Maya webhook signature scheme** (`verifyMayaWebhookSignature`) uses a commonly documented HMAC-SHA256 header convention — confirm the exact header name/algorithm for your merchant account and set `MAYA_WEBHOOK_SECRET`.
- **Cancellation/refund policy** is not implemented (statuses exist in the schema — `cancelled`, `refunded` — but no automated refund flow). Needs business rules from the client.
- **Admin RLS/roles** are minimal (`super_admin`/`manager`/`gate_staff` enum exists but only coarse checks are implemented) — revisit before production.
- Demo/seed data in `supabase/schema.sql` should be removed or replaced with real ticket types/pricing before launch.


// POS (Point of Sale) integration abstraction.
//
// The exact on-site POS vendor is NOT finalized yet, so all application code
// depends only on this `POSAdapter` interface. Swapping in a real vendor's
// API later should only require adding a new class that implements this
// interface (e.g. `src/lib/pos/adapters/acmePosAdapter.ts`) and wiring it up
// in `getPOSAdapter()` in `index.ts` — no other code should need to change.
//
// IMPORTANT: Supabase (`capacity_slots.booked_count`) remains the single
// source of truth for inventory. The POS adapter's `getInventory` should be
// used to reconcile/verify against the gate system, but capacity decisions
// for online sales are always made via `reserve_capacity()` in Postgres.

export interface POSInventory {
  ticketTypeId: string;
  date: string; // YYYY-MM-DD
  /** Capacity as currently known to the POS/gate system, if it tracks its own copy. */
  posMaxCapacity: number | null;
  posBookedCount: number | null;
  /** Set false if the POS could not be reached; caller should fall back to Supabase-only data. */
  available: boolean;
}

export interface POSBookingPayload {
  bookingId: string;
  bookingReference: string;
  guestName: string;
  guestEmail: string;
  items: Array<{
    ticketTypeId?: string;
    ticketAddonId?: string;
    quantity: number;
    unitPriceCents: number;
    slotDate?: string;
    startTime?: string | null;
  }>;
  totalCents: number;
  currency: string;
}

export interface POSSaleRecord {
  bookingId: string;
  bookingReference: string;
  totalCents: number;
  currency: string;
  paidAt: string;
  paymentProvider: string;
}

export interface POSSyncResult {
  success: boolean;
  posOrderId?: string;
  message?: string;
  raw?: unknown;
}

/**
 * Adapter interface every POS integration must implement.
 * TODO(client): confirm which POS vendor is being used on-site (e.g. Square,
 * Lightspeed, a custom in-house system) so a real adapter can be built. Until
 * then, `MockPOSAdapter` lets the rest of the system be demoed end-to-end.
 */
export interface POSAdapter {
  /** Push a confirmed/paid booking to the POS so gate staff see it in their system. */
  syncBooking(payload: POSBookingPayload): Promise<POSSyncResult>;

  /** Ask the POS for its view of remaining inventory for a ticket type/date (reconciliation only). */
  getInventory(ticketTypeId: string, date: string): Promise<POSInventory>;

  /** Notify the POS of a completed sale (online or on-site) for unified sales reporting. */
  pushSaleRecord(sale: POSSaleRecord): Promise<POSSyncResult>;
}

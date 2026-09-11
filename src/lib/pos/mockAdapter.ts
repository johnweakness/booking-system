import type {
  POSAdapter,
  POSBookingPayload,
  POSInventory,
  POSSaleRecord,
  POSSyncResult,
} from './types';

/**
 * Mock/sandbox POS adapter.
 *
 * Simulates a REST-based POS exposing `create_order`, `check_inventory`, and
 * `sync_ticket_status` endpoints, but just logs and returns success so the
 * rest of the booking system (Maya payments, admin dashboard, QR tickets)
 * can be demoed end-to-end without a real gate system connected.
 *
 * Replace with a real adapter (implementing the same `POSAdapter` interface)
 * once the client confirms their POS vendor. See `index.ts`.
 */
export class MockPOSAdapter implements POSAdapter {
  async syncBooking(payload: POSBookingPayload): Promise<POSSyncResult> {
    // Simulates calling POS `create_order` (or `sync_ticket_status` for an
    // order already paid online).
    console.info('[MockPOSAdapter] syncBooking', payload.bookingReference);
    await simulateLatency();

    return {
      success: true,
      posOrderId: `MOCK-${payload.bookingReference}`,
      message: 'Booking synced to mock POS (sandbox mode).',
    };
  }

  async getInventory(ticketTypeId: string, date: string): Promise<POSInventory> {
    // Simulates calling POS `check_inventory`. The mock has no independent
    // inventory of its own, so it always defers to Supabase as the source
    // of truth (available: true signals "no POS-side objection").
    console.info('[MockPOSAdapter] getInventory', ticketTypeId, date);
    await simulateLatency();

    return {
      ticketTypeId,
      date,
      posMaxCapacity: null,
      posBookedCount: null,
      available: true,
    };
  }

  async pushSaleRecord(sale: POSSaleRecord): Promise<POSSyncResult> {
    // Simulates calling POS `sync_ticket_status` / sales feed endpoint.
    console.info('[MockPOSAdapter] pushSaleRecord', sale.bookingReference);
    await simulateLatency();

    return {
      success: true,
      message: 'Sale record accepted by mock POS (sandbox mode).',
    };
  }
}

function simulateLatency(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

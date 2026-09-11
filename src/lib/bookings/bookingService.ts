import { createAdminClient } from '@/lib/supabase/admin';
import type { CapacitySlot, TicketAddon, TicketType } from '@/types/database';

// Server-side booking creation logic — the only path allowed to write
// bookings/booking_items, since it uses the service-role client and always
// recomputes prices/capacity from the database (never trusts client input).

export interface CreateBookingItemInput {
  itemType: 'ticket' | 'addon';
  ticketTypeId?: string;
  ticketAddonId?: string;
  capacitySlotId?: string; // required for ticket items
  quantity: number;
}

export interface CreateBookingInput {
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  items: CreateBookingItemInput[];
}

export class BookingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function generateBookingReference() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `BK-${date}-${rand}`;
}

export async function createPendingBooking(input: CreateBookingInput) {
  if (!input.items?.length) throw new BookingError('Booking must contain at least one item.');

  const supabase = createAdminClient();

  // 1. Load authoritative ticket types / addons / slots referenced by the request.
  const ticketTypeIds = [...new Set(input.items.filter((i) => i.ticketTypeId).map((i) => i.ticketTypeId!))];
  const addonIds = [...new Set(input.items.filter((i) => i.ticketAddonId).map((i) => i.ticketAddonId!))];
  const slotIds = [...new Set(input.items.filter((i) => i.capacitySlotId).map((i) => i.capacitySlotId!))];

  const [ticketTypesRes, addonsRes, slotsRes] = await Promise.all([
    ticketTypeIds.length
      ? supabase.from('ticket_types').select('*').in('id', ticketTypeIds)
      : Promise.resolve({ data: [] as TicketType[], error: null }),
    addonIds.length
      ? supabase.from('ticket_addons').select('*').in('id', addonIds)
      : Promise.resolve({ data: [] as TicketAddon[], error: null }),
    slotIds.length
      ? supabase.from('capacity_slots').select('*').in('id', slotIds)
      : Promise.resolve({ data: [] as CapacitySlot[], error: null }),
  ]);

  if (ticketTypesRes.error) throw new BookingError(ticketTypesRes.error.message, 500);
  if (addonsRes.error) throw new BookingError(addonsRes.error.message, 500);
  if (slotsRes.error) throw new BookingError(slotsRes.error.message, 500);

  const ticketTypes = new Map((ticketTypesRes.data as TicketType[]).map((t) => [t.id, t]));
  const addons = new Map((addonsRes.data as TicketAddon[]).map((a) => [a.id, a]));
  const slots = new Map((slotsRes.data as CapacitySlot[]).map((s) => [s.id, s]));

  // 2. Validate + price each line item using server-side data only.
  type PricedItem = CreateBookingItemInput & { unitPriceCents: number; lineTotalCents: number };
  const pricedItems: PricedItem[] = [];

  for (const item of input.items) {
    if (item.quantity <= 0) throw new BookingError('Item quantity must be positive.');

    if (item.itemType === 'ticket') {
      if (!item.ticketTypeId || !item.capacitySlotId) {
        throw new BookingError('Ticket items require ticketTypeId and capacitySlotId.');
      }
      const ticketType = ticketTypes.get(item.ticketTypeId);
      const slot = slots.get(item.capacitySlotId);
      if (!ticketType || !ticketType.is_active) throw new BookingError('Ticket type not found or inactive.');
      if (!slot) throw new BookingError('Capacity slot not found.');
      if (slot.ticket_type_id !== ticketType.id) {
        throw new BookingError('Capacity slot does not belong to the selected ticket type.');
      }
      if (slot.is_blackout) throw new BookingError(`Selected date ${slot.slot_date} is a blackout date.`);

      const unitPriceCents = slot.price_cents_override ?? ticketType.base_price_cents;
      pricedItems.push({ ...item, unitPriceCents, lineTotalCents: unitPriceCents * item.quantity });
    } else {
      if (!item.ticketAddonId) throw new BookingError('Add-on items require ticketAddonId.');
      const addon = addons.get(item.ticketAddonId);
      if (!addon || !addon.is_active) throw new BookingError('Add-on not found or inactive.');

      pricedItems.push({ ...item, unitPriceCents: addon.price_cents, lineTotalCents: addon.price_cents * item.quantity });
    }
  }

  const subtotalCents = pricedItems.reduce((sum, i) => sum + i.lineTotalCents, 0);

  // 3. Reserve capacity atomically for every ticket item (race-safe via reserve_capacity()).
  const reserved: { capacitySlotId: string; quantity: number }[] = [];
  try {
    for (const item of pricedItems) {
      if (item.itemType !== 'ticket') continue;
      const { error } = await supabase.rpc('reserve_capacity', {
        p_capacity_slot_id: item.capacitySlotId!,
        p_quantity: item.quantity,
      });
      if (error) throw new BookingError(`Capacity unavailable for one of the selected slots: ${error.message}`, 409);
      reserved.push({ capacitySlotId: item.capacitySlotId!, quantity: item.quantity });
    }
  } catch (err) {
    // Roll back any capacity we already reserved before this item failed.
    await Promise.all(
      reserved.map((r) =>
        supabase.rpc('release_capacity', { p_capacity_slot_id: r.capacitySlotId, p_quantity: r.quantity })
      )
    );
    throw err;
  }

  // 4. Create the booking (pending) + line items.
  const bookingReference = generateBookingReference();
  const reservedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min payment window

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      booking_reference: bookingReference,
      guest_name: input.guestName,
      guest_email: input.guestEmail,
      guest_phone: input.guestPhone ?? null,
      status: 'pending',
      payment_status: 'pending',
      sale_channel: 'online',
      subtotal_cents: subtotalCents,
      discount_cents: 0,
      total_cents: subtotalCents,
      reserved_until: reservedUntil,
    })
    .select()
    .single();

  if (bookingError || !booking) {
    await Promise.all(
      reserved.map((r) =>
        supabase.rpc('release_capacity', { p_capacity_slot_id: r.capacitySlotId, p_quantity: r.quantity })
      )
    );
    throw new BookingError(bookingError?.message ?? 'Failed to create booking.', 500);
  }

  const itemRows = pricedItems.map((item) => ({
    booking_id: booking.id,
    item_type: item.itemType,
    ticket_type_id: item.itemType === 'ticket' ? item.ticketTypeId : null,
    ticket_addon_id: item.itemType === 'addon' ? item.ticketAddonId : null,
    capacity_slot_id: item.capacitySlotId ?? null,
    quantity: item.quantity,
    unit_price_cents: item.unitPriceCents,
    line_total_cents: item.lineTotalCents,
  }));

  const { error: itemsError } = await supabase.from('booking_items').insert(itemRows);
  if (itemsError) {
    throw new BookingError(itemsError.message, 500);
  }

  return booking;
}

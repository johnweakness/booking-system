'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CapacitySlot, TicketAddon, TicketType } from '@/types/database';
import { formatCentsToCurrency } from '@/lib/format';

interface SlotWithAvailability extends CapacitySlot {
  remaining_capacity: number;
  sold_out: boolean;
}

type Step = 'slot' | 'addons' | 'details' | 'review';

export function BookingFlow({ ticketType }: { ticketType: TicketType }) {
  const [step, setStep] = useState<Step>('slot');
  const [slots, setSlots] = useState<SlotWithAvailability[]>([]);
  const [addons, setAddons] = useState<TicketAddon[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(ticketType.min_guests || 1);
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/slots?ticketTypeId=${ticketType.id}`)
      .then((res) => res.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setError('Failed to load available dates.'));

    const supabase = createClient();
    supabase
      .from('ticket_addons')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setAddons(data ?? []));
  }, [ticketType.id]);

  const selectedSlot = useMemo(() => slots.find((s) => s.id === selectedSlotId) ?? null, [slots, selectedSlotId]);

  const ticketUnitPriceCents = selectedSlot?.price_cents_override ?? ticketType.base_price_cents;
  const ticketTotalCents = ticketUnitPriceCents * quantity;
  const addonsTotalCents = Object.entries(addonQuantities).reduce((sum, [addonId, qty]) => {
    const addon = addons.find((a) => a.id === addonId);
    return sum + (addon ? addon.price_cents * qty : 0);
  }, 0);
  const grandTotalCents = ticketTotalCents + addonsTotalCents;

  const slotsByDate = useMemo(() => {
    const map = new Map<string, SlotWithAvailability[]>();
    for (const slot of slots) {
      const list = map.get(slot.slot_date) ?? [];
      list.push(slot);
      map.set(slot.slot_date, list);
    }
    return map;
  }, [slots]);

  async function handleSubmit() {
    if (!selectedSlot) {
      setError('Please select a date/slot.');
      return;
    }
    if (!guestName || !guestEmail) {
      setError('Name and email are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const items = [
        {
          itemType: 'ticket',
          ticketTypeId: ticketType.id,
          capacitySlotId: selectedSlot.id,
          quantity,
        },
        ...Object.entries(addonQuantities)
          .filter(([, qty]) => qty > 0)
          .map(([ticketAddonId, qty]) => ({ itemType: 'addon', ticketAddonId, quantity: qty })),
      ];

      const bookingRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName, guestEmail, guestPhone, items }),
      });
      const bookingData = await bookingRes.json();
      if (!bookingRes.ok) throw new Error(bookingData.error ?? 'Failed to create booking.');

      const checkoutRes = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bookingData.booking.id }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkoutData.error ?? 'Failed to start payment.');

      window.location.href = checkoutData.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-navy">{ticketType.name}</h1>
        <p className="mt-1 text-navy/70">{ticketType.description}</p>
      </div>

      <ol className="flex flex-wrap gap-2 text-sm font-medium">
        {(['slot', 'addons', 'details', 'review'] as Step[]).map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${
              step === s ? 'bg-ocean text-white' : 'bg-white text-navy/50'
            }`}
          >
            {i + 1}. {s[0].toUpperCase() + s.slice(1)}
          </li>
        ))}
      </ol>

      {error && <p className="rounded-xl bg-coral/10 p-3 text-sm text-coral-dark">{error}</p>}

      {step === 'slot' && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-navy">
            Choose a date &amp; slot
          </h2>
          {[...slotsByDate.entries()].map(([date, dateSlots]) => (
            <div key={date}>
              <p className="mb-2 font-medium text-navy">{date}</p>
              <div className="flex flex-wrap gap-2">
                {dateSlots.map((slot) => (
                  <button
                    key={slot.id}
                    disabled={slot.sold_out || slot.is_blackout}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition ${
                      selectedSlotId === slot.id
                        ? 'border-ocean bg-ocean text-white'
                        : 'border-ocean/15 text-navy hover:border-ocean/40'
                    } ${slot.sold_out || slot.is_blackout ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    {slot.start_time ? slot.start_time.slice(0, 5) : 'All day'}
                    {' · '}
                    {slot.is_blackout ? 'Blackout' : slot.sold_out ? 'Sold out' : `${slot.remaining_capacity} left`}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {slots.length === 0 && <p className="text-navy/50">No dates available right now.</p>}

          <div className="flex items-center gap-3">
            <label htmlFor="quantity" className="font-medium text-navy">
              Guests
            </label>
            <input
              id="quantity"
              type="number"
              min={ticketType.min_guests || 1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-20 rounded-lg border border-ocean/20 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean"
            />
          </div>

          <button
            disabled={!selectedSlot}
            onClick={() => setStep('addons')}
            className="ml-auto rounded-full bg-coral px-6 py-2 font-semibold text-white transition hover:bg-coral-dark disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          >
            Next
          </button>
        </section>
      )}

      {step === 'addons' && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-navy">
            Add-ons (optional)
          </h2>
          {addons.map((addon) => (
            <div key={addon.id} className="flex items-center justify-between rounded-xl border border-ocean/10 p-3">
              <div>
                <p className="font-medium text-navy">{addon.name}</p>
                <p className="text-sm text-navy/60">{formatCentsToCurrency(addon.price_cents)}</p>
              </div>
              <input
                type="number"
                min={0}
                value={addonQuantities[addon.id] ?? 0}
                onChange={(e) =>
                  setAddonQuantities((prev) => ({ ...prev, [addon.id]: Math.max(0, Number(e.target.value)) }))
                }
                className="w-20 rounded-lg border border-ocean/20 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean"
              />
            </div>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setStep('slot')}
              className="rounded-full border-2 border-ocean/30 px-6 py-2 font-semibold text-ocean-dark transition hover:border-ocean"
            >
              Back
            </button>
            <button
              onClick={() => setStep('details')}
              className="rounded-full bg-coral px-6 py-2 font-semibold text-white transition hover:bg-coral-dark"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === 'details' && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-navy">Your details</h2>
          <input
            placeholder="Full name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="rounded-lg border border-ocean/20 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean"
          />
          <input
            placeholder="Email"
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            className="rounded-lg border border-ocean/20 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean"
          />
          <input
            placeholder="Phone (optional)"
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            className="rounded-lg border border-ocean/20 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean"
          />
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setStep('addons')}
              className="rounded-full border-2 border-ocean/30 px-6 py-2 font-semibold text-ocean-dark transition hover:border-ocean"
            >
              Back
            </button>
            <button
              onClick={() => setStep('review')}
              className="rounded-full bg-coral px-6 py-2 font-semibold text-white transition hover:bg-coral-dark"
            >
              Review
            </button>
          </div>
        </section>
      )}

      {step === 'review' && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-navy">Review &amp; pay</h2>
          <div className="rounded-xl bg-sky-mist p-4 text-sm text-navy">
            <div className="flex justify-between">
              <span>
                {ticketType.name} x{quantity}
              </span>
              <span>{formatCentsToCurrency(ticketTotalCents)}</span>
            </div>
            {Object.entries(addonQuantities)
              .filter(([, qty]) => qty > 0)
              .map(([addonId, qty]) => {
                const addon = addons.find((a) => a.id === addonId);
                if (!addon) return null;
                return (
                  <div key={addonId} className="flex justify-between">
                    <span>
                      {addon.name} x{qty}
                    </span>
                    <span>{formatCentsToCurrency(addon.price_cents * qty)}</span>
                  </div>
                );
              })}
            <div className="mt-2 flex justify-between border-t border-ocean/15 pt-2 font-semibold">
              <span>Total</span>
              <span className="text-ocean-dark">{formatCentsToCurrency(grandTotalCents)}</span>
            </div>
          </div>
          <p className="text-xs text-navy/50">
            You will be redirected to Maya to complete payment (cards, e-wallets, QRPH).
          </p>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setStep('details')}
              className="rounded-full border-2 border-ocean/30 px-6 py-2 font-semibold text-ocean-dark transition hover:border-ocean"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-full bg-coral px-6 py-2 font-semibold text-white transition hover:bg-coral-dark disabled:opacity-50"
            >
              {submitting ? 'Redirecting…' : 'Pay with Maya'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

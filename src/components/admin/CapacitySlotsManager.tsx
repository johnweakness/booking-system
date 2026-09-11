'use client';

import { useEffect, useState } from 'react';
import type { CapacitySlot } from '@/types/database';
import { formatCentsToCurrency } from '@/lib/format';

export function CapacitySlotsManager({ ticketTypes }: { ticketTypes: { id: string; name: string }[] }) {
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? '');
  const [slots, setSlots] = useState<CapacitySlot[]>([]);
  const [slotDate, setSlotDate] = useState('');
  const [maxCapacity, setMaxCapacity] = useState(100);
  const [pricingTier, setPricingTier] = useState('off_peak');
  const [priceOverride, setPriceOverride] = useState<number | ''>('');
  const [isBlackout, setIsBlackout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(ttId: string) {
    if (!ttId) return;
    const res = await fetch(`/api/admin/capacity-slots?ticketTypeId=${ttId}`);
    const data = await res.json();
    setSlots(data.slots ?? []);
  }

  useEffect(() => {
    load(ticketTypeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketTypeId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/capacity-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketTypeId,
        slotDate,
        maxCapacity,
        pricingTier,
        priceCentsOverride: priceOverride === '' ? null : priceOverride,
        isBlackout,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setSlotDate('');
    load(ticketTypeId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <label className="text-xs text-gray-500">Ticket type</label>
        <select
          value={ticketTypeId}
          onChange={(e) => setTicketTypeId(e.target.value)}
          className="w-64 rounded border border-gray-300 px-2 py-1"
        >
          {ticketTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 rounded border border-gray-200 p-4">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Date</label>
          <input
            type="date"
            value={slotDate}
            onChange={(e) => setSlotDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
            required
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Max capacity</label>
          <input
            type="number"
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(Number(e.target.value))}
            className="w-28 rounded border border-gray-300 px-2 py-1"
            required
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Pricing tier</label>
          <select
            value={pricingTier}
            onChange={(e) => setPricingTier(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            <option value="off_peak">Off-peak</option>
            <option value="peak">Peak</option>
            <option value="holiday">Holiday</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Price override (cents)</label>
          <input
            type="number"
            value={priceOverride}
            onChange={(e) => setPriceOverride(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-32 rounded border border-gray-300 px-2 py-1"
            placeholder="Uses base price"
          />
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-500">
          <input type="checkbox" checked={isBlackout} onChange={(e) => setIsBlackout(e.target.checked)} />
          Blackout date
        </label>
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Add slot
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2">Date</th>
            <th>Tier</th>
            <th>Price override</th>
            <th>Capacity</th>
            <th>Booked</th>
            <th>Blackout</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.id} className="border-b border-gray-100">
              <td className="py-2">{s.slot_date}</td>
              <td>{s.pricing_tier}</td>
              <td>{s.price_cents_override ? formatCentsToCurrency(s.price_cents_override) : '—'}</td>
              <td>{s.max_capacity}</td>
              <td>{s.booked_count}</td>
              <td>{s.is_blackout ? 'Yes' : 'No'}</td>
            </tr>
          ))}
          {slots.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-gray-500">
                No slots configured for this ticket type yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

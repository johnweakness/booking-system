'use client';

import { useEffect, useState } from 'react';
import type { TicketType } from '@/types/database';
import { formatCentsToCurrency } from '@/lib/format';

export function TicketTypesManager() {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [priceCents, setPriceCents] = useState(0);
  const [category, setCategory] = useState('day_pass');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/ticket-types');
    const data = await res.json();
    setTicketTypes(data.ticketTypes ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/ticket-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, basePriceCents: priceCents, category }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setName('');
    setSlug('');
    setPriceCents(0);
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/ticket-types/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 rounded border border-gray-200 p-4">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-gray-300 px-2 py-1" required />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded border border-gray-300 px-2 py-1" required />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-gray-300 px-2 py-1">
            <option value="day_pass">Day pass</option>
            <option value="season_pass">Season pass</option>
            <option value="group_pass">Group pass</option>
            <option value="addon">Add-on</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Price (cents)</label>
          <input
            type="number"
            value={priceCents}
            onChange={(e) => setPriceCents(Number(e.target.value))}
            className="w-32 rounded border border-gray-300 px-2 py-1"
            required
          />
        </div>
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Add ticket type
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2">Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {ticketTypes.map((t) => (
            <tr key={t.id} className="border-b border-gray-100">
              <td className="py-2">{t.name}</td>
              <td>{t.category}</td>
              <td>{formatCentsToCurrency(t.base_price_cents)}</td>
              <td>{t.is_active ? 'Yes' : 'No'}</td>
              <td>
                <button onClick={() => toggleActive(t.id, t.is_active)} className="underline">
                  {t.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

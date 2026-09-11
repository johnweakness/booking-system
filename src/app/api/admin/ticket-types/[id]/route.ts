import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('ticket_types')
    .update({
      name: body.name,
      description: body.description,
      category: body.category,
      base_price_cents: body.basePriceCents,
      min_guests: body.minGuests,
      max_guests: body.maxGuests,
      is_active: body.isActive,
      sort_order: body.sortOrder,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ticketType: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  // Soft-delete: deactivate instead of hard delete, to preserve booking history integrity.
  const { error } = await supabase.from('ticket_types').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

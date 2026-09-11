import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Admin CRUD for ticket types.
// TODO(client): protect these routes with Supabase Auth session + admin_users
// role check before going to production (see src/lib/supabase/server.ts).

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('ticket_types').select('*').order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ticketTypes: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('ticket_types')
    .insert({
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
      category: body.category ?? 'day_pass',
      base_price_cents: body.basePriceCents,
      min_guests: body.minGuests ?? 1,
      max_guests: body.maxGuests ?? null,
      is_active: body.isActive ?? true,
      sort_order: body.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ticketType: data }, { status: 201 });
}

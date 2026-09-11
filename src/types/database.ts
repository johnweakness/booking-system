// Hand-written types mirroring supabase/schema.sql.
// TODO: replace with generated types via `supabase gen types typescript` once the
// project is linked to a real Supabase instance.

export type TicketTypeCategory = 'day_pass' | 'season_pass' | 'group_pass' | 'addon';
export type PricingTier = 'off_peak' | 'peak' | 'holiday';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
export type PaymentProvider = 'maya' | 'pos_cash' | 'pos_card';
export type TicketStatus = 'issued' | 'used' | 'void';
export type SaleChannel = 'online' | 'pos';
export type AdminRole = 'super_admin' | 'manager' | 'gate_staff';

export interface TicketType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: TicketTypeCategory;
  base_price_cents: number;
  min_guests: number;
  max_guests: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TicketAddon {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  daily_stock: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CapacitySlot {
  id: string;
  ticket_type_id: string;
  slot_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  pricing_tier: PricingTier;
  price_cents_override: number | null;
  max_capacity: number;
  booked_count: number;
  is_blackout: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  booking_reference: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  status: BookingStatus;
  payment_status: PaymentStatus;
  sale_channel: SaleChannel;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  notes: string | null;
  reserved_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingItem {
  id: string;
  booking_id: string;
  item_type: 'ticket' | 'addon';
  ticket_type_id: string | null;
  ticket_addon_id: string | null;
  capacity_slot_id: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  ticket_uuid: string | null;
  ticket_status: TicketStatus;
  used_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  provider: PaymentProvider;
  provider_checkout_id: string | null;
  provider_payment_id: string | null;
  status: PaymentStatus;
  amount_cents: number;
  currency: string;
  raw_response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PosSyncLog {
  id: string;
  booking_id: string | null;
  direction: 'push' | 'pull';
  operation: string;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  full_name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
}

// Minimal `Database` shape (Row = Insert = Update, permissive) so the
// Supabase JS client can type `.from(table)` calls without generating
// "never" types. TODO: replace with `supabase gen types typescript` output
// once linked to a real Supabase project, for stricter Insert/Update types.
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<T, R extends Relationship[] = []> = {
  Row: T & Record<string, unknown>;
  Insert: Partial<T> & Record<string, unknown>;
  Update: Partial<T> & Record<string, unknown>;
  Relationships: R;
};

export interface Database {
  public: {
    Tables: {
      ticket_types: Table<TicketType>;
      ticket_addons: Table<TicketAddon>;
      capacity_slots: Table<
        CapacitySlot,
        [
          {
            foreignKeyName: 'capacity_slots_ticket_type_id_fkey';
            columns: ['ticket_type_id'];
            isOneToOne: false;
            referencedRelation: 'ticket_types';
            referencedColumns: ['id'];
          },
        ]
      >;
      bookings: Table<Booking>;
      booking_items: Table<
        BookingItem,
        [
          {
            foreignKeyName: 'booking_items_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_items_ticket_type_id_fkey';
            columns: ['ticket_type_id'];
            isOneToOne: false;
            referencedRelation: 'ticket_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_items_ticket_addon_id_fkey';
            columns: ['ticket_addon_id'];
            isOneToOne: false;
            referencedRelation: 'ticket_addons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_items_capacity_slot_id_fkey';
            columns: ['capacity_slot_id'];
            isOneToOne: false;
            referencedRelation: 'capacity_slots';
            referencedColumns: ['id'];
          },
        ]
      >;
      payments: Table<
        Payment,
        [
          {
            foreignKeyName: 'payments_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ]
      >;
      pos_sync_log: Table<
        PosSyncLog,
        [
          {
            foreignKeyName: 'pos_sync_log_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ]
      >;
      admin_users: Table<AdminUser>;
    };
    Views: Record<string, never>;
    Functions: {
      reserve_capacity: {
        Args: { p_capacity_slot_id: string; p_quantity: number };
        Returns: CapacitySlot;
      };
      release_capacity: {
        Args: { p_capacity_slot_id: string; p_quantity: number };
        Returns: CapacitySlot;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}


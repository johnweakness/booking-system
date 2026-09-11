import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Simple anon-key Supabase client for public, read-only catalog data (active
// ticket types / add-ons / slot availability) in Server Components. RLS
// policies in supabase/schema.sql restrict this key to `is_active = true`
// rows and open slot availability — safe to use without a user session.
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

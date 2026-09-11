'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Client-side Supabase client for use in Client Components.
// Uses the anon key, which is safe to expose to the browser because RLS
// policies (see supabase/schema.sql) restrict what anon users can read/write.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

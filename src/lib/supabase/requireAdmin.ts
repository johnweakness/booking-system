import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Call at the top of any admin Server Component page to enforce authentication. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin/login');
  return user;
}

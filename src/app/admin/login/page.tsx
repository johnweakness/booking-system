'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push('/admin/bookings');
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12">
      <div>
        <p className="text-sm font-medium text-ocean-dark">Splash Cove</p>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy">Staff / Admin login</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-ocean/20 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-ocean/20 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean"
          required
        />
        {error && <p className="text-sm text-coral-dark">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-ocean px-4 py-2 font-semibold text-white transition hover:bg-ocean-dark disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="text-xs text-navy/50">
        TODO(client): admin accounts must be created in Supabase Auth + given a row in
        `admin_users` before they can sign in here.
      </p>
    </main>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AdminSignOutButton } from '@/components/admin/AdminSignOutButton';

const NAV_ITEMS = [
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/ticket-types', label: 'Ticket Types' },
  { href: '/admin/capacity-slots', label: 'Capacity & Pricing' },
  { href: '/admin/reports', label: 'Sales Reports' },
];

// NOTE: this layout wraps /admin/login too, so it only renders the sidebar
// nav — actual authentication is enforced per-page via requireAdmin() (see
// src/lib/supabase/requireAdmin.ts) to avoid redirect loops on the login page.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="flex min-h-full flex-1">{children}</div>;
  }

  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 flex-col gap-1 border-r border-ocean/10 bg-white p-4">
        <p className="mb-4 font-[family-name:var(--font-display)] font-bold text-ocean-dark">Splash Cove Admin</p>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm text-navy transition hover:bg-ocean/10"
          >
            {item.label}
          </Link>
        ))}
        <div className="mt-auto pt-4 text-xs text-navy/50">
          <p className="mb-2 truncate">{user.email}</p>
          <AdminSignOutButton />
        </div>
      </aside>
      <div className="flex-1 bg-sky-mist p-6">{children}</div>
    </div>
  );
}

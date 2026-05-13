'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth, useDocument } from '@batalha/firebase';
import { Button, Skeleton, cn } from '@batalha/ui';
import { ADMIN_NAV_ITEMS, isAdminNavItemActive } from './admin-nav';

interface AdminUserDoc {
  role?: string;
  displayName?: string;
  email?: string;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const isLoginPage = pathname === '/entrar';
  const { data: profile, loading: profileLoading } = useDocument<AdminUserDoc>(
    'users',
    user && !isLoginPage ? user.uid : undefined,
  );

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace('/entrar');
    }
  }, [isLoginPage, loading, router, user]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-surface-950">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4">
          <div className="w-full space-y-4">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-red-400">
            Acesso negado
          </p>
          <h1 className="mt-3 text-2xl font-bold text-white">Conta sem permissao administrativa</h1>
          <p className="mt-2 text-sm text-surface-400">
            Entre com uma conta administradora para acessar o painel.
          </p>
          <Button className="mt-6" variant="secondary" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const displayName = profile.displayName || user.displayName || user.email || 'Admin';

  return (
    <div className="min-h-screen bg-[#080b12] text-white">
      <div className="flex min-h-screen lg:pl-72">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/10 bg-surface-950/95 lg:flex lg:flex-col">
          <div className="shrink-0 border-b border-white/10 px-5 py-5">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <img
                src="/logo.png"
                alt="Absolute Assobio"
                className="h-10 w-10 rounded-xl object-contain"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">
                  Absolute Assobio
                </p>
                <h1 className="truncate text-lg font-bold text-white">Admin ERP</h1>
              </div>
            </Link>
          </div>

          <nav
            className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
            aria-label="Navegacao administrativa"
          >
            <div className="flex flex-col gap-1">
              {ADMIN_NAV_ITEMS.map((item) => {
                const active = isAdminNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-lg border px-3 py-3 text-sm transition-colors',
                      active
                        ? 'border-brand-500/40 bg-brand-500/15 text-white'
                        : 'border-transparent text-surface-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white',
                    )}
                  >
                    <span className="block font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-surface-500">
                      {item.description}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="shrink-0 border-t border-white/10 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-surface-500">Administrador</p>
            </div>
            <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={signOut}>
              Sair
            </Button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-white/10 bg-surface-950/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="flex min-w-0 items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Absolute Assobio"
                  className="h-10 w-10 rounded-xl object-contain"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">
                    Absolute Assobio
                  </p>
                  <h1 className="truncate text-base font-bold text-white">Admin ERP</h1>
                </div>
              </Link>
              <Button size="sm" variant="secondary" onClick={signOut}>
                Sair
              </Button>
            </div>

            <nav
              className="mt-3 flex gap-2 overflow-x-auto pb-1"
              aria-label="Navegacao administrativa"
            >
              {ADMIN_NAV_ITEMS.map((item) => {
                const active = isAdminNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-brand-500 text-white'
                        : 'text-surface-300 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

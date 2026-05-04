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
    <div className="min-h-screen bg-surface-950 text-white">
      <div className="border-b border-white/10 bg-surface-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <img
                src="/logo.png"
                alt="A casa do assobiador"
                className="h-10 w-10 rounded-xl object-contain"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">
                  assobiador.com
                </p>
                <h1 className="truncate text-lg font-bold text-white">Painel Administrativo</h1>
              </div>
            </Link>
            <Button className="lg:hidden" size="sm" variant="secondary" onClick={signOut}>
              Sair
            </Button>
          </div>

          <nav
            className="flex gap-2 overflow-x-auto pb-1 lg:pb-0"
            aria-label="Navegacao administrativa"
          >
            {ADMIN_NAV_ITEMS.map((item) => {
              const active = isAdminNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors',
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

          <div className="hidden min-w-0 items-center gap-3 lg:flex">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-surface-500">Administrador</p>
            </div>
            <Button size="sm" variant="secondary" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

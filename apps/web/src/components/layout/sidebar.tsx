'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, CalendarDays, Flame, Home, LogOut, Plus, Rocket, Swords, Trophy } from 'lucide-react';
import { useAuth, useDocument } from '@batalha/firebase';
import { Avatar } from '@batalha/ui';
import type { User as AppUser } from '@batalha/types';
import { getVersionedAvatarUrl } from '../../lib/avatar-url';
import { PUBLIC_LOGO_ICON_SRC } from '../../lib/public-assets';
import { PUBLIC_BRAND_NAME } from '../../lib/public-brand';

const NAV_ITEMS: { href: string; icon: React.ElementType; label: string; exact?: boolean }[] = [
  { href: '/', icon: Home, label: 'Início', exact: true },
  { href: '/batalhas', icon: Swords, label: 'Batalhas' },
  { href: '/classificatorias', icon: Rocket, label: 'Classificatórias' },
  { href: '/ranking', icon: BarChart2, label: 'Rankings' },
  { href: '/campeonatos', icon: Trophy, label: 'Campeonatos' },
  { href: '/destaques', icon: Flame, label: 'Destaques' },
  { href: '/agenda', icon: CalendarDays, label: 'Agenda' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { data: profile } = useDocument<AppUser>('users', user?.uid);
  const avatarSrc = getVersionedAvatarUrl(profile?.photoURL, profile?.photoVersion);
  const displayName = profile?.displayName || user?.displayName || '';

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-white/5 bg-surface-950 lg:flex">
      {/* Brand — takes the place of the header logo on desktop */}
      <Link href="/" className="flex h-14 flex-shrink-0 items-center gap-2.5 border-b border-white/5 px-4">
        <img
          src={PUBLIC_LOGO_ICON_SRC}
          alt={PUBLIC_BRAND_NAME}
          className="h-8 w-8 flex-shrink-0 rounded-xl object-contain"
        />
        <span className="text-base font-bold text-white">{PUBLIC_BRAND_NAME}</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none]">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-300'
                    : 'text-surface-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-brand-400' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="space-y-2 border-t border-white/5 px-3 py-4">
        {user ? (
          <>
            <Link
              href="/criar-batalha"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-500/25 bg-brand-500/10 py-2.5 text-sm font-semibold text-brand-300 transition-colors hover:bg-brand-500/20 hover:text-brand-200"
            >
              <Plus className="h-4 w-4" />
              Criar batalha
            </Link>
            <Link
              href="/conta"
              className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.05]"
            >
              <Avatar src={avatarSrc} name={displayName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{displayName.split(' ')[0]}</p>
                <p className="text-xs text-surface-500">Minha conta</p>
              </div>
            </Link>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-surface-500 transition-colors hover:bg-white/[0.05] hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </>
        ) : (
          <>
            <Link
              href="/cadastro"
              className="flex w-full items-center justify-center rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Criar conta
            </Link>
            <Link
              href="/entrar"
              className="flex w-full items-center justify-center rounded-xl border border-white/10 py-2 text-sm font-medium text-surface-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Entrar
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Clock, Menu, User, LogOut, Plus } from 'lucide-react';
import { orderBy, useAuth, useCollection, useDocument } from '@batalha/firebase';
import { Avatar, Badge, Button } from '@batalha/ui';
import { formatRelativeTime } from '@batalha/utils';
import type { Battle, Championship, QualifierTrack, User as AppUser } from '@batalha/types';
import { getVersionedAvatarUrl } from '../../lib/avatar-url';
import { getHeaderTickerItems } from '../../lib/header-ticker';
import { PUBLIC_BRAND_NAME } from '../../lib/public-brand';
import { trackAuthCtaClick } from '../../lib/analytics-events';
import { MobileNav } from './mobile-nav';

function EventTicker() {
  const { data: battles } = useCollection<Battle>('battles', [orderBy('createdAt', 'desc')]);
  const { data: qualifierTracks } = useCollection<QualifierTrack>('qualifierTracks', [
    orderBy('registrationDeadline', 'asc'),
  ]);
  const { data: championships } = useCollection<Championship>('championships', [
    orderBy('createdAt', 'desc'),
  ]);
  const tickerItems = useMemo(
    () => getHeaderTickerItems({ battles, qualifierTracks, championships, limit: 8 }),
    [battles, championships, qualifierTracks],
  );

  if (tickerItems.length === 0) return null;

  return (
    <div className="border-t border-white/5 bg-surface-950/95">
      <div className="mx-auto flex max-w-6xl snap-x items-stretch overflow-x-auto px-3 [scrollbar-width:none] sm:px-4">
        <div className="flex min-w-[96px] flex-shrink-0 items-center border-l border-r border-white/5 px-2 sm:min-w-[112px] sm:px-3">
          <Link
            href="/agenda"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-[11px] font-semibold text-surface-300 transition-colors hover:border-brand-500/40 hover:text-white sm:px-3 sm:text-xs"
          >
            Agenda
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {tickerItems.map((item) => {
          return (
            <div
              key={item.id}
              className="flex min-w-[184px] max-w-[210px] snap-start flex-col justify-between gap-2 border-r border-white/5 px-3 py-2.5 sm:min-w-[220px] sm:max-w-[240px] sm:py-3"
            >
              <Link href={item.href} className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant={item.badgeVariant} className="text-[10px]">
                    {item.badgeLabel}
                  </Badge>
                  <span className="truncate text-xs font-medium text-brand-400">
                    {item.statusLabel}
                  </span>
                </div>
                <p className="mt-1 truncate text-[13px] font-semibold text-white sm:text-sm">
                  {item.title}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-surface-500">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(item.nextAt)}
                </p>
              </Link>
              <Link
                href={item.actionHref}
                className="inline-flex h-7 w-fit flex-shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-bold text-surface-200 transition-colors hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-300"
              >
                {item.actionLabel}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Header() {
  const { user, loading, signOut } = useAuth();
  const { data: profile } = useDocument<AppUser>('users', user?.uid);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarSrc = getVersionedAvatarUrl(profile?.photoURL, profile?.photoVersion);
  const displayName = profile?.displayName || user?.displayName || 'U';

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-surface-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt={PUBLIC_BRAND_NAME}
              className="h-9 w-9 rounded-xl object-contain shadow-glow-sm"
            />
            <span className="hidden text-lg font-bold text-white sm:block">Absolute Assobio</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user && (
              <Link
                href="/criar-batalha"
                className="hidden items-center gap-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-400 transition-colors hover:bg-brand-500/20 md:flex"
              >
                <Plus className="h-4 w-4" />
                Criar batalha
              </Link>
            )}
            {loading ? (
              <div className="h-10 w-10 animate-pulse rounded-full bg-white/5" />
            ) : user ? (
              <div className="relative">
                <Link
                  href="/criar-batalha"
                  className="mr-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-300 transition-colors hover:bg-brand-500/20 md:hidden"
                  aria-label="Criar batalha"
                >
                  <Plus className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="hidden items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-white/5 md:flex"
                >
                  <Avatar src={avatarSrc} name={displayName} size="sm" />
                  <span className="hidden text-sm font-medium text-surface-300 md:block">
                    {displayName.split(' ')[0]}
                  </span>
                </button>

                {/* Dropdown */}
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-scale-in rounded-xl border border-white/10 bg-surface-900 p-2 shadow-elevated">
                      <Link
                        href="/conta"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-surface-300 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <User className="h-4 w-4" />
                        Minha Conta
                      </Link>
                      <div className="my-1 border-t border-white/5" />
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          signOut();
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-surface-300 transition-colors hover:bg-white/5 hover:text-red-400"
                      >
                        <LogOut className="h-4 w-4" />
                        Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link href="/entrar">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => trackAuthCtaClick({ action: 'login', location: 'header_desktop' })}
                  >
                    Entrar
                  </Button>
                </Link>
                <Link href="/cadastro">
                  <Button
                    size="sm"
                    onClick={() =>
                      trackAuthCtaClick({ action: 'signup', location: 'header_desktop' })
                    }
                  >
                    Criar conta
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-surface-400 transition-colors hover:bg-white/5 hover:text-white md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
        <EventTicker />
      </header>

      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
        avatarSrc={avatarSrc}
        displayName={displayName}
        onSignOut={signOut}
      />
    </>
  );
}

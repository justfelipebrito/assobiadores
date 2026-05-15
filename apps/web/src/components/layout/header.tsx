'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Clock, Menu } from 'lucide-react';
import { orderBy, useAuth, useCollection, useDocument } from '@batalha/firebase';
import { Badge } from '@batalha/ui';
import { formatRelativeTime } from '@batalha/utils';
import type { Battle, Championship, QualifierTrack, User as AppUser } from '@batalha/types';
import { getVersionedAvatarUrl } from '../../lib/avatar-url';
import { getHeaderTickerItems } from '../../lib/header-ticker';
import { MobileNav } from './mobile-nav';

function EventTicker({
  preferredRegion,
  onMobileOpen,
}: {
  preferredRegion?: AppUser['birthState'];
  onMobileOpen: () => void;
}) {
  const { data: battles } = useCollection<Battle>('battles', [orderBy('createdAt', 'desc')]);
  const { data: qualifierTracks } = useCollection<QualifierTrack>('qualifierTracks', [
    orderBy('registrationDeadline', 'asc'),
  ]);
  const { data: championships } = useCollection<Championship>('championships', [
    orderBy('createdAt', 'desc'),
  ]);
  const tickerItems = useMemo(
    () =>
      getHeaderTickerItems({
        battles,
        qualifierTracks,
        championships,
        limit: 8,
        preferredRegion: preferredRegion ?? null,
      }),
    [battles, championships, preferredRegion, qualifierTracks],
  );

  return (
    <div className="border-b border-white/5 bg-surface-950">
      <div className="flex items-stretch">
        {/* Mobile hamburger — always present so nav is reachable without a header bar */}
        <button
          onClick={onMobileOpen}
          className="relative z-10 flex min-w-[52px] flex-shrink-0 items-center justify-center border-r border-white/5 bg-surface-950 text-surface-300 shadow-[10px_0_24px_rgba(2,6,23,0.45)] transition-colors hover:bg-white/[0.04] hover:text-white lg:hidden"
          aria-label="Menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
          <div className="flex items-stretch">
            {/* Agenda CTA */}
            <Link
              href="/agenda"
              className="flex min-w-[88px] flex-shrink-0 items-center justify-center gap-1.5 border-r border-white/5 px-3 text-[11px] font-semibold text-surface-300 transition-colors hover:bg-white/[0.04] hover:text-white sm:min-w-[104px] sm:px-4"
            >
              Agenda
              <ArrowRight className="h-3 w-3" />
            </Link>

            {tickerItems.map((item) => {
              const isLive = item.badgeVariant === 'success' || item.badgeVariant === 'info';
              return (
                <div
                  key={item.id}
                  className={`group flex min-w-[176px] max-w-[208px] snap-start flex-col justify-between gap-2 border-l-2 border-r border-white/5 px-3 py-2.5 transition-colors hover:bg-white/[0.03] sm:min-w-[208px] sm:max-w-[232px] sm:py-3 ${isLive ? 'border-l-brand-500/50' : 'border-l-transparent'}`}
                >
                  <Link href={item.href} className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={item.badgeVariant} className="text-[10px]">
                        {item.badgeLabel}
                      </Badge>
                      <span className="truncate text-[11px] text-surface-500">{item.statusLabel}</span>
                    </div>
                    <p className="mt-1 truncate text-[13px] font-semibold leading-tight text-white group-hover:text-brand-400 sm:text-sm">
                      {item.title}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-surface-500">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(item.nextAt)}
                    </p>
                  </Link>
                  <Link
                    href={item.actionHref}
                    className="inline-flex h-6 w-fit items-center gap-1 rounded-md bg-white/[0.05] px-2 text-[11px] font-semibold text-surface-400 transition-colors hover:bg-brand-500/15 hover:text-brand-300"
                  >
                    {item.actionLabel}
                    <ArrowRight className="h-2.5 w-2.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const { user, signOut } = useAuth();
  const { data: profile } = useDocument<AppUser>('users', user?.uid);
  const [mobileOpen, setMobileOpen] = useState(false);
  const avatarSrc = getVersionedAvatarUrl(profile?.photoURL, profile?.photoVersion);
  const displayName = profile?.displayName || user?.displayName || 'U';

  return (
    <>
      <div className="sticky top-0 z-40 lg:pl-56">
        <EventTicker
          preferredRegion={user ? profile?.birthState : undefined}
          onMobileOpen={() => setMobileOpen(true)}
        />
      </div>

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

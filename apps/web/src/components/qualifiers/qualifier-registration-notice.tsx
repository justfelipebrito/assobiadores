'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Trophy } from 'lucide-react';
import { limit, useAuth, useCollection, where } from '@batalha/firebase';
import type { QualifierRegistration } from '@batalha/types';
import { shouldShowQualifierRegistrationNotice } from '@/lib/qualifier-notice';

const ACTIVE_QUALIFIER_SEASON_ID = 'season-2026';

export function QualifierRegistrationNotice() {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();

  if (authLoading || !user || pathname.startsWith('/classificatorias')) return null;

  return <QualifierRegistrationNoticeContent userId={user.uid} />;
}

function QualifierRegistrationNoticeContent({ userId }: { userId: string }) {
  const { data: registrations, loading: registrationsLoading } =
    useCollection<QualifierRegistration>('qualifierRegistrations', [
      where('userId', '==', userId),
      where('seasonId', '==', ACTIVE_QUALIFIER_SEASON_ID),
      limit(1),
    ]);

  const shouldShow = shouldShowQualifierRegistrationNotice({
    isAuthenticated: true,
    loading: registrationsLoading,
    registrations,
  });

  if (!shouldShow) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[80] mx-auto max-w-md rounded-2xl border border-brand-500/30 bg-surface-900/95 p-3 shadow-elevated backdrop-blur-xl sm:bottom-4 sm:left-auto sm:right-6 sm:mx-0 sm:p-4">
      <div className="flex items-center gap-3">
        <div className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 min-[380px]:flex">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Classificatórias</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-surface-400 sm:mt-1 sm:text-sm">
            Inscrição por categoria: R$ 4,00. Vencedores avançam aos Regionais.
          </p>
        </div>
          <Link
            href="/classificatorias"
            className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-semibold text-white shadow-glow-sm transition-colors hover:bg-brand-600 sm:text-sm"
          >
            Ver
            <ArrowRight className="h-4 w-4" />
          </Link>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { orderBy, useAuth, useCollection } from '@batalha/firebase';
import { Card, CardContent, Skeleton } from '@batalha/ui';
import { formatCurrency, formatNumber } from '@batalha/utils';
import type { Payment, User } from '@batalha/types';
import { getAdminDashboardMetrics } from './dashboard-metrics';
import {
  formatConversionRate,
  getMaxReferralValue,
  type ReferralAnalyticsResponse,
  type ReferralAnalyticsRow,
} from './dashboard-analytics';
import { getWebApiBaseUrl } from '../lib/web-api';

function MetricCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="border-white/10 bg-white/[0.03] transition-colors hover:border-brand-500/40 hover:bg-brand-500/5">
        <CardContent>
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">{value}</p>
          <p className="mt-2 text-sm text-surface-400">{detail}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function ReferralBar({
  label,
  value,
  max,
  tone = 'brand',
}: {
  label: string;
  value: number;
  max: number;
  tone?: 'brand' | 'green' | 'amber';
}) {
  const width = `${Math.max(4, Math.round((value / max) * 100))}%`;
  const color =
    tone === 'green' ? 'bg-emerald-400' : tone === 'amber' ? 'bg-amber-300' : 'bg-brand-400';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="text-surface-400">{label}</span>
        <span className="font-semibold tabular-nums text-white">{formatNumber(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width }} />
      </div>
    </div>
  );
}

function ReferralRow({ row, max }: { row: ReferralAnalyticsRow; max: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-surface-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{row.partnerName}</h3>
          <p className="mt-1 text-xs text-surface-500">ref={row.ref}</p>
        </div>
        <div className="rounded-md border border-white/10 px-2 py-1 text-xs font-semibold text-surface-300">
          {formatConversionRate(row.conversionRate)}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <ReferralBar label="Visitantes" value={row.visitors} max={max} />
        <ReferralBar
          label="Capturas"
          value={row.referralCaptures}
          max={max}
          tone="amber"
        />
        <ReferralBar
          label="Usuários criados"
          value={row.attributedUsers}
          max={max}
          tone="green"
        />
      </div>
    </div>
  );
}

function AnalyticsPanel({ analytics, loading }: { analytics: ReferralAnalyticsResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
        Nao foi possivel carregar analytics agora.
      </div>
    );
  }

  const max = getMaxReferralValue(analytics.byRef);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
      <div className="rounded-lg border border-white/10 bg-surface-950/70 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">
              Referrals
            </p>
            <h2 className="mt-2 text-lg font-bold text-white">Aquisição por ref</h2>
            <p className="mt-1 text-sm text-surface-400">{analytics.rangeLabel}</p>
          </div>
          <span
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              analytics.available
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                : 'border-amber-300/30 bg-amber-300/10 text-amber-100'
            }`}
          >
            {analytics.available ? 'GA4 ativo' : 'GA4 pendente'}
          </span>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="rounded-lg bg-white/[0.03] p-4">
            <p className="text-xs text-surface-500">Visitantes via ref</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">
              {formatNumber(analytics.totals.visitors)}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-lg bg-white/[0.03] p-4">
              <p className="text-xs text-surface-500">Capturas validas</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                {formatNumber(analytics.totals.referralCaptures)}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-4">
              <p className="text-xs text-surface-500">Usuarios atribuidos</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                {formatNumber(analytics.totals.attributedUsers)}
              </p>
            </div>
          </div>
        </div>

        {analytics.unavailableReason && (
          <p className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
            {analytics.unavailableReason}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {analytics.byRef.map((row) => (
          <ReferralRow key={row.ref} row={row} max={max} />
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user: adminUser } = useAuth();
  const { data: users, loading: usersLoading } = useCollection<User>('users', [
    orderBy('createdAt', 'desc'),
  ]);
  const { data: payments, loading: paymentsLoading } = useCollection<Payment>('payments', [
    orderBy('createdAt', 'desc'),
  ]);
  const [analytics, setAnalytics] = useState<ReferralAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const loading = usersLoading || paymentsLoading;
  const metrics = getAdminDashboardMetrics(users, payments);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      if (!adminUser) {
        setAnalyticsLoading(false);
        return;
      }

      setAnalyticsLoading(true);
      try {
        const token = await adminUser.getIdToken();
        const response = await fetch(`${getWebApiBaseUrl()}/api/admin/analytics/referrals`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Erro ao carregar analytics');
        if (!cancelled) setAnalytics(body);
      } catch {
        if (!cancelled) setAnalytics(null);
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    }

    loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [adminUser]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">
            Operação
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-surface-400">
            Visão operacional de contas, inscrições pagas e receita confirmada.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Usuários"
            value={formatNumber(metrics.totalUsers)}
            detail="Total de perfis cadastrados"
            href="/usuarios"
          />
          <MetricCard
            label="Novos Usuários"
            value={formatNumber(metrics.newUsers)}
            detail="Esta semana"
            href="/usuarios"
          />
          <MetricCard
            label="Inscrições Pagas"
            value={formatNumber(metrics.paidEntries)}
            detail="Inscrições com Pix aprovado"
            href="/pagamentos"
          />
          <MetricCard
            label="Receita confirmada"
            value={formatCurrency(metrics.totalRevenue)}
            detail="Volume bruto aprovado"
            href="/pagamentos"
          />
        </div>
      )}

      <section className="mt-10">
        <AnalyticsPanel analytics={analytics} loading={analyticsLoading} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-surface-500">Acessos rapidos</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              title: 'Batalhas',
              description: 'Gerenciar batalhas, inscrições, envios e finalizações.',
              href: '/batalhas',
            },
            {
              title: 'Classificatórias',
              description: 'Gerar chaves, acompanhar rodadas e operar o caminho oficial.',
              href: '/classificatorias',
            },
            {
              title: 'Campeonatos',
              description: 'Configurar eventos, fases, partidas e resultados.',
              href: '/campeonatos',
            },
            {
              title: 'Moderação',
              description: 'Revisar denúncias e remover envios fora da regra.',
              href: '/moderacao',
            },
            {
              title: 'Usuários',
              description: 'Consultar contas, perfis, planos e papéis administrativos.',
              href: '/usuarios',
            },
            {
              title: 'Configurações',
              description: 'Controlar mensagens e avisos exibidos na homepage.',
              href: '/configuracoes',
            },
          ].map(({ title, description, href }) => (
            <Link key={href} href={href}>
              <div className="h-full rounded-lg border border-white/10 bg-surface-950/70 p-4 transition-colors hover:border-white/20 hover:bg-white/[0.04]">
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-surface-400">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

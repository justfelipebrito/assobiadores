'use client';

import Link from 'next/link';
import { orderBy, useCollection } from '@batalha/firebase';
import { Card, CardContent, Skeleton } from '@batalha/ui';
import { formatCurrency, formatNumber } from '@batalha/utils';
import type { Payment, User } from '@batalha/types';
import { getAdminDashboardMetrics } from './dashboard-metrics';

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

export default function AdminDashboard() {
  const { data: users, loading: usersLoading } = useCollection<User>('users', [
    orderBy('createdAt', 'desc'),
  ]);
  const { data: payments, loading: paymentsLoading } = useCollection<Payment>('payments', [
    orderBy('createdAt', 'desc'),
  ]);
  const loading = usersLoading || paymentsLoading;
  const metrics = getAdminDashboardMetrics(users, payments);

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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-surface-500">
          Áreas de operação
        </h2>
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

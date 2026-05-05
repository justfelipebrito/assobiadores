'use client';

import { orderBy, useCollection } from '@batalha/firebase';
import { Badge, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import { formatCurrency, formatDate, toDate } from '@batalha/utils';
import type { Payment } from '@batalha/types';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  refunded: 'Estornado',
};

function getStatusVariant(status: string) {
  if (status === 'approved') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'rejected' || status === 'refunded') return 'danger';
  return 'default';
}

function getTargetLabel(payment: Payment) {
  if (payment.targetType === 'qualifier_registration') return 'Classificatoria';
  if (payment.targetType === 'battle_entry') return 'Batalha';
  return payment.targetType;
}

export default function PaymentsPage() {
  const { data: payments, loading } = useCollection<Payment>('payments', [
    orderBy('createdAt', 'desc'),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pagamentos</h1>
          <p className="mt-1 text-surface-400">Pix e inscrições processadas pelo Mercado Pago.</p>
        </div>
        <p className="text-sm text-surface-500">
          {payments.length} pagamento{payments.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            title="Nenhum pagamento"
            description="Os pagamentos aparecerao aqui quando usuarios entrarem em batalhas pagas ou Classificatorias."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                        Pagamento
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                        Destino
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500">
                        Criado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payments.map((payment) => {
                      const createdAt = toDate(payment.createdAt);
                      return (
                        <tr key={payment.id} className="transition-colors hover:bg-white/[0.02]">
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs text-white">{payment.id}</p>
                            <p className="mt-1 text-xs text-surface-500">{payment.provider}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={getStatusVariant(payment.status) as 'default'}>
                              {STATUS_LABELS[payment.status] ?? payment.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-surface-200">
                              {getTargetLabel(payment)}
                            </p>
                            <p className="mt-1 font-mono text-xs text-surface-500">
                              {payment.targetId}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-white">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-4 py-3 text-right text-surface-400">
                            {createdAt ? formatDate(createdAt) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

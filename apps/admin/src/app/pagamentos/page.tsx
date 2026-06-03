'use client';

import { useMemo, useState } from 'react';
import { orderBy, useCollectionOnce } from '@batalha/firebase';
import { Badge, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import { formatCurrency, formatDate, toDate } from '@batalha/utils';
import type { Payment } from '@batalha/types';
import { SortableTableHeader } from '../../components/sortable-table-header';
import { getNextSortState, sortRows, type SortState } from '../../components/sortable-table';

type PaymentSortKey = 'payment' | 'status' | 'target' | 'amount' | 'createdAt';

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

const PAYMENT_SORT_SELECTORS = {
  payment: (payment: Payment) => payment.id,
  status: (payment: Payment) => payment.status,
  target: (payment: Payment) => getTargetLabel(payment),
  amount: (payment: Payment) => payment.amount,
  createdAt: (payment: Payment) => payment.createdAt,
};

export default function PaymentsPage() {
  const [sort, setSort] = useState<SortState<PaymentSortKey>>({
    key: 'createdAt',
    direction: 'desc',
  });
  const { data: payments, loading } = useCollectionOnce<Payment>('payments', [
    orderBy('createdAt', 'desc'),
  ]);
  const sortedPayments = useMemo(
    () => sortRows(payments, sort, PAYMENT_SORT_SELECTORS),
    [payments, sort],
  );

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
                      <SortableTableHeader
                        label="Pagamento"
                        active={sort.key === 'payment'}
                        direction={sort.direction}
                        onClick={() => setSort((current) => getNextSortState(current, 'payment'))}
                      />
                      <SortableTableHeader
                        label="Status"
                        active={sort.key === 'status'}
                        direction={sort.direction}
                        onClick={() => setSort((current) => getNextSortState(current, 'status'))}
                      />
                      <SortableTableHeader
                        label="Destino"
                        active={sort.key === 'target'}
                        direction={sort.direction}
                        onClick={() => setSort((current) => getNextSortState(current, 'target'))}
                      />
                      <SortableTableHeader
                        label="Valor"
                        active={sort.key === 'amount'}
                        direction={sort.direction}
                        align="right"
                        onClick={() => setSort((current) => getNextSortState(current, 'amount'))}
                      />
                      <SortableTableHeader
                        label="Criado"
                        active={sort.key === 'createdAt'}
                        direction={sort.direction}
                        align="right"
                        onClick={() =>
                          setSort((current) => getNextSortState(current, 'createdAt'))
                        }
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedPayments.map((payment) => {
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

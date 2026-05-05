'use client';

import { orderBy, useCollection } from '@batalha/firebase';
import { Badge, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import { formatNumber } from '@batalha/utils';
import type { User } from '@batalha/types';

function getRoleVariant(role: string) {
  if (role === 'admin') return 'gold';
  if (role === 'judge') return 'purple';
  return 'default';
}

export default function UsersPage() {
  const { data: users, loading } = useCollection<User>('users', [orderBy('createdAt', 'desc')]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="mt-1 text-surface-400">Perfis públicos cadastrados na plataforma.</p>
        </div>
        <p className="text-sm text-surface-500">
          {users.length} usuario{users.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="Nenhum usuario"
            description="Os usuarios aparecerao aqui apos o cadastro."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                        Usuario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                        Conta
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                        Naturalidade
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500">
                        Pontos
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((user) => (
                      <tr key={user.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {user.photoURL ? (
                              <img
                                src={user.photoURL}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-200">
                                {(user.displayName || user.email || '?').slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">{user.displayName}</p>
                              <p className="truncate text-xs text-surface-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={getRoleVariant(user.role) as 'default'}>
                              {user.role}
                            </Badge>
                            <Badge variant="default">{user.plan}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-surface-300">{user.birthState ?? '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                          {formatNumber(user.points ?? 0)}
                        </td>
                      </tr>
                    ))}
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

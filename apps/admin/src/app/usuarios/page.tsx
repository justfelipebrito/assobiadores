'use client';

import { useEffect, useMemo, useState } from 'react';
import { orderBy, useAuth, useCollection } from '@batalha/firebase';
import { Badge, Button, Card, CardContent, EmptyState, Input, Skeleton, Textarea } from '@batalha/ui';
import { formatNumber } from '@batalha/utils';
import type { User } from '@batalha/types';
import { toast } from 'sonner';
import { getWebApiBaseUrl } from '../../lib/web-api';
import { SortableTableHeader } from '../../components/sortable-table-header';
import { getNextSortState, sortRows, type SortState } from '../../components/sortable-table';

type UserSortKey = 'user' | 'account' | 'birthState' | 'points';

const USER_SORT_SELECTORS = {
  user: (user: User) => user.displayName || user.email || '',
  account: (user: User) => `${user.role} ${user.plan}`,
  birthState: (user: User) => user.birthState ?? '',
  points: (user: User) => user.points ?? 0,
};

function getRoleVariant(role: string) {
  if (role === 'admin') return 'gold';
  if (role === 'judge') return 'purple';
  return 'default';
}

function UserEditModal({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const { user: adminUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    username: user.username ?? '',
    firstName: user.firstName ?? '',
    surname: user.surname ?? '',
    displayName: user.displayName ?? '',
    bio: user.bio ?? '',
  });

  const setValue = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const save = async () => {
    if (!adminUser) {
      toast.error('Entre como admin para editar usuarios.');
      return;
    }

    setSaving(true);
    try {
      const token = await adminUser.getIdToken();
      const baseURL = getWebApiBaseUrl();
      const response = await fetch(`${baseURL}/api/admin/users/${user.id}/profile`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar usuario');
      toast.success('Usuario atualizado.');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-surface-950 shadow-2xl sm:max-w-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">
                Editando usuário
              </p>
              <h2 id="edit-user-title" className="mt-1 truncate text-lg font-bold text-white">
                {user.displayName}
              </h2>
              <p className="truncate text-sm text-surface-500">{user.email}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Username"
              value={values.username}
              onChange={(event) => setValue('username', event.target.value)}
            />
            <Input
              label="Nome de exibição"
              value={values.displayName}
              onChange={(event) => setValue('displayName', event.target.value)}
            />
            <Input
              label="Nome"
              value={values.firstName}
              onChange={(event) => setValue('firstName', event.target.value)}
            />
            <Input
              label="Sobrenome"
              value={values.surname}
              onChange={(event) => setValue('surname', event.target.value)}
            />
          </div>

          <div className="mt-4">
            <Textarea
              label="Bio"
              value={values.bio}
              onChange={(event) => setValue('bio', event.target.value)}
            />
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Salvar correções
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [sort, setSort] = useState<SortState<UserSortKey>>({
    key: 'user',
    direction: 'asc',
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { data: users, loading } = useCollection<User>('users', [orderBy('createdAt', 'desc')]);
  const sortedUsers = useMemo(
    () => sortRows(users, sort, USER_SORT_SELECTORS),
    [sort, users],
  );

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

      {selectedUser && <UserEditModal user={selectedUser} onClose={() => setSelectedUser(null)} />}

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
                      <SortableTableHeader
                        label="Usuario"
                        active={sort.key === 'user'}
                        direction={sort.direction}
                        onClick={() => setSort((current) => getNextSortState(current, 'user'))}
                      />
                      <SortableTableHeader
                        label="Conta"
                        active={sort.key === 'account'}
                        direction={sort.direction}
                        onClick={() => setSort((current) => getNextSortState(current, 'account'))}
                      />
                      <SortableTableHeader
                        label="Naturalidade"
                        active={sort.key === 'birthState'}
                        direction={sort.direction}
                        onClick={() =>
                          setSort((current) => getNextSortState(current, 'birthState'))
                        }
                      />
                      <SortableTableHeader
                        label="Pontos"
                        active={sort.key === 'points'}
                        direction={sort.direction}
                        align="right"
                        onClick={() => setSort((current) => getNextSortState(current, 'points'))}
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedUsers.map((user) => (
                      <tr
                        key={user.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedUser(user)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedUser(user);
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-white/[0.04] focus:bg-white/[0.04] focus:outline-none"
                      >
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

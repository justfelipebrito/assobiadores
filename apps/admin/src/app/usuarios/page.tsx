import { EmptyState } from '@batalha/ui';

export default function UsersPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
      <div className="mt-8">
        <EmptyState title="Nenhum usuario" description="Os usuarios aparecerão aqui apos o cadastro." />
      </div>
    </main>
  );
}

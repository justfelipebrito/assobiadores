import { EmptyState } from '@batalha/ui';

export default function AdminBattlesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Batalhas</h1>
      </div>
      <div className="mt-8">
        <EmptyState
          title="Nenhuma batalha criada"
          description="Crie a primeira batalha para comecar."
        />
      </div>
    </main>
  );
}

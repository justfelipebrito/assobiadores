import { EmptyState } from '@batalha/ui';

export default function ModerationPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Moderacao</h1>
      <div className="mt-8">
        <EmptyState
          title="Nenhuma submissao pendente"
          description="Todas as submissoes foram revisadas."
        />
      </div>
    </main>
  );
}

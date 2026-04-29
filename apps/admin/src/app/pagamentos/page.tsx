import { EmptyState } from '@batalha/ui';

export default function PaymentsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
      <div className="mt-8">
        <EmptyState
          title="Nenhum pagamento"
          description="Os pagamentos aparecerão aqui quando os usuarios se inscreverem em batalhas pagas."
        />
      </div>
    </main>
  );
}

'use client';

import { Button } from '@batalha/ui';
import { RefreshCw } from 'lucide-react';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
        <span className="text-3xl">!</span>
      </div>
      <h2 className="text-xl font-bold text-white">Algo deu errado</h2>
      <p className="mt-2 max-w-md text-surface-400">
        Ocorreu um erro inesperado. Tente novamente ou volte mais tarde.
      </p>
      <Button onClick={reset} variant="secondary" className="mt-8">
        <RefreshCw className="mr-2 h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  );
}

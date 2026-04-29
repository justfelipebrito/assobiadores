import Link from 'next/link';
import { Button } from '@batalha/ui';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-8xl font-black text-white/5">404</p>
      <h2 className="mt-4 text-xl font-bold text-white">Pagina nao encontrada</h2>
      <p className="mt-2 text-surface-400">A pagina que voce procura nao existe ou foi movida.</p>
      <Link href="/" className="mt-8">
        <Button variant="secondary">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao inicio
        </Button>
      </Link>
    </div>
  );
}

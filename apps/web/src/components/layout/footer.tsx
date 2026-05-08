import Link from 'next/link';
import { LEGAL_PAGES } from '@/lib/legal-pages';

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface-950">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="A casa do assobiador"
                className="h-9 w-9 rounded-xl object-contain"
              />
              <span className="text-lg font-bold text-white">Assobiador</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-surface-500">
              Competições, rankings e destaques de assobio no Brasil.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
              Plataforma
            </h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/batalhas"
                  className="text-sm text-surface-500 transition-colors hover:text-white"
                >
                  Batalhas
                </Link>
              </li>
              <li>
                <Link
                  href="/ranking"
                  className="text-sm text-surface-500 transition-colors hover:text-white"
                >
                  Ranking
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
              Conta
            </h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/entrar"
                  className="text-sm text-surface-500 transition-colors hover:text-white"
                >
                  Entrar
                </Link>
              </li>
              <li>
                <Link
                  href="/cadastro"
                  className="text-sm text-surface-500 transition-colors hover:text-white"
                >
                  Criar conta
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
              Legal
            </h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href={LEGAL_PAGES.terms.href}
                  className="text-sm text-surface-500 transition-colors hover:text-white"
                >
                  Termos de uso
                </Link>
              </li>
              <li>
                <Link
                  href={LEGAL_PAGES.privacy.href}
                  className="text-sm text-surface-500 transition-colors hover:text-white"
                >
                  Privacidade
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/5 pt-8 text-center">
          <p className="text-sm text-surface-600">
            &copy; {new Date().getFullYear()} Assobiador. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

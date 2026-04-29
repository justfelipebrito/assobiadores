import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface-950">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-lg font-bold text-white">
                A
              </div>
              <span className="text-lg font-bold text-white">Assobiador</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-surface-500">
              A plataforma de competicao de assobio mais divertida do Brasil.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
              Plataforma
            </h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/batalhas" className="text-sm text-surface-500 transition-colors hover:text-white">
                  Batalhas
                </Link>
              </li>
              <li>
                <Link href="/ranking" className="text-sm text-surface-500 transition-colors hover:text-white">
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
                <Link href="/entrar" className="text-sm text-surface-500 transition-colors hover:text-white">
                  Entrar
                </Link>
              </li>
              <li>
                <Link href="/cadastro" className="text-sm text-surface-500 transition-colors hover:text-white">
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
                <span className="text-sm text-surface-600">Termos de uso</span>
              </li>
              <li>
                <span className="text-sm text-surface-600">Privacidade</span>
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

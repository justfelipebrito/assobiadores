import Link from 'next/link';
import { Card, CardContent } from '@batalha/ui';

export default function AdminDashboard() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
      <p className="mt-1 text-surface-400">Gerencie A casa do assobiador</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/batalhas">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-white">Batalhas</h3>
              <p className="mt-1 text-sm text-surface-400">Gerenciar e finalizar batalhas</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/campeonatos">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-white">Campeonatos</h3>
              <p className="mt-1 text-sm text-surface-400">
                Campeonatos oficiais, fases e partidas
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/classificatorias">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-white">Classificatórias</h3>
              <p className="mt-1 text-sm text-surface-400">
                Inscrições, sorteios e rodadas oficiais
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/moderacao">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-white">Moderacao</h3>
              <p className="mt-1 text-sm text-surface-400">Denuncias e remocao de envios</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/usuarios">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-white">Usuarios</h3>
              <p className="mt-1 text-sm text-surface-400">Gerenciar usuarios</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/pagamentos">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-white">Pagamentos</h3>
              <p className="mt-1 text-sm text-surface-400">Acompanhar pagamentos</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/configuracoes">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-white">Configurações</h3>
              <p className="mt-1 text-sm text-surface-400">Mensagens e avisos da homepage</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}

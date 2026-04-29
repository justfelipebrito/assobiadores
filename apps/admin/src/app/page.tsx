import Link from 'next/link';
import { Card, CardContent } from '@batalha/ui';

export default function AdminDashboard() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
      <p className="mt-1 text-gray-600">Gerencie a plataforma Batalha de Assobio</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/batalhas">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-gray-900">Batalhas</h3>
              <p className="mt-1 text-sm text-gray-600">Criar e gerenciar batalhas</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/moderacao">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-gray-900">Moderacao</h3>
              <p className="mt-1 text-sm text-gray-600">Aprovar submissoes</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/usuarios">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-gray-900">Usuarios</h3>
              <p className="mt-1 text-sm text-gray-600">Gerenciar usuarios</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/pagamentos">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent>
              <h3 className="font-semibold text-gray-900">Pagamentos</h3>
              <p className="mt-1 text-sm text-gray-600">Acompanhar pagamentos</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}

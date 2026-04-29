'use client';

import { Button, Card, CardContent } from '@batalha/ui';
import { useAuth } from '@batalha/firebase';

export default function AdminLoginPage() {
  const { signInWithGoogle, loading, error } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 text-center">
          <h1 className="text-xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-600">Acesso restrito a administradores</p>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={signInWithGoogle}
            loading={loading}
          >
            Entrar com Google
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, Input } from '@batalha/ui';
import { useAuth } from '@batalha/firebase';

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, signInWithGoogle, signInWithEmail, loading, error } = useAuth();
  const usesEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
  const [email, setEmail] = useState(usesEmulator ? 'admin@example.test' : '');
  const [password, setPassword] = useState(usesEmulator ? 'password123' : '');
  const [submittingEmail, setSubmittingEmail] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [router, user]);

  async function submitEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingEmail(true);
    try {
      const signedInUser = await signInWithEmail(email.trim(), password);
      if (signedInUser) {
        router.replace('/');
      }
    } finally {
      setSubmittingEmail(false);
    }
  }

  async function submitGoogleLogin() {
    const signedInUser = await signInWithGoogle();
    if (signedInUser) {
      router.replace('/');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5">
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Admin</h1>
            <p className="mt-1 text-sm text-surface-400">Acesso restrito a administradores</p>
          </div>

          <form className="space-y-4" onSubmit={submitEmailLogin}>
            <Input
              label="Email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              label="Senha"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Button type="submit" size="lg" className="w-full" loading={submittingEmail}>
              Entrar com email
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-semibold uppercase tracking-wide text-surface-500">
              ou
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={submitGoogleLogin}
            loading={loading}
          >
            Entrar com Google
          </Button>
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}

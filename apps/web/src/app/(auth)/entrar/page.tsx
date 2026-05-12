'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, CardContent } from '@batalha/ui';
import { useAuth } from '@batalha/firebase';
import { Music, Mail } from 'lucide-react';
import {
  trackAuthAttempt,
  trackAuthCtaClick,
  trackReferralBootstrap,
} from '@/lib/analytics-events';
import {
  clearStoredReferralAttribution,
  getStoredReferralAttribution,
} from '@/lib/referral-attribution';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithGoogle, signInWithApple, signInWithEmail, loading, error, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [authActionLoading, setAuthActionLoading] = useState(false);

  const bootstrapUser = async (authUser: Awaited<ReturnType<typeof signInWithEmail>>) => {
    if (!authUser) return false;
    const token = await authUser.getIdToken(true);
    const referralAttribution = getStoredReferralAttribution();
    const res = await fetch('/api/auth/bootstrap', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
        referralAttribution,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao preparar perfil');
    if (referralAttribution) {
      trackReferralBootstrap({ referral: referralAttribution, created: Boolean(data.created) });
      clearStoredReferralAttribution();
    }
    return true;
  };

  useEffect(() => {
    let cancelled = false;

    if (user) {
      setAuthActionLoading(true);
      bootstrapUser(user)
        .then(() => {
          if (!cancelled) router.push('/');
        })
        .catch((err) => {
          if (!cancelled) {
            setLocalError(err instanceof Error ? err.message : 'Erro ao preparar perfil');
          }
        })
        .finally(() => {
          if (!cancelled) setAuthActionLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [router, user]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    trackAuthAttempt({ action: 'login', method: 'email' });
    setLocalError(null);
    setAuthActionLoading(true);
    try {
      const signedUser = await signInWithEmail(email, password);
      if (!signedUser) return;
      await bootstrapUser(signedUser);
      router.push('/');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Erro ao preparar perfil');
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    trackAuthAttempt({ action: 'login', method: provider });
    setLocalError(null);
    setAuthActionLoading(true);
    try {
      const signedUser = provider === 'google' ? await signInWithGoogle() : await signInWithApple();
      if (!signedUser) return;
      await bootstrapUser(signedUser);
      router.push('/');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Erro ao preparar perfil');
    } finally {
      setAuthActionLoading(false);
    }
  };

  if (user) return null;

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,169,114,0.08)_0%,_transparent_50%)]" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-glow">
            <Music className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Bem-vindo de volta</h1>
          <p className="mt-2 text-surface-400">Entre para continuar participando das batalhas</p>
        </div>

        <Card>
          <CardContent className="space-y-6">
            {/* Google button */}
            <Button
              variant="secondary"
              size="lg"
              className="w-full gap-3"
              onClick={() => handleSocialSignIn('google')}
              loading={loading || authActionLoading}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Entrar com Google
            </Button>

            {/* Apple button */}
            <Button
              variant="secondary"
              size="lg"
              className="w-full gap-3"
              onClick={() => handleSocialSignIn('apple')}
              loading={loading || authActionLoading}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Entrar com Apple
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface-900 px-4 text-sm text-surface-500">ou</span>
              </div>
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Senha"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {(error || localError) && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {localError || error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={loading || authActionLoading}
              >
                <Mail className="mr-2 h-4 w-4" />
                Entrar com email
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-surface-500">
          Nao tem uma conta?{' '}
          <Link
            href="/cadastro"
            onClick={() => trackAuthCtaClick({ action: 'signup', location: 'login_page' })}
            className="font-semibold text-brand-400 transition-colors hover:text-brand-300"
          >
            Cadastre-se gratis
          </Link>
        </p>
      </div>
    </div>
  );
}

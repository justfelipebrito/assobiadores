'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getClientAuth, shouldUseEmulators } from './client';
import { shouldFallbackToRedirect } from './auth-errors';

export interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const auth = getClientAuth();
    void getRedirectResult(auth).catch((err) => {
      const message = err instanceof Error ? err.message : 'Erro ao concluir login social';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, loading: false, error: null });
        return;
      }

      if (shouldUseEmulators()) {
        try {
          await user.getIdToken(true);
        } catch {
          await firebaseSignOut(auth);
          setState({ user: null, loading: false, error: null });
          return;
        }
      }

      setState({ user, loading: false, error: null });
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const auth = getClientAuth();
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      return user;
    } catch (err) {
      if (shouldFallbackToRedirect(err)) {
        const auth = getClientAuth();
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
        return null;
      }
      const message = err instanceof Error ? err.message : 'Erro ao entrar com Google';
      setState((prev) => ({ ...prev, error: message }));
      return null;
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const auth = getClientAuth();
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      const { user } = await signInWithPopup(auth, provider);
      return user;
    } catch (err) {
      if (shouldFallbackToRedirect(err)) {
        const auth = getClientAuth();
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        await signInWithRedirect(auth, provider);
        return null;
      }
      const message = err instanceof Error ? err.message : 'Erro ao entrar com Apple';
      setState((prev) => ({ ...prev, error: message }));
      return null;
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const auth = getClientAuth();
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email ou senha incorretos';
      setState((prev) => ({ ...prev, error: message }));
      return null;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const auth = getClientAuth();
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName });
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta';
      setState((prev) => ({ ...prev, error: message }));
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const auth = getClientAuth();
      await firebaseSignOut(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao sair';
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  return useMemo(
    () => ({
      ...state,
      signInWithGoogle,
      signInWithApple,
      signInWithEmail,
      signUp,
      signOut,
    }),
    [state, signInWithGoogle, signInWithApple, signInWithEmail, signUp, signOut],
  );
}

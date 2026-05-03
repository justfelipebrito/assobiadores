'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getClientAuth, shouldUseEmulators } from './client';

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
      await signInWithPopup(auth, provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar com Google';
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const auth = getClientAuth();
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      await signInWithPopup(auth, provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar com Apple';
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email ou senha incorretos';
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const auth = getClientAuth();
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta';
      setState((prev) => ({ ...prev, error: message }));
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

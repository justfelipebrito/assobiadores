'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Camera } from 'lucide-react';
import { useAuth, useDocument, getClientFirestore, doc, updateDoc, serverTimestamp } from '@batalha/firebase';
import { Button, Input, Textarea, Card, CardContent, Avatar, Skeleton } from '@batalha/ui';
import { toast } from 'sonner';
import type { User } from '@batalha/types';

export default function MyProfilePage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const { data: profile, loading: profileLoading } = useDocument<User>(
    'users',
    authUser?.uid,
  );

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form when profile loads
  if (profile && !initialized) {
    setDisplayName(profile.displayName);
    setBio(profile.bio || '');
    setInitialized(true);
  }

  if (authLoading || profileLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="h-12 w-48 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!authUser) {
    router.push('/entrar');
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    setSaving(true);
    try {
      const db = getClientFirestore();
      const userRef = doc(db, 'users', authUser.uid);
      await updateDoc(userRef, {
        displayName,
        bio,
        updatedAt: serverTimestamp(),
      });
      toast.success('Perfil atualizado!');
    } catch {
      toast.error('Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>
      <p className="mt-1 text-surface-400">Gerencie suas informacoes pessoais</p>

      <form onSubmit={handleSave} className="mt-8">
        <Card>
          <CardContent className="space-y-8">
            {/* Avatar section */}
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative">
                <Avatar
                  src={authUser.photoURL}
                  name={displayName || 'U'}
                  size="xl"
                  ring
                />
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-950 bg-surface-800 text-surface-400">
                  <Camera className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-center sm:text-left">
                <p className="font-medium text-white">{authUser.email}</p>
                <p className="text-sm text-surface-500">
                  Foto atualizada via provedor de login
                </p>
              </div>
            </div>

            {/* Form fields */}
            <Input
              label="Nome de exibicao"
              type="text"
              placeholder="Como voce quer ser chamado"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />

            <Textarea
              label="Bio"
              placeholder="Conte um pouco sobre voce e seu assobio..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              helperText={`${bio.length}/280 caracteres`}
            />

            {/* Save */}
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving}>
                <Save className="mr-2 h-4 w-4" />
                Salvar alteracoes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

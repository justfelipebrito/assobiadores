'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Camera, Swords, Check, X } from 'lucide-react';
import { useAuth, useDocument, useCollection, where, getClientFirestore, doc, updateDoc, serverTimestamp } from '@batalha/firebase';
import { Button, Input, Textarea, Card, CardContent, Avatar, Skeleton, Badge } from '@batalha/ui';
import { toast } from 'sonner';
import Link from 'next/link';
import type { User, BattleInvite } from '@batalha/types';

function PendingInvites({ userId }: { userId: string }) {
  const { data: invites, loading } = useCollection<BattleInvite & { battleTitle?: string; fromDisplayName?: string }>(
    'battleInvites',
    [where('toUserId', '==', userId), where('status', '==', 'pending')],
  );
  const [responding, setResponding] = useState<string | null>(null);

  const respond = async (inviteId: string, accept: boolean) => {
    setResponding(inviteId);
    try {
      const { getClientAuth } = await import('@batalha/firebase');
      const token = await getClientAuth().currentUser?.getIdToken();
      const res = await fetch(`/api/invites/${inviteId}/respond`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ accept }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao responder convite');
      }
      toast.success(accept ? 'Convite aceito!' : 'Convite recusado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao responder convite');
    } finally {
      setResponding(null);
    }
  };

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!invites.length) return null;

  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-4 w-4 text-brand-400" />
          <h2 className="text-sm font-semibold text-white">Convites pendentes</h2>
          <Badge variant="warning">{invites.length}</Badge>
        </div>
        <div className="space-y-3">
          {invites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/batalhas/${invite.battleId}`} className="truncate text-sm font-medium text-white hover:text-brand-400 transition-colors">
                  {(invite as { battleTitle?: string }).battleTitle ?? 'Batalha'}
                </Link>
                <p className="mt-0.5 text-xs text-surface-500">
                  Convidado por {(invite as { fromDisplayName?: string }).fromDisplayName ?? 'um usuário'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  loading={responding === invite.id}
                  onClick={() => respond(invite.id, false)}
                  className="text-surface-400 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  loading={responding === invite.id}
                  onClick={() => respond(invite.id, true)}
                >
                  <Check className="h-4 w-4" />
                  Aceitar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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

      <div className="mt-8 space-y-6">
        <PendingInvites userId={authUser.uid} />

      <form onSubmit={handleSave}>
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
    </div>
  );
}

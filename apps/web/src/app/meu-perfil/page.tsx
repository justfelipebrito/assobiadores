'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Camera, Swords, Check, X, AlertTriangle } from 'lucide-react';
import { useAuth, useDocument, useCollection, where } from '@batalha/firebase';
import { Button, Input, Textarea, Card, CardContent, Avatar, Skeleton, Badge } from '@batalha/ui';
import { toast } from 'sonner';
import Link from 'next/link';
import type { BrazilState, User, UserPrivateProfile, BattleInvite } from '@batalha/types';
import { compressAvatarImage } from '../../lib/avatar-upload';
import { getVersionedAvatarUrl } from '../../lib/avatar-url';
import {
  hasProfileValidationErrors,
  type ProfileValidationErrors,
  validateOfficialProfileFields,
} from '../../lib/profile-validation';
import { USERNAME_CHECK_COLUMN_CLASS, USERNAME_CONTROL_HEIGHT_CLASS } from './profile-form-layout';

const BRAZIL_STATES: { value: BrazilState; label: string }[] = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return null;
}

function PendingInvites({ userId }: { userId: string }) {
  const { data: invites, loading } = useCollection<
    BattleInvite & { battleTitle?: string; fromDisplayName?: string }
  >('battleInvites', [where('toUserId', '==', userId), where('status', '==', 'pending')]);
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
            <div
              key={invite.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/batalhas/${invite.battleId}`}
                  className="truncate text-sm font-medium text-white hover:text-brand-400 transition-colors"
                >
                  {(invite as { battleTitle?: string }).battleTitle ?? 'Batalha'}
                </Link>
                <p className="mt-0.5 text-xs text-surface-500">
                  Convidado por{' '}
                  {(invite as { fromDisplayName?: string }).fromDisplayName ?? 'um usuário'}
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
  const { data: profile, loading: profileLoading } = useDocument<User>('users', authUser?.uid);
  const { data: privateProfile, loading: privateLoading } = useDocument<UserPrivateProfile>(
    'userPrivate',
    authUser?.uid,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [birthState, setBirthState] = useState<BrazilState | ''>('');
  const [postalCode, setPostalCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [validationErrors, setValidationErrors] = useState<ProfileValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (profile && !initialized) {
      setUsername(profile.username || '');
      setFirstName(profile.firstName || '');
      setSurname(profile.surname || '');
      setDisplayName(profile.displayName);
      setBirthState(profile.birthState || '');
      setBio(profile.bio || '');
      setInitialized(true);
    }
  }, [initialized, profile]);

  useEffect(() => {
    if (privateProfile) {
      setCpf(privateProfile.cpf || '');
      setPhone(privateProfile.phone || '');
      setPixKey(privateProfile.pixKey || '');
      setPostalCode(privateProfile.address?.postalCode || '');
      setStreet(privateProfile.address?.street || '');
      setNumber(privateProfile.address?.number || '');
      setAddressCity(privateProfile.address?.city || '');
    }
  }, [privateProfile]);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/entrar');
    }
  }, [authLoading, authUser, router]);

  if (authLoading || profileLoading || privateLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="h-12 w-48 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!authUser) {
    return null;
  }

  const checkUsername = async () => {
    if (!authUser) return false;
    if (usernameLocked) return true;
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setUsernameStatus('invalid');
      return false;
    }

    setUsernameStatus('checking');
    try {
      const token = await authUser.getIdToken();
      const res = await fetch(`/api/profile/username?username=${encodeURIComponent(trimmed)}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao verificar username');
      setUsernameStatus(data.available ? 'available' : 'taken');
      setUsername(data.username || trimmed);
      return Boolean(data.available);
    } catch (err) {
      setUsernameStatus('idle');
      toast.error(err instanceof Error ? err.message : 'Erro ao verificar username');
      return false;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    setSaving(true);
    try {
      const nextValidationErrors = validateOfficialProfileFields({
        cpf,
        phone,
        pixKey,
        address: {
          postalCode,
          street,
          number,
          city: addressCity,
        },
      });
      setValidationErrors(nextValidationErrors);
      if (hasProfileValidationErrors(nextValidationErrors)) {
        throw new Error('Revise os campos destacados antes de salvar.');
      }
      if (!profile?.birthState && !birthState) {
        throw new Error('Selecione sua naturalidade para finalizar o perfil.');
      }
      if (!privateProfile?.pixKey && !pixKey.trim()) {
        throw new Error('Informe sua Chave Pix para finalizar o perfil.');
      }

      const isUsernameAvailable = await checkUsername();
      if (!isUsernameAvailable) {
        throw new Error('Escolha um username disponivel antes de salvar');
      }

      const token = await authUser.getIdToken();
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username,
          firstName,
          surname,
          displayName,
          bio,
          birthState: birthState || null,
          cpf,
          phone,
          pixKey,
          address: {
            postalCode,
            street,
            number,
            city: addressCity,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar perfil');
      toast.success('Perfil atualizado!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const photoChangeAvailableAt = toDate(profile?.photoChangeAvailableAt);
  const photoLocked = Boolean(photoChangeAvailableAt && photoChangeAvailableAt > new Date());
  const photoLockText = photoChangeAvailableAt
    ? photoChangeAvailableAt.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
  const avatarSrc = getVersionedAvatarUrl(profile?.photoURL, profile?.photoVersion);
  const usernameChangeAvailableAt = toDate(profile?.usernameChangeAvailableAt);
  const usernameLocked = Boolean(
    usernameChangeAvailableAt && usernameChangeAvailableAt > new Date(),
  );
  const usernameLockText = usernameChangeAvailableAt
    ? usernameChangeAvailableAt.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
  const addressChangeAvailableAt = toDate(profile?.addressChangeAvailableAt);
  const addressLocked = Boolean(addressChangeAvailableAt && addressChangeAvailableAt > new Date());
  const addressLockText = addressChangeAvailableAt
    ? addressChangeAvailableAt.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
  const cpfLocked = Boolean(privateProfile?.cpf);
  const birthStateLocked = Boolean(profile?.birthState);

  const handleAvatarClick = () => {
    if (photoLocked) {
      toast.error(`Voce podera trocar a foto novamente em ${photoLockText}`);
      return;
    }
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !authUser) return;

    if (photoLocked) {
      toast.error(`Voce podera trocar a foto novamente em ${photoLockText}`);
      return;
    }

    setUploadingPhoto(true);
    try {
      const compressed = await compressAvatarImage(file);
      const formData = new FormData();
      formData.append('file', compressed, 'avatar.jpg');
      const token = await authUser.getIdToken();
      const res = await fetch('/api/profile/photo', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto');
      toast.success('Foto atualizada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar foto');
    } finally {
      setUploadingPhoto(false);
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
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={uploadingPhoto}
                  className="relative rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand-500/60 disabled:cursor-wait disabled:opacity-70"
                  aria-label="Enviar foto do perfil"
                >
                  <Avatar src={avatarSrc} name={displayName || 'U'} size="xl" ring />
                  <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-950 bg-surface-800 text-surface-400">
                    <Camera className="h-3.5 w-3.5" />
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelected}
                  className="hidden"
                />
                <div className="text-center sm:text-left">
                  <p className="font-medium text-white">{authUser.email}</p>
                  <p className="text-sm text-surface-500">
                    {photoLocked
                      ? `Voce podera trocar a foto novamente em ${photoLockText}`
                      : uploadingPhoto
                        ? 'Enviando e comprimindo sua foto...'
                        : 'Clique na camera para enviar uma foto JPG, PNG ou WebP.'}
                  </p>
                </div>
              </div>

              {/* Form fields */}
              <div>
                <label
                  htmlFor="profile-username"
                  className="mb-2 block text-sm font-medium text-surface-300"
                >
                  Username
                </label>
                <div className={`grid gap-3 ${USERNAME_CHECK_COLUMN_CLASS}`}>
                  <input
                    id="profile-username"
                    type="text"
                    placeholder="seu_username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setUsernameStatus('idle');
                    }}
                    disabled={usernameLocked}
                    required
                    className={`${USERNAME_CONTROL_HEIGHT_CLASS} w-full rounded-xl border bg-white/5 px-4 py-3 text-sm text-white backdrop-blur-sm transition-all duration-200 placeholder:text-surface-500 focus:bg-white/[0.08] focus:outline-none focus:ring-2 ${
                      usernameStatus === 'taken'
                        ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20'
                        : 'border-white/10 focus:border-brand-500/50 focus:ring-brand-500/20'
                    }`}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    loading={usernameStatus === 'checking'}
                    onClick={checkUsername}
                    disabled={usernameLocked}
                    className={`${USERNAME_CONTROL_HEIGHT_CLASS} w-full`}
                  >
                    Verificar
                  </Button>
                </div>
                <p
                  className={`mt-2 text-sm ${
                    usernameStatus === 'available'
                      ? 'text-brand-400'
                      : usernameStatus === 'taken' || usernameStatus === 'invalid'
                        ? 'text-red-400'
                        : 'text-surface-500'
                  }`}
                >
                  {usernameStatus === 'available'
                    ? 'Username disponivel.'
                    : usernameStatus === 'taken'
                      ? 'Username ja esta em uso.'
                      : usernameStatus === 'invalid'
                        ? 'Use pelo menos 3 caracteres.'
                        : usernameLocked
                          ? `Username podera ser alterado novamente em ${usernameLockText}.`
                          : 'Obrigatorio para convites, batalhas e perfil publico.'}
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Nome"
                  type="text"
                  placeholder="Seu primeiro nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <Input
                  label="Sobrenome"
                  type="text"
                  placeholder="Seu sobrenome"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  required
                />
              </div>

              <Input
                label="Nome de exibicao"
                type="text"
                placeholder="Como voce quer ser chamado"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-surface-300">
                  Naturalidade
                </label>
                <select
                  value={birthState}
                  onChange={(e) => setBirthState(e.target.value as BrazilState | '')}
                  disabled={birthStateLocked}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition-all focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20"
                  required
                >
                  <option value="">Selecione o estado onde nasceu</option>
                  {BRAZIL_STATES.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-surface-500">
                  {birthStateLocked
                    ? 'Naturalidade nao pode ser alterada depois de definida.'
                    : 'Naturalidade sera travada depois de salva.'}
                </p>
              </div>

              <Textarea
                label="Bio"
                placeholder="Conte um pouco sobre voce e seu assobio..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                helperText={`${bio.length}/280 caracteres`}
              />

              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-100">Dados oficiais</p>
                    <p className="mt-1 text-sm text-yellow-100/80">
                      Competições oficiais só serão validadas quando o perfil tiver CPF, endereço e
                      telefone verificados. A Chave Pix é obrigatória para pagamentos e prêmios.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="CPF"
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  disabled={cpfLocked}
                  onChange={(e) => {
                    setCpf(e.target.value);
                    setValidationErrors((current) => ({ ...current, cpf: undefined }));
                  }}
                  error={validationErrors.cpf}
                  helperText={
                    cpfLocked
                      ? 'CPF nao pode ser alterado depois de definido.'
                      : 'Necessario para competicoes oficiais.'
                  }
                />
                <Input
                  label="Telefone"
                  type="tel"
                  placeholder="11999999999"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setValidationErrors((current) => ({ ...current, phone: undefined }));
                  }}
                  error={validationErrors.phone}
                  helperText="DDD + numero. Ex: 11999999999."
                />
              </div>

              <Input
                label="Chave Pix"
                type="text"
                placeholder="CPF, CNPJ, email, telefone ou chave aleatoria"
                value={pixKey}
                onChange={(e) => {
                  setPixKey(e.target.value);
                  setValidationErrors((current) => ({ ...current, pixKey: undefined }));
                }}
                error={validationErrors.pixKey}
                helperText="Obrigatoria para receber pagamentos e premios."
                required
              />

              <div className="space-y-5">
                <p className="text-sm font-semibold text-white">Endereço</p>
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <Input
                    label="Cidade"
                    value={addressCity}
                    disabled={addressLocked}
                    onChange={(e) => {
                      setAddressCity(e.target.value);
                      setValidationErrors((current) => ({ ...current, city: undefined }));
                    }}
                    error={validationErrors.city}
                  />
                  <Input
                    label="CEP"
                    placeholder="01310100"
                    value={postalCode}
                    disabled={addressLocked}
                    onChange={(e) => {
                      setPostalCode(e.target.value);
                      setValidationErrors((current) => ({ ...current, postalCode: undefined }));
                    }}
                    error={validationErrors.postalCode}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <Input
                    label="Rua"
                    value={street}
                    disabled={addressLocked}
                    onChange={(e) => {
                      setStreet(e.target.value);
                      setValidationErrors((current) => ({ ...current, street: undefined }));
                    }}
                    error={validationErrors.street}
                  />
                  <Input
                    label="Número"
                    placeholder="123"
                    value={number}
                    disabled={addressLocked}
                    onChange={(e) => {
                      setNumber(e.target.value);
                      setValidationErrors((current) => ({ ...current, number: undefined }));
                    }}
                    error={validationErrors.number}
                  />
                </div>
                <p className="text-xs text-surface-500">
                  {addressLocked
                    ? `Endereco podera ser alterado novamente em ${addressLockText}.`
                    : 'Endereco podera ser alterado novamente 14 dias depois de salvo. Bairro e estado serao derivados por validacao em uma etapa posterior.'}
                </p>
              </div>

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

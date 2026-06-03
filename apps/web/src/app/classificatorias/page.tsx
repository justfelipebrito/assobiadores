'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  Trophy,
} from 'lucide-react';
import { limit, useAuth, useCollectionOnce, useDocument, where } from '@batalha/firebase';
import {
  BRAZIL_STATE_LABELS,
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABELS,
  type BrazilState,
  type CompetitionCategory,
  type QualifierRegistration,
  type QualifierTrack,
  type User,
} from '@batalha/types';
import { Badge, Button, Card, CardContent } from '@batalha/ui';
import { formatCurrency } from '@batalha/utils';
import { toast } from 'sonner';
import { PixPaymentModal } from '@/components/payments/pix-payment-modal';
import { MercadoPagoSecurityScript } from '@/components/payments/mercado-pago-security-script';
import {
  getQualifierRegistrationStateCopy,
  isActiveQualifierRegistration,
} from '@/lib/qualifier-view';
import { getMercadoPagoDeviceSessionId } from '@/lib/mercado-pago-device';
import {
  DEFAULT_PUBLIC_QUALIFIER_STATES,
  getAllQualifierTracks,
  getQualifierTrackStatusCopy,
  getQualifierTracksForStates,
  MAJOR_QUALIFIER_STATES,
  QUALIFIER_BRACKET_END_LABEL,
  QUALIFIER_BRACKET_START_LABEL,
  QUALIFIER_ENTRY_FEE_CENTS,
  QUALIFIER_FINALIZATION_LABEL,
  QUALIFIER_REGISTRATION_DEADLINE_LABEL,
  QUALIFIER_SEASON_ID,
  QUALIFIER_SUBMISSION_DEADLINE_LABEL,
  QUALIFIER_VOTING_WINDOW_LABEL,
  sortQualifierTracksForDiscovery,
} from '@/lib/qualifier-tracks';
import { trackAuthCtaClick } from '@/lib/analytics-events';

const TRACKS_PAGE_SIZE = 15;

const rules = [
  `Inscrições ficam abertas até ${QUALIFIER_REGISTRATION_DEADLINE_LABEL}.`,
  `As chaves randômicas 1v1 são geradas em ${QUALIFIER_BRACKET_START_LABEL}.`,
  `Em cada fase, competidores enviam o assobio até ${QUALIFIER_SUBMISSION_DEADLINE_LABEL}.`,
  `Votação pública abre às ${QUALIFIER_VOTING_WINDOW_LABEL}.`,
  `Às ${QUALIFIER_FINALIZATION_LABEL}, o vencedor é definido pelos votos.`,
  'Se um competidor não enviar, o oponente vence por W.O.',
  'Se ambos não enviarem, ambos são desclassificados.',
  'Ao fim dos confrontos, até 64 classificados garantem vaga no Regional do estado e categoria.',
];

interface PaymentResponse {
  paymentId: string;
  registrationId: string;
  pixQrCode: string;
  pixCopiaECola: string;
  expiresAt: string;
}

function QualifierTrackCard({
  track,
  eligibilityNote,
}: {
  track: QualifierTrack;
  eligibilityNote?: string;
}) {
  return (
    <Link href={`/classificatorias/${track.slug}`}>
      <Card className="group h-full cursor-pointer">
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gold">{getQualifierTrackStatusCopy(track)}</Badge>
            <Badge variant="purple">{track.region}</Badge>
          </div>
          <h3 className="mt-4 font-semibold text-white transition-colors group-hover:text-brand-400">
            {COMPETITION_CATEGORY_LABELS[track.category]}
          </h3>
          <p className="mt-3 text-sm text-surface-400">
            {track.confirmedCount} inscritos
          </p>
          {eligibilityNote && <p className="mt-3 text-xs text-surface-500">{eligibilityNote}</p>}
          <p className="mt-4 text-xs text-surface-500">
            Inscrições até {QUALIFIER_REGISTRATION_DEADLINE_LABEL}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function QualifierTrackSkeletons({ count }: { count: number }) {
  return Array.from({ length: count }).map((_, index) => (
    <div key={index} className="h-44 rounded-2xl border border-white/10 bg-white/[0.03]" />
  ));
}

export default function QualifiersPage() {
  const { user, loading } = useAuth();
  const { data: profile, loading: profileLoading } = useDocument<User>('users', user?.uid);
  const qualifierTrackConstraints = useMemo(() => [limit(200)], []);
  const registrationConstraints = useMemo(
    () =>
      user
        ? [where('userId', '==', user.uid), where('seasonId', '==', QUALIFIER_SEASON_ID), limit(20)]
        : [],
    [user],
  );
  const { data: qualifierTracks, loading: qualifierTracksLoading } = useCollectionOnce<QualifierTrack>(
    'qualifierTracks',
    qualifierTrackConstraints,
  );
  const { data: registrations, loading: registrationsLoading } =
    useCollectionOnce<QualifierRegistration>(
      user ? 'qualifierRegistrations' : undefined,
      registrationConstraints,
    );
  const [category, setCategory] = useState<CompetitionCategory>('freestyle');
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [visibleTrackCount, setVisibleTrackCount] = useState(TRACKS_PAGE_SIZE);

  const userRegion = profile?.birthState ?? null;
  const userRegionLabel = userRegion ? BRAZIL_STATE_LABELS[userRegion] : null;
  const selectedTitle = `Classificatória ${userRegionLabel ?? 'Regional'} ${COMPETITION_CATEGORY_LABELS[category]} 2026`;
  const selectedRegistration = registrations.find(
    (registration) =>
      registration.category === category &&
      registration.region === userRegion &&
      ['pending_payment', 'confirmed'].includes(registration.status),
  );
  const selectedRegistrationConfirmed = selectedRegistration?.status === 'confirmed';
  const selectedRegistrationPending = selectedRegistration?.status === 'pending_payment';
  const activeRegistrations = registrations.filter(isActiveQualifierRegistration);
  const eligibleQualifierStates = useMemo<BrazilState[]>(
    () => (user && userRegion ? [userRegion] : DEFAULT_PUBLIC_QUALIFIER_STATES),
    [user, userRegion],
  );
  const eligibleQualifierTracks = useMemo(
    () => getQualifierTracksForStates({ tracks: qualifierTracks, states: eligibleQualifierStates }),
    [eligibleQualifierStates, qualifierTracks],
  );
  const majorQualifierTracks = useMemo(
    () => getQualifierTracksForStates({ tracks: qualifierTracks, states: MAJOR_QUALIFIER_STATES }),
    [qualifierTracks],
  );
  const allQualifierTracks = useMemo(
    () => getAllQualifierTracks(qualifierTracks),
    [qualifierTracks],
  );
  const primaryQualifierTracks =
    user && userRegion ? eligibleQualifierTracks : majorQualifierTracks;
  const otherQualifierTracks = useMemo(
    () =>
      user && userRegion
        ? allQualifierTracks.filter((track) => track.region !== userRegion)
        : allQualifierTracks,
    [allQualifierTracks, user, userRegion],
  );
  const sortedOtherQualifierTracks = useMemo(() => {
    return sortQualifierTracksForDiscovery(otherQualifierTracks);
  }, [otherQualifierTracks]);
  const visibleOtherQualifierTracks = sortedOtherQualifierTracks.slice(0, visibleTrackCount);
  const canShowMoreQualifierTracks = visibleTrackCount < sortedOtherQualifierTracks.length;
  const activeRegistrationCategoryCount = new Set(
    activeRegistrations
      .filter((registration) => !userRegion || registration.region === userRegion)
      .map((registration) => registration.category),
  ).size;
  const shouldShowRegistrationSection = !user || !userRegion || activeRegistrationCategoryCount < 3;

  const createPayment = async () => {
    if (!user) {
      toast.error('Entre para gerar sua inscrição.');
      return;
    }
    if (!userRegion) {
      toast.error('Complete sua naturalidade no perfil para entrar nas classificatórias.');
      return;
    }

    setCreatingPayment(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/qualifiers/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category, deviceSessionId: getMercadoPagoDeviceSessionId() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar pagamento');
      }

      setPayment(data);
      setPaymentModalOpen(true);
      toast.success('Pix gerado para sua classificatória.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar pagamento');
    } finally {
      setCreatingPayment(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <MercadoPagoSecurityScript />
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Início
      </Link>

      <div className="mb-8">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
          <Trophy className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-white">Classificatórias abertas</h1>
        <p className="mt-2 max-w-2xl text-surface-400">
          Caminho oficial para entrar nos Regionais da Temporada 2026 por estado e categoria.
        </p>
      </div>

      {user && (
        <section className="mb-6 rounded-2xl border border-brand-500/25 bg-brand-500/10 p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Suas Classificatórias</h2>
              <p className="mt-1 text-sm text-surface-300">
                Quando sua chave for sorteada, envie sua gravação até{' '}
                <span className="font-semibold text-white">
                  {QUALIFIER_SUBMISSION_DEADLINE_LABEL}
                </span>{' '}
                do dia da disputa.
              </p>
            </div>
          </div>

          {registrationsLoading ? (
            <div className="h-24 rounded-xl border border-white/10 bg-surface-950/30" />
          ) : activeRegistrations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-surface-950/30 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-white">Você ainda não está inscrito.</p>
              <p className="mt-1 text-sm text-surface-400">
                Escolha uma categoria abaixo para entrar na Classificatória do seu estado.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {activeRegistrations.map((registration) => {
                const registrationState = getQualifierRegistrationStateCopy(registration);

                return (
                  <div
                    key={registration.id}
                    className="rounded-xl border border-white/10 bg-surface-950/30 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-1 text-brand-300">
                        {COMPETITION_CATEGORY_LABELS[registration.category]}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-surface-300">
                        {BRAZIL_STATE_LABELS[registration.region]}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {registrationState.title}
                    </p>
                    <p className="mt-1 text-sm text-surface-300">
                      Classificatórias acontecem entre {QUALIFIER_BRACKET_START_LABEL} e{' '}
                      {QUALIFIER_BRACKET_END_LABEL}.
                    </p>
                    <div className="mt-3 grid gap-2 text-xs text-surface-400">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-brand-400" />
                        Envio até {QUALIFIER_SUBMISSION_DEADLINE_LABEL}
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-brand-400" />
                        Votação: {QUALIFIER_VOTING_WINDOW_LABEL}
                      </div>
                    </div>
                    {registration.status === 'confirmed' && (
                      <Link
                        href={`/classificatorias/${registration.id}`}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-300 transition-colors hover:text-brand-200"
                      >
                        Ver minha chave
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-xs text-surface-500">
            A página de envio por confronto entra quando as chaves das classificatórias forem
            geradas.
          </p>
        </section>
      )}

      <section className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Classificatórias disponíveis</h2>
            <p className="mt-1 text-sm text-surface-500">
              {user && userRegion
                ? `Categorias abertas para ${BRAZIL_STATE_LABELS[userRegion]}.`
                : 'Principais estados abertos nesta temporada.'}
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {qualifierTracksLoading ? (
            <QualifierTrackSkeletons count={user ? 3 : 15} />
          ) : (
            primaryQualifierTracks.map((track) => (
              <QualifierTrackCard
                key={track.id}
                track={track}
                eligibilityNote={
                  user && userRegion
                    ? 'Você pode se inscrever nesta Classificatória pela sua Naturalidade.'
                    : undefined
                }
              />
            ))
          )}
        </div>
      </section>

      {shouldShowRegistrationSection && (
        <section className="mb-6">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-brand-400" />
                <div>
                  <h2 className="font-semibold text-white">Inscrição</h2>
                  <p className="text-sm text-surface-500">Pagamento Pix</p>
                </div>
              </div>

              <div className="rounded-xl border border-brand-500/20 bg-brand-500/10 p-4">
                <p className="text-sm text-surface-400">Valor por categoria</p>
                <p className="mt-1 text-3xl font-bold text-white">
                  {formatCurrency(QUALIFIER_ENTRY_FEE_CENTS)}
                </p>
                <p className="mt-2 text-sm text-surface-400">
                  20% fica com a plataforma e 80% compõe o prêmio regional da categoria.
                </p>
              </div>

              <div className="grid gap-3">
                <label className="text-sm font-semibold text-white" htmlFor="qualifier-category">
                  Categoria
                </label>
                <select
                  id="qualifier-category"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as CompetitionCategory);
                    setPayment(null);
                    setPaymentModalOpen(false);
                  }}
                  className="h-11 rounded-xl border border-white/10 bg-surface-900 px-3 text-sm text-white outline-none transition-colors focus:border-brand-500"
                >
                  {COMPETITION_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-sm font-semibold text-white">Regional</p>
                <p className="mt-1 text-sm text-surface-400">
                  {profileLoading
                    ? 'Carregando naturalidade...'
                    : userRegionLabel
                      ? userRegionLabel
                      : 'Complete sua naturalidade no perfil.'}
                </p>
              </div>

              {!user && !loading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/entrar"
                    onClick={() =>
                      trackAuthCtaClick({ action: 'login', location: 'qualifiers_registration' })
                    }
                  >
                    <Button className="w-full">Entrar</Button>
                  </Link>
                  <Link
                    href="/cadastro"
                    onClick={() =>
                      trackAuthCtaClick({ action: 'signup', location: 'qualifiers_registration' })
                    }
                  >
                    <Button variant="secondary" className="w-full">
                      Criar conta
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedRegistrationConfirmed ? (
                    <>
                      <div className="rounded-xl border border-brand-500/20 bg-brand-500/10 px-4 py-3 text-sm text-brand-100">
                        <div className="flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="h-4 w-4 text-brand-400" />
                          {getQualifierRegistrationStateCopy(selectedRegistration).title}
                        </div>
                        <p className="mt-1 text-brand-100/70">
                          {getQualifierRegistrationStateCopy(selectedRegistration).description}
                        </p>
                      </div>
                      <Link href={`/classificatorias/${selectedRegistration.id}`}>
                        <Button variant="secondary" className="w-full">
                          Ver minha chave
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      {selectedRegistrationPending && !payment && (
                        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100/80">
                          Existe uma inscrição pendente nesta categoria. Gere ou reabra o Pix para
                          continuar.
                        </div>
                      )}
                      <Button
                        className="w-full"
                        onClick={createPayment}
                        disabled={
                          loading ||
                          profileLoading ||
                          registrationsLoading ||
                          creatingPayment ||
                          !userRegion
                        }
                      >
                        {creatingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Gerar Pix
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <div className="space-y-6">
        <Card className="h-fit">
          <CardContent>
            <div className="mb-4 flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-brand-400" />
              <div>
                <h2 className="font-semibold text-white">Regras da Classificatória</h2>
                <p className="text-sm text-surface-500">Temporada 2026</p>
              </div>
            </div>
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <p className="text-sm text-surface-300">{rule}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="mb-4">
            <h2 className="font-semibold text-white">Todas as Classificatórias</h2>
            <p className="mt-1 text-sm text-surface-500">
              {user && userRegion
                ? `Você só pode se inscrever por ${BRAZIL_STATE_LABELS[userRegion]}, mas pode acompanhar os outros estados e categorias.`
                : 'Explore as Classificatórias por estado e categoria.'}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {qualifierTracksLoading ? (
              <QualifierTrackSkeletons count={12} />
            ) : (
              visibleOtherQualifierTracks.map((track) => (
                <QualifierTrackCard
                  key={track.id}
                  track={track}
                  eligibilityNote={
                    user && userRegion
                      ? `Inscrição restrita a perfis com Naturalidade ${track.region}.`
                      : undefined
                  }
                />
              ))
            )}
          </div>
          {!qualifierTracksLoading && canShowMoreQualifierTracks && (
            <div className="mt-5 flex justify-center">
              <Button
                variant="secondary"
                onClick={() =>
                  setVisibleTrackCount((current) =>
                    Math.min(current + TRACKS_PAGE_SIZE, sortedOtherQualifierTracks.length),
                  )
                }
              >
                Ver mais
              </Button>
            </div>
          )}
        </section>
      </div>
      {payment && user && (
        <PixPaymentModal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          title={selectedTitle}
          amount={QUALIFIER_ENTRY_FEE_CENTS}
          paymentId={payment.paymentId}
          pixQrCode={payment.pixQrCode}
          pixCopiaECola={payment.pixCopiaECola}
          expiresAt={payment.expiresAt}
          getAuthToken={() => user.getIdToken()}
          approvedTitle="Classificatória confirmada!"
          approvedDescription={`Sua inscrição em ${selectedTitle} foi confirmada.`}
          primaryHref="/campeonatos"
          primaryLabel="Ver campeonatos"
          secondaryHref="/"
          secondaryLabel="Voltar ao início"
          allowTestApproval={process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true'}
          onApproved={() => {
            setPaymentModalOpen(false);
            setPayment(null);
          }}
        />
      )}
    </div>
  );
}

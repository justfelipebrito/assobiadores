import type { QualifierMatch, QualifierRegistration } from '@batalha/types';

const ACTIVE_REGISTRATION_STATUSES = ['pending_payment', 'confirmed'] as const;

export function isActiveQualifierRegistration(registration: Pick<QualifierRegistration, 'status'>) {
  return ACTIVE_REGISTRATION_STATUSES.includes(
    registration.status as (typeof ACTIVE_REGISTRATION_STATUSES)[number],
  );
}

export function getQualifierRegistrationStateCopy(
  registration: Pick<QualifierRegistration, 'status' | 'bracketStatus'>,
) {
  if (registration.status === 'pending_payment') {
    return {
      title: 'Pagamento pendente',
      description: 'Finalize o Pix para confirmar sua vaga nas Classificatórias.',
      tone: 'warning' as const,
    };
  }

  if (registration.status === 'cancelled') {
    return {
      title: 'Inscrição cancelada',
      description: 'Esta inscrição foi cancelada. Gere um novo Pix para participar.',
      tone: 'muted' as const,
    };
  }

  if (registration.bracketStatus === 'qualified') {
    return {
      title: 'Classificado para o Regional',
      description: 'Você garantiu sua vaga na competição Regional da categoria.',
      tone: 'success' as const,
    };
  }

  if (registration.bracketStatus === 'eliminated') {
    return {
      title: 'Eliminado',
      description: 'Sua campanha nas Classificatórias desta categoria foi encerrada.',
      tone: 'danger' as const,
    };
  }

  if (registration.bracketStatus === 'active') {
    return {
      title: 'Confronto em andamento',
      description: 'Acompanhe o prazo de envio e a janela de votação do confronto atual.',
      tone: 'success' as const,
    };
  }

  return {
    title: 'Aguardando sorteio',
    description: 'Sua inscrição está confirmada. As chaves serão geradas automaticamente.',
    tone: 'brand' as const,
  };
}

export function sortQualifierMatches(matches: QualifierMatch[]) {
  return [...matches].sort((a, b) => {
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    return getTime(a.scheduledFor) - getTime(b.scheduledFor);
  });
}

export function getQualifierMatchStatusCopy(status: QualifierMatch['status']) {
  switch (status) {
    case 'scheduled':
      return 'Agendado';
    case 'submissions_open':
      return 'Envios abertos';
    case 'voting':
      return 'Votação aberta';
    case 'finished':
      return 'Finalizado';
    case 'walkover':
      return 'W.O.';
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Agendado';
  }
}

export function getQualifierEmptyMatchesCopy(
  registration: Pick<QualifierRegistration, 'status' | 'bracketStatus'> | null,
) {
  if (!registration) return 'Selecione uma inscrição para acompanhar sua chave.';
  if (registration.status === 'pending_payment') {
    return 'Finalize o Pix para entrar no sorteio das chaves.';
  }
  if (registration.bracketStatus === 'qualified') {
    return 'Sua classificação foi concluída. O próximo passo aparece no campeonato Regional.';
  }
  if (registration.bracketStatus === 'eliminated') {
    return 'Nenhum confronto ativo. Sua campanha desta categoria foi encerrada.';
  }
  return 'Nenhum confronto sorteado ainda. As chaves aparecem aqui quando forem geradas.';
}

function getTime(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

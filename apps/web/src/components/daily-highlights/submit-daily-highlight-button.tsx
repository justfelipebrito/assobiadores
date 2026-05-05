'use client';

import { Button } from '@batalha/ui';
import { shouldShowSubmitDailyHighlightButton } from './submit-daily-highlight-button-visibility';

interface SubmitDailyHighlightButtonProps {
  isAuthenticated: boolean;
  hasSubmittedToday?: boolean;
  onClick: () => void;
  className?: string;
}

export function SubmitDailyHighlightButton({
  isAuthenticated,
  hasSubmittedToday = false,
  onClick,
  className,
}: SubmitDailyHighlightButtonProps) {
  if (!shouldShowSubmitDailyHighlightButton({ isAuthenticated, hasSubmittedToday })) return null;

  return (
    <Button size="sm" onClick={onClick} className={className}>
      Enviar
    </Button>
  );
}

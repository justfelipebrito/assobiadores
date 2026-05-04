'use client';

import { Button } from '@batalha/ui';
import { shouldShowSubmitDailyHighlightButton } from './submit-daily-highlight-button-visibility';

interface SubmitDailyHighlightButtonProps {
  isAuthenticated: boolean;
  onClick: () => void;
  className?: string;
}

export function SubmitDailyHighlightButton({
  isAuthenticated,
  onClick,
  className,
}: SubmitDailyHighlightButtonProps) {
  if (!shouldShowSubmitDailyHighlightButton(isAuthenticated)) return null;

  return (
    <Button size="sm" onClick={onClick} className={className}>
      Enviar
    </Button>
  );
}

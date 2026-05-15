'use client';

import Link from 'next/link';
import { Button, buttonVariants, cn } from '@batalha/ui';
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

  if (!isAuthenticated) {
    return (
      <Link href="/entrar" className={cn(buttonVariants({ size: 'sm' }), className)}>
        Enviar
      </Link>
    );
  }

  return (
    <Button size="sm" onClick={onClick} className={className}>
      Enviar
    </Button>
  );
}

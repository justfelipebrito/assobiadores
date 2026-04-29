import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {icon && <div className="mb-5 text-surface-600">{icon}</div>}
      <h3 className="text-lg font-semibold text-surface-300">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-surface-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

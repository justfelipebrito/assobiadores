import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'glass' | 'solid';
}

export function Card({ className, children, variant = 'glass', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-300',
        variant === 'glass' && 'border border-white/10 bg-white/5 backdrop-blur-xl hover:border-white/20 hover:bg-white/[0.08]',
        variant === 'solid' && 'border border-surface-800 bg-surface-900',
        variant === 'default' && 'border border-white/10 bg-surface-900/80',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('border-b border-white/5 px-5 py-4 sm:px-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('px-5 py-5 sm:px-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('border-t border-white/5 px-5 py-4 sm:px-6', className)} {...props}>
      {children}
    </div>
  );
}

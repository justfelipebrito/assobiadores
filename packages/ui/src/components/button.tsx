'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        primary:
          'rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:brightness-110 focus-visible:ring-brand-500',
        secondary:
          'rounded-xl border border-white/10 bg-white/5 text-white backdrop-blur-sm hover:border-white/20 hover:bg-white/10 focus-visible:ring-white/50',
        ghost:
          'rounded-xl text-surface-300 hover:bg-white/5 hover:text-white focus-visible:ring-white/50',
        danger:
          'rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:brightness-110 focus-visible:ring-red-500',
        outline:
          'rounded-xl border border-brand-500/50 bg-transparent text-brand-400 hover:border-brand-400 hover:bg-brand-500/10 focus-visible:ring-brand-500',
        accent:
          'rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 text-white shadow-lg shadow-accent-500/25 hover:shadow-accent-500/40 hover:brightness-110 focus-visible:ring-accent-500',
      },
      size: {
        sm: 'h-9 px-4 text-sm min-w-[44px]',
        md: 'h-11 px-5 text-sm min-w-[44px] min-h-[44px]',
        lg: 'h-13 px-7 text-base min-w-[44px] min-h-[52px]',
        xl: 'h-14 px-8 text-lg min-w-[44px] min-h-[56px]',
        icon: 'h-11 w-11 min-w-[44px] min-h-[44px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };

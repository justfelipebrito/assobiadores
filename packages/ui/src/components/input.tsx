'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-surface-300">
            {label}
          </label>
        )}
        <input
          id={inputId}
          className={cn(
            'flex h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-surface-500 transition-all duration-200 focus:border-brand-500/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-sm',
            error && 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20',
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        {helperText && !error && <p className="mt-2 text-sm text-surface-500">{helperText}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

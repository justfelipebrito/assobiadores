import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide',
  {
    variants: {
      variant: {
        default: 'border border-white/10 bg-white/5 text-surface-300',
        success: 'border border-brand-500/20 bg-brand-500/10 text-brand-400',
        warning: 'border border-amber-500/20 bg-amber-500/10 text-amber-400',
        danger: 'border border-red-500/20 bg-red-500/10 text-red-400',
        info: 'border border-blue-500/20 bg-blue-500/10 text-blue-400',
        purple: 'border border-accent-500/20 bg-accent-500/10 text-accent-400',
        gold: 'border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 text-yellow-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { badgeVariants };

import { cn } from '../lib/cn';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  ring?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ src, name, size = 'md', className, ring = false }: AvatarProps) {
  const ringClass = ring
    ? 'ring-2 ring-brand-500/50 ring-offset-2 ring-offset-surface-950'
    : '';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizeClasses[size], ringClass, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-brand-500/20 to-accent-500/20 font-semibold text-brand-400',
        sizeClasses[size],
        ringClass,
        className,
      )}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
}

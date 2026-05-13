import { cn } from '@batalha/ui';
import type { SortDirection } from './sortable-table';

export function SortableTableHeader({
  label,
  active,
  direction,
  align = 'left',
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  align?: 'left' | 'right';
  onClick: () => void;
}) {
  const indicator = active ? (direction === 'asc' ? '↑' : '↓') : '↕';

  return (
    <th
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-surface-500',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40',
          align === 'right' && 'justify-end',
        )}
      >
        <span>{label}</span>
        <span className={cn('text-sm leading-none', active ? 'text-brand-300' : 'text-surface-600')}>
          {indicator}
        </span>
      </button>
    </th>
  );
}

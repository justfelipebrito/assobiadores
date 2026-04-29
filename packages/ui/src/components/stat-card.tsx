import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  className?: string;
}

export function StatCard({ icon, label, value, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]',
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative">
        {icon && (
          <div className="mb-3 inline-flex rounded-xl bg-brand-500/10 p-2.5 text-brand-400">
            {icon}
          </div>
        )}
        <p className="text-sm font-medium text-surface-400">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-white">{value}</p>
        {trend && (
          <p className="mt-1 text-xs font-medium text-brand-400">{trend}</p>
        )}
      </div>
    </div>
  );
}

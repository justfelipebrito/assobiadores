import { CalendarDays, Home, Plus, Swords, Trophy, User, Medal, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';

export type MobileNavigationItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  emphasis?: 'primary';
};

export function getMobileNavigationItems(isAuthenticated: boolean): MobileNavigationItem[] {
  return [
    ...(isAuthenticated
      ? [
          {
            href: '/criar-batalha',
            label: 'Criar batalha',
            icon: Plus,
            emphasis: 'primary' as const,
          },
        ]
      : []),
    { href: '/', label: 'Início', icon: Home },
    { href: '/agenda', label: 'Agenda', icon: CalendarDays },
    { href: '/batalhas', label: 'Batalhas', icon: Swords },
    { href: '/classificatorias', label: 'Classificatórias', icon: Trophy },
    { href: '/destaques', label: 'Destaques', icon: Sparkles },
    { href: '/ranking', label: 'Ranking', icon: Medal },
    ...(isAuthenticated ? [{ href: '/conta', label: 'Minha Conta', icon: User }] : []),
  ];
}

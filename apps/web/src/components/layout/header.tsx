'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Clock, Menu, User, LogOut, Trophy, Swords, Plus } from 'lucide-react';
import { orderBy, useAuth, useCollection } from '@batalha/firebase';
import { Avatar, Badge, Button } from '@batalha/ui';
import { formatRelativeTime, toDate } from '@batalha/utils';
import type { Battle } from '@batalha/types';
import { MobileNav } from './mobile-nav';

const BATTLE_STATUS_LABEL: Record<string, string> = {
  registration: 'Inscricoes',
  active: 'Envios',
  voting: 'Votacao',
  finished: 'Resultado',
};

function getBattleAction(battle: Battle) {
  if (battle.status === 'voting') {
    return { href: `/batalhas/${battle.id}/votar`, label: 'Votar' };
  }
  if (battle.status === 'active') {
    return { href: `/batalhas/${battle.id}/enviar`, label: 'Enviar' };
  }
  if (battle.status === 'registration') {
    return { href: `/batalhas/${battle.id}`, label: 'Participar' };
  }
  return { href: `/batalhas/${battle.id}/resultado`, label: 'Ver' };
}

function BattleTicker() {
  const { data: battles } = useCollection<Battle>('battles', [orderBy('createdAt', 'desc')]);
  const visibleBattles = useMemo(
    () =>
      battles
        .filter((battle) => ['registration', 'active', 'voting'].includes(battle.status))
        .slice(0, 8),
    [battles],
  );

  if (visibleBattles.length === 0) return null;

  return (
    <div className="border-t border-white/5 bg-surface-950/95">
      <div className="mx-auto flex max-w-6xl items-stretch overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex min-w-[112px] flex-shrink-0 items-center border-l border-r border-white/5 px-3">
          <Link
            href="/batalhas"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs font-semibold text-surface-300 transition-colors hover:border-brand-500/40 hover:text-white"
          >
            Ver todas
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {visibleBattles.map((battle) => {
          const action = getBattleAction(battle);
          const timeTarget =
            battle.status === 'registration'
              ? toDate(battle.registrationEnd)
              : battle.status === 'active'
                ? toDate(battle.submissionDeadline)
                : toDate(battle.votingEnd);

          return (
            <div
              key={battle.id}
              className="flex min-w-[220px] max-w-[240px] flex-col justify-between gap-2 border-r border-white/5 px-3 py-3"
            >
              <Link href={`/batalhas/${battle.id}`} className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant={battle.type === 'official' ? 'gold' : 'default'} className="text-[10px]">
                    {battle.type === 'official' ? 'Oficial' : 'Comunidade'}
                  </Badge>
                  <span className="truncate text-xs font-medium text-brand-400">
                    {BATTLE_STATUS_LABEL[battle.status] || battle.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-white">{battle.title}</p>
                {timeTarget && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-surface-500">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(timeTarget)}
                  </p>
                )}
              </Link>
              <Link
                href={action.href}
                className="inline-flex h-7 w-fit flex-shrink-0 items-center gap-1 rounded-md bg-brand-500 px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-brand-400"
              >
                {action.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Header() {
  const { user, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-surface-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-lg font-bold text-white shadow-glow-sm">
              A
            </div>
            <span className="hidden text-lg font-bold text-white sm:block">
              Assobiador
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/batalhas"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-surface-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Swords className="h-4 w-4" />
              Batalhas
            </Link>
            <Link
              href="/ranking"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-surface-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Trophy className="h-4 w-4" />
              Ranking
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user && (
              <Link href="/criar-batalha" className="hidden md:flex items-center gap-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-400 transition-colors hover:bg-brand-500/20">
                <Plus className="h-4 w-4" />
                Criar batalha
              </Link>
            )}
            {loading ? (
              <div className="h-10 w-10 animate-pulse rounded-full bg-white/5" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-white/5"
                >
                  <Avatar
                    src={user.photoURL}
                    name={user.displayName || 'U'}
                    size="sm"
                  />
                  <span className="hidden text-sm font-medium text-surface-300 md:block">
                    {user.displayName?.split(' ')[0]}
                  </span>
                </button>

                {/* Dropdown */}
                {profileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-scale-in rounded-xl border border-white/10 bg-surface-900 p-2 shadow-elevated">
                      <Link
                        href="/meu-perfil"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-surface-300 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <User className="h-4 w-4" />
                        Meu Perfil
                      </Link>
                      <div className="my-1 border-t border-white/5" />
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          signOut();
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-surface-300 transition-colors hover:bg-white/5 hover:text-red-400"
                      >
                        <LogOut className="h-4 w-4" />
                        Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link href="/entrar">
                  <Button variant="ghost" size="sm">
                    Entrar
                  </Button>
                </Link>
                <Link href="/cadastro">
                  <Button size="sm">Criar conta</Button>
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-surface-400 transition-colors hover:bg-white/5 hover:text-white md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
        <BattleTicker />
      </header>

      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
        onSignOut={signOut}
      />
    </>
  );
}

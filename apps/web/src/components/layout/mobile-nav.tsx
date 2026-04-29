'use client';

import Link from 'next/link';
import { X, Swords, Trophy, User, LogOut, LogIn, UserPlus } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { Avatar } from '@batalha/ui';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  onSignOut: () => void;
}

export function MobileNav({ open, onClose, user, onSignOut }: MobileNavProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute bottom-0 left-0 right-0 top-0 w-[280px] animate-slide-in-left border-r border-white/5 bg-surface-950">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-lg font-bold text-white">
                A
              </div>
              <span className="text-lg font-bold text-white">Assobiador</span>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-surface-400 hover:bg-white/5 hover:text-white"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User section */}
          {user && (
            <div className="border-b border-white/5 px-4 py-4">
              <div className="flex items-center gap-3">
                <Avatar
                  src={user.photoURL}
                  name={user.displayName || 'U'}
                  size="md"
                  ring
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {user.displayName}
                  </p>
                  <p className="truncate text-xs text-surface-500">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4">
            <div className="space-y-1">
              <NavLink href="/batalhas" icon={<Swords className="h-5 w-5" />} onClick={onClose}>
                Batalhas
              </NavLink>
              <NavLink href="/ranking" icon={<Trophy className="h-5 w-5" />} onClick={onClose}>
                Ranking
              </NavLink>
              {user && (
                <NavLink href="/meu-perfil" icon={<User className="h-5 w-5" />} onClick={onClose}>
                  Meu Perfil
                </NavLink>
              )}
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-white/5 px-3 py-4">
            {user ? (
              <button
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-surface-400 transition-colors hover:bg-white/5 hover:text-red-400"
              >
                <LogOut className="h-5 w-5" />
                Sair
              </button>
            ) : (
              <div className="space-y-1">
                <NavLink href="/entrar" icon={<LogIn className="h-5 w-5" />} onClick={onClose}>
                  Entrar
                </NavLink>
                <NavLink href="/cadastro" icon={<UserPlus className="h-5 w-5" />} onClick={onClose}>
                  Criar conta
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-surface-300 transition-colors hover:bg-white/5 hover:text-white"
    >
      {icon}
      {children}
    </Link>
  );
}

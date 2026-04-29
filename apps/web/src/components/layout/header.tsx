'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, User, LogOut, Trophy, Swords } from 'lucide-react';
import { useAuth } from '@batalha/firebase';
import { Avatar, Button } from '@batalha/ui';
import { MobileNav } from './mobile-nav';

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

'use client';

import Link from 'next/link';
import { X, LogOut, LogIn, UserPlus } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { Avatar } from '@batalha/ui';
import { trackAuthCtaClick } from '../../lib/analytics-events';
import { getMobileNavigationItems } from '../../lib/mobile-navigation';
import { PUBLIC_BRAND_NAME } from '../../lib/public-brand';
import { useBodyScrollLock } from '../../lib/use-body-scroll-lock';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  avatarSrc?: string;
  displayName: string;
  onSignOut: () => void;
}

export function MobileNav({
  open,
  onClose,
  user,
  avatarSrc,
  displayName,
  onSignOut,
}: MobileNavProps) {
  useBodyScrollLock(open);

  if (!open) return null;
  const navItems = getMobileNavigationItems(Boolean(user));

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="absolute bottom-0 right-0 top-0 w-[min(320px,86vw)] animate-slide-in-right border-l border-white/5 bg-surface-950">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt={PUBLIC_BRAND_NAME}
                className="h-9 w-9 rounded-xl object-contain"
              />
              <span className="text-base font-bold text-white">assobiador.com</span>
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
            <div className="border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar src={avatarSrc} name={displayName} size="sm" ring />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                  <p className="truncate text-xs text-surface-500">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    icon={<Icon className="h-5 w-5" />}
                    onClick={onClose}
                    emphasis={item.emphasis}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
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
                <NavLink
                  href="/entrar"
                  icon={<LogIn className="h-5 w-5" />}
                  onClick={() => {
                    trackAuthCtaClick({ action: 'login', location: 'mobile_nav' });
                    onClose();
                  }}
                >
                  Entrar
                </NavLink>
                <NavLink
                  href="/cadastro"
                  icon={<UserPlus className="h-5 w-5" />}
                  onClick={() => {
                    trackAuthCtaClick({ action: 'signup', location: 'mobile_nav' });
                    onClose();
                  }}
                >
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
  emphasis,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  emphasis?: 'primary';
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
        emphasis === 'primary'
          ? 'border border-brand-500/30 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20 hover:text-white'
          : 'text-surface-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

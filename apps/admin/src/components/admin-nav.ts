export const ADMIN_NAV_ITEMS = [
  { href: '/', label: 'Inicio' },
  { href: '/batalhas', label: 'Batalhas' },
  { href: '/campeonatos', label: 'Campeonatos' },
  { href: '/moderacao', label: 'Moderacao' },
  { href: '/usuarios', label: 'Usuarios' },
  { href: '/pagamentos', label: 'Pagamentos' },
] as const;

export function isAdminNavItemActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

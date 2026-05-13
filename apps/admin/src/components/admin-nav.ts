export const ADMIN_NAV_ITEMS = [
  { href: '/', label: 'Dashboard', description: 'Visão geral' },
  { href: '/usuarios', label: 'Usuários', description: 'Contas e acesso' },
  { href: '/pagamentos', label: 'Inscrições Pagas', description: 'Pix confirmados' },
  { href: '/batalhas', label: 'Batalhas', description: 'Operação diária' },
  { href: '/classificatorias', label: 'Classificatórias', description: 'Chaves oficiais' },
  { href: '/campeonatos', label: 'Campeonatos', description: 'Eventos e fases' },
  { href: '/moderacao', label: 'Moderação', description: 'Denúncias' },
  { href: '/configuracoes', label: 'Configurações', description: 'Homepage' },
] as const;

export function isAdminNavItemActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

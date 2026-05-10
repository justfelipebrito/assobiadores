import { describe, expect, it } from 'vitest';
import { getMobileNavigationItems } from './mobile-navigation';

describe('getMobileNavigationItems', () => {
  it('puts the authenticated primary creation action first', () => {
    const items = getMobileNavigationItems(true);

    expect(items[0]).toMatchObject({
      href: '/criar-batalha',
      label: 'Criar batalha',
      emphasis: 'primary',
    });
  });

  it('does not show the battle creation action for anonymous users', () => {
    const items = getMobileNavigationItems(false);

    expect(items.map((item) => item.href)).not.toContain('/criar-batalha');
    expect(items.map((item) => item.href)).toEqual([
      '/',
      '/agenda',
      '/batalhas',
      '/classificatorias',
      '/destaques',
      '/ranking',
    ]);
  });
});

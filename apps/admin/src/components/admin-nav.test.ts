import { describe, expect, it } from 'vitest';
import { isAdminNavItemActive } from './admin-nav';

describe('admin navigation', () => {
  it('marks root active only on dashboard', () => {
    expect(isAdminNavItemActive('/', '/')).toBe(true);
    expect(isAdminNavItemActive('/batalhas', '/')).toBe(false);
  });

  it('marks section and nested routes active', () => {
    expect(isAdminNavItemActive('/batalhas', '/batalhas')).toBe(true);
    expect(isAdminNavItemActive('/batalhas/battle-1', '/batalhas')).toBe(true);
    expect(isAdminNavItemActive('/campeonatos', '/batalhas')).toBe(false);
  });
});

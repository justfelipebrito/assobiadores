import { describe, expect, it } from 'vitest';
import { PUBLIC_BRAND_DESCRIPTION, PUBLIC_BRAND_NAME } from './public-brand';

describe('public brand copy', () => {
  it('uses Absolute Assobio for public UI branding', () => {
    expect(PUBLIC_BRAND_NAME).toBe('Absolute Assobio');
    expect(PUBLIC_BRAND_DESCRIPTION).toContain('Absolute Assobio');
  });
});

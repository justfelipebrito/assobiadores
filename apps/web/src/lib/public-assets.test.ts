import { describe, expect, it } from 'vitest';
import { PUBLIC_FAVICON_SRC, PUBLIC_LOGO_ICON_SRC } from './public-assets';

describe('public assets', () => {
  it('uses versioned Absolute Assobio logo paths to avoid stale cached assets', () => {
    expect(PUBLIC_LOGO_ICON_SRC).toBe('/absolute-assobio-icon-v2.png');
    expect(PUBLIC_FAVICON_SRC).toBe('/absolute-assobio-favicon-v2.png');
  });
});

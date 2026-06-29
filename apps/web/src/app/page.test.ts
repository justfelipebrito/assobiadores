import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const pageSource = readFileSync(resolve(testDir, 'page.tsx'), 'utf8');

describe('homepage hero source policy', () => {
  it('uses only Mini Classificatoria Freestyle and available battles in the hero', () => {
    expect(pageSource).toContain("getMiniQualifierTrackId('freestyle')");
    expect(pageSource).toContain('buildMiniQualifierTrackFallback()');
    expect(pageSource).toContain('activeBattles.slice(0, 2)');
    expect(pageSource).toContain('Mini Classificatória e batalhas disponíveis');
    expect(pageSource).not.toContain('getHomepageHeroQualifierTracks');
  });
});

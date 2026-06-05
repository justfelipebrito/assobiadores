import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const pageSource = readFileSync(resolve(testDir, 'page.tsx'), 'utf8');

describe('classificatorias page', () => {
  it('keeps the available qualifier rail behind the logged-in user gate', () => {
    expect(pageSource).toContain(
      'const shouldShowAvailableQualifierTracks = canShowQualifierAvailableTracks(user);',
    );
    expect(pageSource).toContain('{shouldShowAvailableQualifierTracks && (');

    const gateIndex = pageSource.indexOf('{shouldShowAvailableQualifierTracks && (');
    const availableTitleIndex = pageSource.indexOf('Classificatórias disponíveis');
    const registrationTitleIndex = pageSource.indexOf('Inscrição');

    expect(gateIndex).toBeGreaterThan(-1);
    expect(availableTitleIndex).toBeGreaterThan(gateIndex);
    expect(registrationTitleIndex).toBeGreaterThan(availableTitleIndex);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(testDir, '../../../..');

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('AdSense verification assets', () => {
  it('serves the exact authorized seller record from /ads.txt', () => {
    expect(readRepoFile('apps/web/public/ads.txt').trim()).toBe(
      'google.com, pub-1405185920341102, DIRECT, f08c47fec0942fa0',
    );
  });

  it('keeps the publisher script available in the root layout', () => {
    const script = readRepoFile('apps/web/src/components/ads/adsense-publisher-script.tsx');
    const layout = readRepoFile('apps/web/src/app/layout.tsx');
    const appHosting = readRepoFile('apps/web/apphosting.yaml');

    expect(script).toContain('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');
    expect(script).toContain('crossOrigin="anonymous"');
    expect(layout).toContain('<AdsensePublisherScript />');
    expect(appHosting).toContain('NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT');
    expect(appHosting).toContain('ca-pub-1405185920341102');
  });
});

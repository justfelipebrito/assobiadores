import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(testDir, '../../../..');

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('Firestore read mode policy', () => {
  it('exports one-time read hooks from the shared Firebase package', () => {
    const sharedExports = readRepoFile('packages/firebase/src/index.ts');
    const firestoreHooks = readRepoFile('packages/firebase/src/firestore.ts');

    expect(sharedExports).toContain('useDocumentOnce');
    expect(sharedExports).toContain('useCollectionOnce');
    expect(firestoreHooks).toContain('getDoc(doc(db, collectionName, docId))');
    expect(firestoreHooks).toContain('getDocs(q)');
  });

  it('keeps the homepage header ticker realtime', () => {
    const header = readRepoFile('apps/web/src/components/layout/header.tsx');

    expect(header).toContain('useCollection<Battle>');
    expect(header).toContain('useCollection<QualifierTrack>');
    expect(header).toContain('useCollection<Championship>');
    expect(header).not.toContain('useCollectionOnce');
  });

  it('keeps homepage daily highlights realtime and moves other homepage rails to one-time reads', () => {
    const homepage = readRepoFile('apps/web/src/app/page.tsx');

    expect(homepage).toContain("useCollection<DailyHighlight>('dailyHighlights'");
    expect(homepage).toContain('const { data: todayUserHighlights } = useCollection<DailyHighlight>');
    expect(homepage).toContain('useDocumentOnce<HomepageSettings>');
    expect(homepage).toContain('useCollectionOnce<Battle>');
    expect(homepage).toContain('useCollectionOnce<Championship>');
    expect(homepage).toContain('useCollectionOnce<SeasonRanking>');
    expect(homepage).toContain('useCollectionOnce<QualifierTrack>');
  });

  it('uses one-time reads for public overview pages that can update on refresh', () => {
    const publicOverviewPages = [
      'apps/web/src/app/agenda/page.tsx',
      'apps/web/src/app/batalhas/page.tsx',
      'apps/web/src/app/campeonatos/page.tsx',
      'apps/web/src/app/classificatorias/page.tsx',
      'apps/web/src/app/ranking/page.tsx',
      'apps/web/src/app/ranking/temporadas/page.tsx',
    ];

    for (const page of publicOverviewPages) {
      expect(readRepoFile(page), page).toContain('useCollectionOnce');
    }
  });

  it('uses one-time reads for broad admin list screens and exposes qualifier refresh controls', () => {
    const adminListPages = [
      'apps/admin/src/app/page.tsx',
      'apps/admin/src/app/batalhas/page.tsx',
      'apps/admin/src/app/campeonatos/page.tsx',
      'apps/admin/src/app/classificatorias/page.tsx',
      'apps/admin/src/app/pagamentos/page.tsx',
      'apps/admin/src/app/usuarios/page.tsx',
    ];

    for (const page of adminListPages) {
      expect(readRepoFile(page), page).toContain('useCollectionOnce');
    }

    const qualifiersAdmin = readRepoFile('apps/admin/src/app/classificatorias/page.tsx');
    expect(qualifiersAdmin).toContain('Atualizar dados');
    expect(qualifiersAdmin).toContain('refreshQualifierData');
  });
});

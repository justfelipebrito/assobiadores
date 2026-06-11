import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const pageSource = readFileSync(resolve(testDir, 'page.tsx'), 'utf8');

describe('admin users page private profile summaries', () => {
  it('loads Pix and profile readiness through the trusted admin API', () => {
    expect(pageSource).toContain('/api/admin/users/private-profiles');
    expect(pageSource).toContain('privateSummary.pixKey');
    expect(pageSource).toContain("!privateSummary?.hasCpf ? 'CPF' : null");
    expect(pageSource).toContain("!privateSummary?.hasPhone ? 'telefone' : null");
  });
});

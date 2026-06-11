import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const listPageSource = readFileSync(resolve(testDir, 'page.tsx'), 'utf8');
const detailPageSource = readFileSync(resolve(testDir, '[battleId]/page.tsx'), 'utf8');

describe('admin battle pages', () => {
  it('routes the battle open CTA to the admin detail page', () => {
    expect(listPageSource).toContain('router.push(`/batalhas/${battle.id}`)');
    expect(listPageSource).toContain('Abrir');
    expect(listPageSource).not.toContain('setEditingBattle');
    expect(listPageSource).not.toContain('openBattle(battle)');
  });

  it('shows participants, winners, and the trusted winner email action on the detail page', () => {
    expect(detailPageSource).toContain('Pessoas e envios');
    expect(detailPageSource).toContain('Vencedores');
    expect(detailPageSource).toContain('/api/admin/battles/${params.battleId}/winner-email');
    expect(detailPageSource).toContain('window.location.href = data.mailtoHref');
  });

  it('opens battle settings from the detail page context', () => {
    expect(detailPageSource).toContain('Configurações');
    expect(detailPageSource).toContain('<AdminBattleConfigModal');
    expect(detailPageSource).toContain('refreshBattle();');
  });
});

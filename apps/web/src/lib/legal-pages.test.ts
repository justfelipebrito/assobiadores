import { describe, expect, it } from 'vitest';
import { LEGAL_PAGES } from './legal-pages';

describe('LEGAL_PAGES', () => {
  it('defines public routes for terms and privacy', () => {
    expect(LEGAL_PAGES.terms.href).toBe('/termos-de-uso');
    expect(LEGAL_PAGES.privacy.href).toBe('/privacidade');
  });

  it('covers the minimum product and privacy topics', () => {
    const termsTitles = LEGAL_PAGES.terms.sections.map((section) => section.title);
    const privacyTitles = LEGAL_PAGES.privacy.sections.map((section) => section.title);

    expect(termsTitles).toEqual(
      expect.arrayContaining([
        'Conta e responsabilidade do usuário',
        'Conteúdo enviado',
        'Batalhas, classificatórias e campeonatos',
        'Pagamentos e prêmios',
      ]),
    );
    expect(privacyTitles).toEqual(
      expect.arrayContaining([
        'Dados que coletamos',
        'Dados públicos e dados privados',
        'Compartilhamento com terceiros',
        'Seus direitos',
      ]),
    );
  });
});

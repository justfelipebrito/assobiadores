import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DAILY_HIGHLIGHT_BANNER_TEXT,
  createDefaultHomepageSettingsFormValues,
  validateHomepageSettingsForm,
} from './homepage-settings-form';

describe('homepage settings form', () => {
  it('defaults the daily highlight banner to the May prize campaign', () => {
    expect(createDefaultHomepageSettingsFormValues()).toEqual({
      dailyHighlightBannerEnabled: true,
      dailyHighlightBannerText: DEFAULT_DAILY_HIGHLIGHT_BANNER_TEXT,
      dailyHighlightBannerEndDayKey: '2026-05-31',
    });
  });

  it('normalizes valid banner values before saving', () => {
    expect(
      validateHomepageSettingsForm({
        dailyHighlightBannerEnabled: true,
        dailyHighlightBannerText: '  Submissao gratis hoje  ',
        dailyHighlightBannerEndDayKey: '2026-05-31',
      }).payload,
    ).toEqual({
      dailyHighlightBannerEnabled: true,
      dailyHighlightBannerText: 'Submissao gratis hoje',
      dailyHighlightBannerEndDayKey: '2026-05-31',
    });
  });

  it('requires text when the banner is enabled', () => {
    expect(
      validateHomepageSettingsForm({
        dailyHighlightBannerEnabled: true,
        dailyHighlightBannerText: '   ',
        dailyHighlightBannerEndDayKey: '2026-05-31',
      }).error,
    ).toBe('Informe o texto do banner ou desative a exibicao.');
  });

  it('validates text length and optional end day key format', () => {
    expect(
      validateHomepageSettingsForm({
        dailyHighlightBannerEnabled: true,
        dailyHighlightBannerText: 'x'.repeat(161),
        dailyHighlightBannerEndDayKey: '2026-05-31',
      }).error,
    ).toBe('O texto do banner deve ter no maximo 160 caracteres.');

    expect(
      validateHomepageSettingsForm({
        dailyHighlightBannerEnabled: false,
        dailyHighlightBannerText: '',
        dailyHighlightBannerEndDayKey: '31/05/2026',
      }).error,
    ).toBe('Use a data final no formato AAAA-MM-DD.');
  });
});

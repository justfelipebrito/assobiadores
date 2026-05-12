export const DEFAULT_DAILY_HIGHLIGHT_BANNER_TEXT =
  'R$5 para o mais votado diariamente até o final de Maio, submissão grátis.';

export interface HomepageSettingsFormValues {
  dailyHighlightBannerEnabled: boolean;
  dailyHighlightBannerText: string;
  dailyHighlightBannerEndDayKey: string;
}

export interface HomepageSettingsValidationResult {
  payload?: HomepageSettingsFormValues;
  error?: string;
}

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createDefaultHomepageSettingsFormValues(): HomepageSettingsFormValues {
  return {
    dailyHighlightBannerEnabled: true,
    dailyHighlightBannerText: DEFAULT_DAILY_HIGHLIGHT_BANNER_TEXT,
    dailyHighlightBannerEndDayKey: '2026-05-31',
  };
}

export function validateHomepageSettingsForm(
  values: HomepageSettingsFormValues,
): HomepageSettingsValidationResult {
  const text = values.dailyHighlightBannerText.trim();
  const endDayKey = values.dailyHighlightBannerEndDayKey.trim();

  if (values.dailyHighlightBannerEnabled && !text) {
    return { error: 'Informe o texto do banner ou desative a exibicao.' };
  }

  if (text.length > 160) {
    return { error: 'O texto do banner deve ter no maximo 160 caracteres.' };
  }

  if (endDayKey && !DAY_KEY_PATTERN.test(endDayKey)) {
    return { error: 'Use a data final no formato AAAA-MM-DD.' };
  }

  return {
    payload: {
      dailyHighlightBannerEnabled: values.dailyHighlightBannerEnabled,
      dailyHighlightBannerText: text,
      dailyHighlightBannerEndDayKey: endDayKey,
    },
  };
}

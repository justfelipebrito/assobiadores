'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc, useAuth, useDocument } from '@batalha/firebase';
import { getClientFirestore } from '@batalha/firebase';
import { Button, Card, CardContent, Input, Skeleton, Textarea } from '@batalha/ui';
import type { HomepageSettings } from '@batalha/types';
import { toast } from 'sonner';
import {
  createDefaultHomepageSettingsFormValues,
  type HomepageSettingsFormValues,
  validateHomepageSettingsForm,
} from './homepage-settings-form';

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { data: settings, loading } = useDocument<HomepageSettings>(
    'platformSettings',
    'homepage',
  );
  const [values, setValues] = useState<HomepageSettingsFormValues>(() =>
    createDefaultHomepageSettingsFormValues(),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;

    setValues({
      dailyHighlightBannerEnabled: Boolean(settings.dailyHighlightBannerEnabled),
      dailyHighlightBannerText: settings.dailyHighlightBannerText ?? '',
      dailyHighlightBannerEndDayKey: settings.dailyHighlightBannerEndDayKey ?? '',
    });
  }, [settings]);

  const setValue = <Key extends keyof HomepageSettingsFormValues>(
    field: Key,
    value: HomepageSettingsFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = validateHomepageSettingsForm(values);
    if (!result.payload) {
      toast.error(result.error ?? 'Revise as configuracoes.');
      return;
    }
    if (!user) {
      toast.error('Entre novamente para salvar as configuracoes.');
      return;
    }

    setSaving(true);
    try {
      const db = getClientFirestore();
      await setDoc(
        doc(db, 'platformSettings', 'homepage'),
        {
          ...result.payload,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true },
      );
      toast.success('Configuracoes salvas.');
    } catch {
      toast.error('Nao foi possivel salvar as configuracoes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
          Configurações
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">Homepage</h1>
        <p className="mt-1 text-sm text-surface-400">
          Controle mensagens e avisos exibidos na página inicial.
        </p>
      </div>

      <Card className="mt-6">
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-12 w-44" />
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={values.dailyHighlightBannerEnabled}
                    onChange={(event) =>
                      setValue('dailyHighlightBannerEnabled', event.target.checked)
                    }
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-surface-900 text-brand-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Exibir banner antes dos Destaques Diários
                    </span>
                    <span className="mt-1 block text-sm text-surface-500">
                      Desative quando a campanha ou aviso não estiver mais ativo.
                    </span>
                  </span>
                </label>
              </div>

              <Textarea
                label="Texto do banner"
                value={values.dailyHighlightBannerText}
                maxLength={160}
                onChange={(event) => setValue('dailyHighlightBannerText', event.target.value)}
                helperText={`${values.dailyHighlightBannerText.length}/160 caracteres`}
              />

              <Input
                label="Mostrar até"
                type="date"
                value={values.dailyHighlightBannerEndDayKey}
                onChange={(event) => setValue('dailyHighlightBannerEndDayKey', event.target.value)}
                helperText="Opcional. Quando vazio, o banner fica ativo até ser desativado."
              />

              <div className="flex justify-end">
                <Button type="submit" loading={saving}>
                  Salvar configurações
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

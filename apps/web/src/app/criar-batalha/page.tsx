'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Swords, Users } from 'lucide-react';
import { useAuth } from '@batalha/firebase';
import { Button, Input, Card, CardContent, Badge } from '@batalha/ui';
import { COMPETITION_CATEGORIES, FREE_TIER_GROUP_CAP } from '@batalha/types';
import { toast } from 'sonner';

const CATEGORIES = COMPETITION_CATEGORIES;
const GROUP_BATTLE_MIN_PARTICIPANTS = 5;

function offsetDate(days: number) {
  const d = new Date(Date.now() + days * 24 * 60 * 60_000);
  // datetime-local format: YYYY-MM-DDTHH:mm
  return d.toISOString().slice(0, 16);
}

export default function CreateBattlePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [format, setFormat] = useState<'group' | 'duel'>('group');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('freestyle');
  const [visibility, setVisibility] = useState<'public' | 'invite_only'>('public');
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [submissionDeadline, setSubmissionDeadline] = useState(offsetDate(6));
  const [votingStart, setVotingStart] = useState(offsetDate(7));
  const [votingEnd, setVotingEnd] = useState(offsetDate(10));
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-surface-400">Faca login para criar uma batalha.</p>
        <Link href="/entrar" className="mt-4 inline-block">
          <Button size="md">Entrar</Button>
        </Link>
      </div>
    );
  }

  const addRule = () => {
    const trimmed = newRule.trim();
    if (!trimmed || rules.length >= 10) return;
    setRules((r) => [...r, trimmed]);
    setNewRule('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/battles/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          description,
          format,
          category,
          visibility,
          maxParticipants: format === 'duel' ? 2 : maxParticipants,
          votingType: 'public',
          submissionDeadline: new Date(submissionDeadline).toISOString(),
          votingStart: new Date(votingStart).toISOString(),
          votingEnd: new Date(votingEnd).toISOString(),
          rules,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar batalha');

      toast.success('Batalha criada!');
      router.push(`/batalhas/${data.battleId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar batalha');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/batalhas"
        className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Batalhas
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Criar batalha</h1>
        <p className="mt-1 text-surface-400">Configure sua batalha de assobio</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Format */}
        <Card>
          <CardContent>
            <p className="mb-3 text-sm font-semibold text-white">Formato</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: 'group',
                  label: 'Grupo',
                  desc: `Até ${FREE_TIER_GROUP_CAP} participantes`,
                  icon: <Users className="h-5 w-5" />,
                },
                {
                  value: 'duel',
                  label: 'Duelo',
                  desc: '1 vs 1 — convite direto',
                  icon: <Swords className="h-5 w-5" />,
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormat(opt.value as 'group' | 'duel')}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                    format === opt.value
                      ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                      : 'border-white/10 bg-white/[0.02] text-surface-400 hover:border-white/20'
                  }`}
                >
                  {opt.icon}
                  <span className="font-semibold text-white">{opt.label}</span>
                  <span className="text-xs text-surface-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Basic info */}
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm font-semibold text-white">Informações</p>
            <Input
              label="Título"
              placeholder="Ex: Batalha Freestyle Aberta"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-300">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva sua batalha, tema, estilo..."
                rows={3}
                maxLength={2000}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-surface-600 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-300">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                      category === cat.value
                        ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30'
                        : 'bg-white/5 text-surface-400 hover:bg-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        {format === 'group' && (
          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-white">Participantes</p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={GROUP_BATTLE_MIN_PARTICIPANTS}
                  max={FREE_TIER_GROUP_CAP}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="flex-1 accent-brand-500"
                />
                <span className="w-12 text-right font-bold text-white">{maxParticipants}</span>
              </div>
              <p className="mt-1 text-xs text-surface-500">
                Máximo de {FREE_TIER_GROUP_CAP} no plano gratuito
              </p>
            </CardContent>
          </Card>
        )}

        {/* Access + voting */}
        <Card>
          <CardContent className="space-y-5">
            <div>
              <p className="mb-3 text-sm font-semibold text-white">Entrada</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { value: 'public', label: 'Aberta', desc: 'Qualquer usuario logado pode participar.' },
                  { value: 'invite_only', label: 'Por convite', desc: 'Somente convidados aparecem como participantes.' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value as 'public' | 'invite_only')}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      visibility === opt.value
                        ? 'border-brand-500/50 bg-brand-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                    }`}
                  >
                    <span className="font-semibold text-white">{opt.label}</span>
                    <span className="mt-1 block text-xs text-surface-500">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-white">Votacao</p>
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-surface-300">
                Comunidade decide o resultado. Em empate, o criador da batalha desempata.
                Participantes nao votam na propria batalha.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm font-semibold text-white">Cronograma</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  label: 'Envios até',
                  value: submissionDeadline,
                  set: setSubmissionDeadline,
                },
                { label: 'Votação começa', value: votingStart, set: setVotingStart },
                { label: 'Votação encerra', value: votingEnd, set: setVotingEnd },
              ].map((field) => (
                <div key={field.label}>
                  <label className="mb-1.5 block text-xs font-medium text-surface-400">
                    {field.label}
                  </label>
                  <input
                    type="datetime-local"
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm font-semibold text-white">
              Regras <span className="text-surface-500 font-normal">(opcional, máx. 10)</span>
            </p>
            {rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-surface-300">
                  {rule}
                </span>
                <button type="button" onClick={() => setRules((r) => r.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-surface-600 hover:text-red-400 transition-colors" />
                </button>
              </div>
            ))}
            {rules.length < 10 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addRule();
                    }
                  }}
                  placeholder="Adicionar regra..."
                  maxLength={200}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-surface-600 focus:border-brand-500/50 focus:outline-none"
                />
                <Button type="button" variant="secondary" size="sm" onClick={addRule}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          <Swords className="mr-2 h-5 w-5" />
          Criar batalha
        </Button>
      </form>
    </div>
  );
}

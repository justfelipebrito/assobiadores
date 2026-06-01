export type AudioPlayerSize = 'default' | 'compact';
export type AudioPlayerVariant = 'default' | 'featured';

export function getPlayerChrome({
  size,
  variant,
}: {
  size: AudioPlayerSize;
  variant: AudioPlayerVariant;
}) {
  if (variant === 'featured') {
    return {
      shell: 'relative flex min-h-[244px] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#13131a]',
      icon: 'h-40 w-40',
      iconWrap: 'right-4 top-1/2 -translate-y-1/2 -rotate-12 opacity-[0.09]',
      content: 'relative z-10 mt-auto p-3',
      waveHeight: 24,
      button:
        'h-9 w-9 rounded-full bg-brand-500 text-white shadow-[0_0_16px_rgba(37,169,114,0.35)] hover:scale-105 hover:bg-brand-400 active:scale-95',
      title: 'text-sm font-black leading-tight text-white sm:text-base',
      meta: 'mt-0.5 text-[11px] font-semibold text-brand-400',
      time: 'mt-1 text-[10px] tabular-nums text-surface-500',
      category:
        'rounded border border-white/[0.10] bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-surface-300',
      result:
        'flex items-center gap-1 rounded bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-black',
    };
  }

  if (size === 'compact') {
    return {
      shell:
        'flex h-full min-h-[112px] w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#13131a]',
      icon: 'h-14 w-14',
      iconWrap: 'inset-0 flex items-center justify-center -rotate-12 opacity-[0.10]',
      content: 'flex min-w-0 flex-1 flex-col justify-between p-2.5',
      waveHeight: 18,
      button:
        'h-8 w-8 rounded-full bg-brand-500 text-white shadow-[0_0_12px_rgba(37,169,114,0.3)] hover:scale-105 hover:bg-brand-400 active:scale-95',
      title: 'text-[13px] font-black leading-tight text-white',
      meta: 'mt-0.5 text-[10px] font-semibold text-brand-400',
      time: 'text-[10px] tabular-nums text-surface-500',
      category:
        'rounded border border-white/[0.10] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-surface-300',
      result:
        'mb-1 flex w-fit items-center gap-1 rounded bg-yellow-500 px-1.5 py-0.5 text-[9px] font-bold text-black',
    };
  }

  return {
    shell:
      'relative flex min-h-[180px] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#13131a]',
    icon: 'h-28 w-28',
    iconWrap: 'right-4 top-1/2 -translate-y-1/2 -rotate-12 opacity-[0.08]',
    content: 'relative z-10 mt-auto p-4',
    waveHeight: 34,
    button:
      'h-10 w-10 rounded-full bg-brand-500 text-white shadow-[0_0_16px_rgba(37,169,114,0.35)] hover:scale-105 hover:bg-brand-400 active:scale-95',
    title: 'text-base font-black leading-tight text-white',
    meta: 'mt-1 text-xs font-semibold text-brand-400',
    time: 'mt-1 text-xs tabular-nums text-surface-500',
    category:
      'rounded border border-white/[0.10] bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-surface-300',
    result:
      'flex items-center gap-1 rounded bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-black',
  };
}

export function getAudioPlayerWaveBarCount({
  size,
  variant,
}: {
  size: AudioPlayerSize;
  variant: AudioPlayerVariant;
}) {
  if (size === 'compact') return 18;
  if (variant === 'featured') return 40;
  return 36;
}

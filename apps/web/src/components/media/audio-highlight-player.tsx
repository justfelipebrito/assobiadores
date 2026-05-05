'use client';

import { useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Badge } from '@batalha/ui';
import { COMPETITION_CATEGORY_LABELS, type CompetitionCategory } from '@batalha/types';

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const remaining = String(safe % 60).padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function buildWave(seed: string) {
  return Array.from({ length: 36 }).map((_, index) => {
    const char = seed.charCodeAt(index % Math.max(seed.length, 1)) || 7;
    return 18 + ((char + index * 13) % 46);
  });
}

export function AudioHighlightPlayer({
  src,
  username,
  naturalidade,
  category,
  durationSeconds,
  voteCount,
  size = 'default',
  showHeader = true,
}: {
  src: string;
  username: string;
  naturalidade?: string | null;
  category: CompetitionCategory;
  durationSeconds?: number | null;
  voteCount?: number | null;
  size?: 'default' | 'compact';
  showHeader?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(durationSeconds ?? 0);
  const wave = useMemo(() => buildWave(`${src}-${username}`), [src, username]);
  const duration = loadedDuration || durationSeconds || 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <div
      className={`flex w-full flex-col justify-between rounded-xl border border-white/10 bg-surface-900 ${
        size === 'compact' ? 'h-full p-3' : 'aspect-video p-4'
      }`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setLoadedDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
      />

      {showHeader && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              <span className="text-white">{username}</span>
              {naturalidade ? <span className="text-surface-400"> - {naturalidade}</span> : null}
            </p>
            {typeof voteCount === 'number' && (
              <p className="mt-1 text-xs font-medium text-surface-500">
                {voteCount} {voteCount === 1 ? 'voto' : 'votos'}
              </p>
            )}
          </div>
          <Badge variant="purple">{COMPETITION_CATEGORY_LABELS[category]}</Badge>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className={`inline-flex flex-shrink-0 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-300 transition-colors hover:bg-brand-500/20 ${
            size === 'compact' ? 'h-9 w-9' : 'h-10 w-10'
          }`}
          aria-label={playing ? 'Pausar audio' : 'Tocar audio'}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <div
          className={`flex w-full items-center gap-1 overflow-hidden rounded-lg bg-black/20 px-3 ${
            size === 'compact' ? 'h-12' : 'h-16'
          }`}
        >
          {wave.map((height, index) => {
            const active = index / wave.length <= progress;
            return (
              <div
                key={index}
                className={`w-full rounded-full transition-colors ${
                  active ? 'bg-brand-400' : 'bg-white/15'
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      </div>

      <p className="text-xs tabular-nums text-surface-400">
        {formatTime(currentTime)} / {formatTime(duration)}
      </p>
    </div>
  );
}

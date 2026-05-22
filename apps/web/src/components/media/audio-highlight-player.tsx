'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { Badge } from '@batalha/ui';
import { COMPETITION_CATEGORY_LABELS, type CompetitionCategory } from '@batalha/types';
import { formatDurationLabel, formatTime, getValidDuration } from '@/lib/audio-duration';

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
  resultLabel,
}: {
  src: string;
  username: string;
  naturalidade?: string | null;
  category: CompetitionCategory;
  durationSeconds?: number | null;
  voteCount?: number | null;
  size?: 'default' | 'compact';
  showHeader?: boolean;
  resultLabel?: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState<number | null>(
    getValidDuration(durationSeconds),
  );
  const wave = useMemo(() => buildWave(`${src}-${username}`), [src, username]);
  const duration = loadedDuration ?? getValidDuration(durationSeconds);
  const progress = duration !== null && duration > 0 ? Math.min(1, currentTime / duration) : 0;

  useEffect(() => {
    setPlaying(false);
    setLoading(false);
    setPlaybackError(null);
    setCurrentTime(0);
    setLoadedDuration(getValidDuration(durationSeconds));
    audioRef.current?.load();
  }, [durationSeconds, src]);

  function syncDuration(audio: HTMLAudioElement) {
    const nextDuration = getValidDuration(audio.duration);
    if (nextDuration !== null) setLoadedDuration(nextDuration);
    setLoading(false);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        setPlaybackError(null);
        setLoading(true);
        if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          audio.load();
        }
        await audio.play();
        setPlaying(true);
      } catch (error) {
        console.error('Audio playback failed', error);
        setPlaying(false);
        setLoading(false);
        setPlaybackError('Nao foi possivel tocar este audio. Tente novamente.');
      }
    } else {
      audio.pause();
      setPlaying(false);
      setLoading(false);
    }
  }

  return (
    <div
      className={`flex w-full flex-col justify-between ${
        size === 'compact'
          ? 'h-full rounded-xl border border-white/10 bg-black/20 p-3 backdrop-blur-sm'
          : 'aspect-video rounded-xl border border-white/10 bg-surface-900 p-4'
      }`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => syncDuration(event.currentTarget)}
        onDurationChange={(event) => syncDuration(event.currentTarget)}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => {
          setLoading(false);
          setPlaying(true);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setLoading(false);
        }}
        onError={() => {
          setPlaying(false);
          setLoading(false);
          setPlaybackError('Nao foi possivel carregar este audio.');
        }}
      />

      {resultLabel && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-400">
          {resultLabel}
        </p>
      )}

      {showHeader && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`${size === 'compact' ? 'text-xs' : 'text-sm'} truncate font-semibold`}>
              <span className="text-white">{username}</span>
              {naturalidade ? <span className="text-surface-400"> - {naturalidade}</span> : null}
            </p>
            {typeof voteCount === 'number' && (
              <p className="mt-1 text-xs font-medium text-surface-500">
                {voteCount} {voteCount === 1 ? 'voto' : 'votos'}
              </p>
            )}
          </div>
          {size === 'compact' ? (
            <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-surface-300">
              {COMPETITION_CATEGORY_LABELS[category]}
            </span>
          ) : (
            <Badge variant="purple">{COMPETITION_CATEGORY_LABELS[category]}</Badge>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className={`inline-flex flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
            size === 'compact'
              ? 'h-10 w-10 border border-white/15 bg-white/10 text-white hover:border-brand-400/50 hover:bg-brand-500/20 hover:text-brand-200'
              : 'h-10 w-10 border border-brand-500/30 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20'
          }`}
          aria-label={playing ? 'Pausar audio' : 'Tocar audio'}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>

        <div
          className={`flex w-full items-center gap-1 overflow-hidden rounded-lg bg-black/20 px-3 ${
            size === 'compact' ? 'h-10' : 'h-16'
          }`}
        >
          {wave.map((height, index) => {
            const active = index / wave.length <= progress;
            return (
              <div
                key={index}
                className={`w-full rounded-full transition-colors ${
                  active ? 'bg-brand-300' : 'bg-white/20'
                }`}
                style={{ height: `${size === 'compact' ? Math.max(20, height - 8) : height}%` }}
              />
            );
          })}
        </div>
      </div>

      <p
        className={`tabular-nums text-surface-400 ${
          size === 'compact' ? 'text-[11px]' : 'text-xs'
        }`}
      >
        {formatTime(currentTime)} / {formatDurationLabel(duration)}
      </p>
      {playbackError && <p className="text-xs text-red-300">{playbackError}</p>}
    </div>
  );
}

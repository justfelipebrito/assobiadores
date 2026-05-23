'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Crown, Loader2, Music2, Pause, Play } from 'lucide-react';
import { COMPETITION_CATEGORY_LABELS, type CompetitionCategory } from '@batalha/types';
import { formatDurationLabel, formatTime, getValidDuration } from '@/lib/audio-duration';
import {
  clearExclusiveAudioPlayback,
  getSeekRatioFromClientX,
  getSeekTimeFromRatio,
  requestExclusiveAudioPlayback,
  subscribeToExclusiveAudioPlayback,
} from '@/lib/audio-playback-coordinator';

type AudioPlayerSize = 'default' | 'compact';
type AudioPlayerVariant = 'default' | 'featured';

function buildWave(seed: string, count: number) {
  return Array.from({ length: count }).map((_, index) => {
    const char = seed.charCodeAt(index % Math.max(seed.length, 1)) || 7;
    return 15 + ((char + index * 13) % 70);
  });
}

function getPlayerChrome({ size, variant }: { size: AudioPlayerSize; variant: AudioPlayerVariant }) {
  if (variant === 'featured') {
    return {
      shell: 'relative flex min-h-[244px] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#13131a]',
      icon: 'h-40 w-40',
      iconWrap: 'right-4 top-1/2 -translate-y-1/2 -rotate-12 opacity-[0.09]',
      content: 'relative z-10 mt-auto p-3',
      waveHeight: 24,
      button: 'h-9 w-9 rounded-full bg-brand-500 text-white shadow-[0_0_16px_rgba(37,169,114,0.35)] hover:scale-105 hover:bg-brand-400 active:scale-95',
      title: 'text-sm font-black leading-tight text-white sm:text-base',
      meta: 'mt-0.5 text-[11px] font-semibold text-brand-400',
      time: 'mt-1 text-[10px] tabular-nums text-surface-500',
      category: 'rounded border border-white/[0.10] bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-surface-300',
      result: 'flex items-center gap-1 rounded bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-black',
    };
  }

  if (size === 'compact') {
    return {
      shell: 'flex h-full min-h-[114px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#13131a]',
      icon: 'h-14 w-14',
      iconWrap: 'inset-0 flex items-center justify-center -rotate-12 opacity-[0.10]',
      content: 'flex flex-1 flex-col justify-between p-2.5',
      waveHeight: 18,
      button: 'h-8 w-8 rounded-full bg-brand-500 text-white shadow-[0_0_12px_rgba(37,169,114,0.3)] hover:scale-105 hover:bg-brand-400 active:scale-95',
      title: 'text-[13px] font-black leading-tight text-white',
      meta: 'mt-0.5 text-[10px] font-semibold text-brand-400',
      time: 'text-[10px] tabular-nums text-surface-500',
      category: 'rounded border border-white/[0.10] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-surface-300',
      result: 'mb-1 flex w-fit items-center gap-1 rounded bg-yellow-500 px-1.5 py-0.5 text-[9px] font-bold text-black',
    };
  }

  return {
    shell: 'relative flex min-h-[180px] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#13131a]',
    icon: 'h-28 w-28',
    iconWrap: 'right-4 top-1/2 -translate-y-1/2 -rotate-12 opacity-[0.08]',
    content: 'relative z-10 mt-auto p-4',
    waveHeight: 34,
    button: 'h-10 w-10 rounded-full bg-brand-500 text-white shadow-[0_0_16px_rgba(37,169,114,0.35)] hover:scale-105 hover:bg-brand-400 active:scale-95',
    title: 'text-base font-black leading-tight text-white',
    meta: 'mt-1 text-xs font-semibold text-brand-400',
    time: 'mt-1 text-xs tabular-nums text-surface-500',
    category: 'rounded border border-white/[0.10] bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-surface-300',
    result: 'flex items-center gap-1 rounded bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-black',
  };
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
  variant = 'default',
}: {
  src: string;
  username: string;
  naturalidade?: string | null;
  category: CompetitionCategory;
  durationSeconds?: number | null;
  voteCount?: number | null;
  size?: AudioPlayerSize;
  showHeader?: boolean;
  resultLabel?: string | null;
  variant?: AudioPlayerVariant;
}) {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState<number | null>(
    getValidDuration(durationSeconds),
  );
  const chrome = getPlayerChrome({ size, variant });
  const wave = useMemo(
    () => buildWave(`${src}-${username}`, size === 'compact' ? 24 : variant === 'featured' ? 40 : 36),
    [size, src, username, variant],
  );
  const duration = loadedDuration ?? getValidDuration(durationSeconds);
  const progress = duration !== null && duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const canSeek = duration !== null && duration > 0;

  useEffect(() => {
    return subscribeToExclusiveAudioPlayback((activePlayerId) => {
      const audio = audioRef.current;
      if (activePlayerId !== playerId && audio && !audio.paused) {
        audio.pause();
      }
    });
  }, [playerId]);

  useEffect(() => {
    setPlaying(false);
    setLoading(false);
    setPlaybackError(null);
    setCurrentTime(0);
    setLoadedDuration(getValidDuration(durationSeconds));
    clearExclusiveAudioPlayback(playerId);
    audioRef.current?.load();
    return () => clearExclusiveAudioPlayback(playerId);
  }, [durationSeconds, playerId, src]);

  function syncDuration(audio: HTMLAudioElement) {
    const nextDuration = getValidDuration(audio.duration);
    if (nextDuration !== null) setLoadedDuration(nextDuration);
    setLoading(false);
  }

  function seekTo(clientX: number) {
    const audio = audioRef.current;
    const waveElement = waveRef.current;
    if (!audio || !waveElement || !canSeek) return;

    const rect = waveElement.getBoundingClientRect();
    const ratio = getSeekRatioFromClientX({ clientX, left: rect.left, width: rect.width });
    const nextTime = getSeekTimeFromRatio({ ratio, durationSeconds: duration });
    if (nextTime === null) return;

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function seekBy(seconds: number) {
    const audio = audioRef.current;
    if (!audio || duration === null || duration <= 0) return;
    const nextTime = Math.min(duration, Math.max(0, currentTime + seconds));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        setPlaybackError(null);
        setLoading(true);
        requestExclusiveAudioPlayback(playerId);
        if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          audio.load();
        }
        await audio.play();
        setPlaying(true);
      } catch (error) {
        console.error('Audio playback failed', error);
        setPlaying(false);
        setLoading(false);
        clearExclusiveAudioPlayback(playerId);
        setPlaybackError('Nao foi possivel tocar este audio. Tente novamente.');
      }
    } else {
      audio.pause();
      setPlaying(false);
      setLoading(false);
      clearExclusiveAudioPlayback(playerId);
    }
  }

  const playerBody = (
    <>
      {showHeader && size !== 'compact' && (
        <div className="relative z-10 flex items-center gap-1.5 p-3 pb-0">
          <span className={chrome.category}>{COMPETITION_CATEGORY_LABELS[category]}</span>
          {resultLabel && (
            <span className={chrome.result}>
              <Crown className="h-2.5 w-2.5" />
              {resultLabel}
            </span>
          )}
        </div>
      )}

      <div className={chrome.content}>
        {showHeader && (
          <div>
            {size === 'compact' && resultLabel && (
              <span className={chrome.result}>
                <Crown className="h-2 w-2" />
                {resultLabel}
              </span>
            )}
            <h3 className={`${chrome.title} truncate`}>
              {username}
              {naturalidade && <span className="text-brand-400"> - {naturalidade}</span>}
            </h3>
            {typeof voteCount === 'number' && (
              <p className={chrome.meta}>
                {voteCount} {voteCount === 1 ? 'voto' : 'votos'}
              </p>
            )}
          </div>
        )}

        <div
          className={`${
            showHeader ? (size === 'compact' ? 'mt-2' : 'mt-3') : ''
          } flex items-center gap-2.5`}
        >
          <div
            ref={waveRef}
            role="slider"
            tabIndex={canSeek ? 0 : -1}
            aria-label="Selecionar trecho do audio"
            aria-valuemin={0}
            aria-valuemax={duration ?? 0}
            aria-valuenow={Math.floor(currentTime)}
            aria-disabled={!canSeek}
            onPointerDown={(event) => {
              if (!canSeek) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              seekTo(event.clientX);
            }}
            onPointerMove={(event) => {
              if (!canSeek || event.buttons !== 1) return;
              seekTo(event.clientX);
            }}
            onKeyDown={(event) => {
              if (!canSeek || duration === null) return;
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                seekBy(-5);
              } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                seekBy(5);
              } else if (event.key === 'Home') {
                event.preventDefault();
                seekBy(-duration);
              } else if (event.key === 'End') {
                event.preventDefault();
                seekBy(duration);
              }
            }}
            className={`flex flex-1 items-end gap-[2px] overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70 ${
              canSeek ? 'cursor-pointer' : 'cursor-default'
            }`}
            style={{ height: chrome.waveHeight }}
          >
            {wave.map((height, index) => {
              const active = index / wave.length <= progress;
              return (
                <div
                  key={index}
                  className={`flex-1 rounded-full transition-colors duration-150 ${
                    active ? 'bg-brand-400' : 'bg-white/[0.14]'
                  }`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={togglePlayback}
            className={`flex flex-shrink-0 items-center justify-center transition-transform ${chrome.button}`}
            aria-label={playing ? 'Pausar audio' : 'Tocar audio'}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" />
            )}
          </button>
        </div>

        <p className={chrome.time}>
          {formatTime(currentTime)} / {formatDurationLabel(duration)}
        </p>
        {playbackError && <p className="mt-1 text-xs text-red-300">{playbackError}</p>}
      </div>
    </>
  );

  return (
    <div className={chrome.shell}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => syncDuration(event.currentTarget)}
        onDurationChange={(event) => syncDuration(event.currentTarget)}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => {
          requestExclusiveAudioPlayback(playerId);
          setLoading(false);
          setPlaying(true);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setLoading(false);
          clearExclusiveAudioPlayback(playerId);
          setCurrentTime(0);
        }}
        onError={() => {
          setPlaying(false);
          setLoading(false);
          clearExclusiveAudioPlayback(playerId);
          setPlaybackError('Nao foi possivel carregar este audio.');
        }}
      />

      {size === 'compact' ? (
        <>
          <div className="relative w-[40%] flex-shrink-0 bg-[#0c0c13]">
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#0c0c13] to-transparent" />
            <div className={`pointer-events-none absolute ${chrome.iconWrap}`}>
              <Music2 className={`${chrome.icon} text-white`} />
            </div>
            {showHeader && (
              <div className="absolute bottom-2 left-2 z-10">
                <span className={chrome.category}>{COMPETITION_CATEGORY_LABELS[category]}</span>
              </div>
            )}
          </div>
          {playerBody}
        </>
      ) : (
        <>
          <div className={`pointer-events-none absolute ${chrome.iconWrap}`}>
            <Music2 className={`${chrome.icon} text-white`} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#13131a] to-transparent" />
          {playerBody}
        </>
      )}
    </div>
  );
}

'use client';

import type { CompetitionCategory } from '@batalha/types';
import { VideoPreview } from '@/components/video/video-preview';
import { AudioHighlightPlayer } from './audio-highlight-player';

export function MediaPreview({
  mediaType,
  mediaURL,
  videoURL,
  username,
  naturalidade,
  category = 'freestyle',
  durationSeconds,
  voteCount,
  size,
  resultLabel,
}: {
  mediaType?: 'audio' | 'video';
  mediaURL?: string | null;
  videoURL?: string | null;
  username: string;
  naturalidade?: string | null;
  category?: CompetitionCategory;
  durationSeconds?: number | null;
  voteCount?: number | null;
  size?: 'default' | 'compact';
  resultLabel?: string | null;
}) {
  if (mediaType === 'audio' && mediaURL) {
    return (
      <AudioHighlightPlayer
        src={mediaURL}
        username={username}
        naturalidade={naturalidade}
        category={category}
        durationSeconds={durationSeconds}
        voteCount={voteCount}
        size={size}
        resultLabel={resultLabel}
      />
    );
  }

  return (
    <div className={size === 'compact' ? 'h-full overflow-hidden rounded-xl' : undefined}>
      <VideoPreview url={videoURL ?? mediaURL ?? ''} />
    </div>
  );
}

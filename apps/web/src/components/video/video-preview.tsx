'use client';

import { extractYouTubeId, detectVideoPlatform } from '@batalha/utils';

export function VideoPreview({ url }: { url: string }) {
  const platform = detectVideoPlatform(url);
  const youtubeId = extractYouTubeId(url);

  if (!url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-sm text-surface-500">
        Preview do video
      </div>
    );
  }

  if (platform === 'youtube' && youtubeId) {
    return (
      <iframe
        className="aspect-video w-full rounded-xl border border-white/10"
        src={`https://www.youtube.com/embed/${youtubeId}`}
        title="Preview do video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-surface-400">Preview incorporado indisponivel para esta plataforma.</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block break-all text-sm font-medium text-brand-400 hover:text-brand-300"
      >
        {url}
      </a>
    </div>
  );
}

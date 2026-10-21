import type { VideoItem } from './video';
import type { AudioItem } from './audio';
import type { DocItem } from './doc';

export type MediaTab = 'videos' | 'audios' | 'docs' | 'drive';

/** View model only. Each source retains the schema of its own collection. */
export type MediaItem = {
  path: string;
  url: string;
  duration?: number;
  thumbnailUrl?: string;
} & (
  | { type: 'video'; source: VideoItem }
  | { type: 'audio'; source: AudioItem }
  | { type: 'doc'; source: DocItem }
);

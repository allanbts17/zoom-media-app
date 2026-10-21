import type { VideoItem, AudioItem, DocItem, MediaItem } from '../interfaces';

export function videoToMediaItem(video: VideoItem): MediaItem {
  return {
    type: 'video', path: video.videoPath, url: video.videoUrl,
    duration: video.duration, thumbnailUrl: video.thumbnailUrl, source: video,
  };
}

export function audioToMediaItem(audio: AudioItem): MediaItem {
  return {
    type: 'audio', path: audio.audioPath, url: audio.audioUrl,
    duration: audio.duration, source: audio,
  };
}

export function docToMediaItem(doc: DocItem): MediaItem {
  return { type: 'doc', path: doc.docPath, url: doc.docUrl, source: doc };
}

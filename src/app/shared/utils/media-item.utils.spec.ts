import { videoToMediaItem, audioToMediaItem, docToMediaItem } from './media-item.utils';

describe('media item adapters', () => {
  it('keeps the original video document for backend operations', () => {
    const video = {videoPath:'videos/a.mp4',videoUrl:'video-url',duration:10,thumbnailPath:'thumbnails/a.jpg',thumbnailUrl:'thumb-url'};
    const row = videoToMediaItem(video);
    expect(row.path).toBe(video.videoPath);
    expect(row.url).toBe(video.videoUrl);
    expect(row.source).toBe(video);
    expect(row.type).toBe('video');
    expect(row.thumbnailUrl).toBe(video.thumbnailUrl);
  });

  it('maps audio without video fields or thumbnails', () => {
    const audio = {audioPath:'audios/a.mp3',audioUrl:'audio-url',duration:20};
    const row = audioToMediaItem(audio);
    expect(row.path).toBe(audio.audioPath);
    expect(row.url).toBe(audio.audioUrl);
    expect(row.source).toBe(audio);
    expect(row.thumbnailUrl).toBeUndefined();
    expect('videoPath' in row).toBeFalse();
  });

  it('maps documents independently of playback duration', () => {
    const doc = {docPath:'docs/a.pptx',docUrl:'doc-url'};
    const row = docToMediaItem(doc);
    expect(row.path).toBe(doc.docPath);
    expect(row.url).toBe(doc.docUrl);
    expect(row.type).toBe('doc');
    expect(row.source).toBe(doc);
    expect(row.duration).toBeUndefined();
  });
});

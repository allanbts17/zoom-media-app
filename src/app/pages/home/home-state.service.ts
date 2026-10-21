import { videoToMediaItem, audioToMediaItem } from '../../shared/utils/media-item.utils';
import { inject, Injectable, signal } from '@angular/core';
import { BackendService } from '../../shared/services/backend.service';
import { MediaItem, VideoList, ZoomBotAction, AudioItem, VideoItem, MediaTab } from '../../shared/interfaces';

/** Only state used by multiple home layouts; one instance per HomePage. */
@Injectable()
export class HomeStateService {
  private readonly backend = inject(BackendService);


  readonly activeTab = signal<MediaTab>('videos');
  audios: AudioItem[] = [];
  audioLoading = true;
  globalAudioOrder: string[] = [];
  readonly audioSearchQuery = signal('');
  mediaItemsFor(kind: 'video' | 'audio'): MediaItem[] {
    return kind === 'audio' ? this.audios.map(audioToMediaItem) : this.videos.map(videoToMediaItem);
  }
  get mediaItems(): MediaItem[] {
    return this.mediaItemsFor(this.activeTab() === 'audios' ? 'audio' : 'video');
  }
  get pathsKey(): 'videoPaths' | 'audioPaths' { return this.activeTab() === 'audios' ? 'audioPaths' : 'videoPaths'; }
  get mediaOrder(): string[] { return this.activeTab() === 'audios' ? this.globalAudioOrder : this.globalVideoOrder; }
  set mediaOrder(value: string[]) { if(this.activeTab() === 'audios') this.globalAudioOrder = value; else this.globalVideoOrder = value; }
  get mediaQuery() { return this.activeTab() === 'audios' ? this.audioSearchQuery : this.videoSearchQuery; }
  loading = true;
  videos: VideoItem[] = [];
  selectedMap: Record<string, boolean> = {};
  playing = false;
  busyRow = '';
  botId = '';
  videoLists: VideoList[] = [];
  activeListId = signal<string>('all');
  reorderMode = false;
  globalVideoOrder: string[] = [];
  err = '';
  driveSearchQuery = signal('');
  readonly videoSearchQuery = signal('');
  botMaxSessionSeconds!: number;
  botWaitingRoomTimeoutSeconds!: number;
  playbackId = '';
  botAction: ZoomBotAction | '' = ''

  /** Persist playback configuration shared by meeting and video controls. */
  updateConfig() {
    return this.backend.setConfig({
      botId: this.botId,
      busyRow: this.busyRow,
      playing: this.playing,
      playbackId: this.playbackId,
      botAction: this.botAction
    });
  }
}

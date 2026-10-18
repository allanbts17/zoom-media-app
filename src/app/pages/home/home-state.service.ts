import { inject, Injectable, signal } from '@angular/core';
import { BackendService } from '../../shared/services/backend.service';
import { VideoItem, VideoList, ZoomBotAction } from '../../shared/interfaces';

/** Only state used by multiple home layouts; one instance per HomePage. */
@Injectable()
export class HomeStateService {
  private readonly backend = inject(BackendService);


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

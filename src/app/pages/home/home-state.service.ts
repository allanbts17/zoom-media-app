import { ZoomBotRuntime } from '../../shared/interfaces/zoom-bot-runtime';
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
  mediaRequestVersion = 0;
  mediaChangeMessage = '';
  syncManaged = false;
  syncFresh = false;
  syncMessage = '';
  syncBotStatus = '';
  syncCanPauseResume = false;
  syncPreparing = false;
  private syncReadFailed = false;
  private sharedRuntime?: ZoomBotRuntime;

  applyRuntime(value: ZoomBotRuntime | undefined, now = Date.now()) {
    if (!value || value.schema_version !== 1) return;
    const previous = this.sharedRuntime;
    if (previous?.publisher_id === value.publisher_id && value.sequence <= previous.sequence) return;
    this.sharedRuntime = value;
    this.syncReadFailed = false;
    this.syncManaged = true;
    // A confirmed agent snapshot supersedes any in-flight browser response.
    ++this.mediaRequestVersion;
    this.checkRuntimeFreshness(now);
    if (!this.syncFresh) return;
    const bot = value.bot;
    this.botId = bot && !bot.resource_released ? bot.bot_id : '';
    this.syncBotStatus = bot?.status ?? '';
    this.playbackId = bot?.playback.playback_id ?? '';
    const status = bot?.playback.status;
    this.playing = status === 'playing';
    this.syncCanPauseResume = status === 'paused' ? !!bot?.playback.can_resume : !!bot?.playback.can_pause;
    this.botAction = status === 'paused' ? 'pause' : status === 'playing' ? 'play' : 'stop';
    this.syncPreparing = value.preparation?.status === 'preparing';
    this.busyRow = this.syncPreparing ? value.preparation?.media_path ?? '__preparing__' : '';
    if (value.preparation?.status === 'preparing') {
      this.mediaChangeMessage = 'Preparando ' + (value.preparation.media_path ?? 'medio') + (this.playing ? '; el medio actual continúa.' : '…');
    } else if (value.preparation?.status === 'failed') {
      this.mediaChangeMessage = 'No se pudo preparar el siguiente medio; consulta el error.';
      this.err = value.preparation.error?.code ?? 'Error preparando el medio';
    } else {
      this.mediaChangeMessage = status === 'playing' ? 'Reproduciendo ' + (value.media_path ?? 'medio') :
        status === 'paused' ? 'Reproducción pausada.' : status === 'finished' ? 'Reproducción finalizada.' :
        status === 'failed' ? 'La reproducción falló.' : '';
    }
  }

  runtimeReadError() {
    this.syncReadFailed = true;
    this.syncFresh = false;
    ++this.mediaRequestVersion;
    this.busyRow = '';
    this.syncMessage = 'No se pudo leer el estado compartido del bot.';
  }

  checkRuntimeFreshness(now = Date.now()) {
    if (!this.sharedRuntime) return;
    const wasFresh = this.syncFresh;
    this.syncFresh = !this.syncReadFailed && this.sharedRuntime.agent_online && now / 1000 < this.sharedRuntime.expires_at;
    if (wasFresh && !this.syncFresh) ++this.mediaRequestVersion;
    this.syncMessage = this.syncFresh ? '' : 'Estado sin confirmar: el agente está desconectado o dejó de actualizarse.';
    if (!this.syncFresh) {
      this.busyRow = '';
      this.mediaChangeMessage = '';
    }
  }
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
      playing: this.playing,
      playbackId: this.playbackId,
      botAction: this.botAction
    });
  }
}

import { DestroyRef, Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ZoomBotService } from '../../../shared/services/zoom-bot.service';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { reorderVisiblePaths } from '../../../shared/utils/media-list.utils';
import { HomeStateService } from '../../../pages/home/home-state.service';
import { BackendService } from '../../../shared/services/backend.service';
import { MediaItem } from '../../../shared/interfaces';

/** Shared playback and ordering behavior; provided only through the media layout.
 * Collection documents are adapted to neutral MediaItem rows. */
@Injectable()
export abstract class MediaPlaybackService {
  abstract readonly kind: 'video' | 'audio';
  readonly state = inject(HomeStateService);
  private readonly backend = inject(BackendService);
  private readonly zoom = inject(ZoomBotService);
  private readonly destroyRef = inject(DestroyRef);

  get pathsKey(): 'videoPaths' | 'audioPaths' { return this.kind === 'audio' ? 'audioPaths' : 'videoPaths'; }
  get items(): MediaItem[] { return this.state.mediaItemsFor(this.kind); }
  get order() { return this.kind === 'audio' ? this.state.globalAudioOrder : this.state.globalVideoOrder; }
  set order(value: string[]) { if(this.kind === 'audio') this.state.globalAudioOrder = value; else this.state.globalVideoOrder = value; }
  private readonly normalizedQuery = computed(() => this.normalizeName((this.kind === 'audio' ? this.state.audioSearchQuery() : this.state.videoSearchQuery())));

  private normalizeName(name: string): string {
    // nogrep: js-incomplete-html-attribute-sanitization
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  get displayedMedia(): MediaItem[] {
    const query = this.normalizedQuery();
    return query
      ? this.orderedMedia.filter(video => this.normalizeName(this.getName(video.path) ?? '').includes(query))
      : this.orderedMedia;
  }

  private get orderedMedia(): MediaItem[] {
    let list: MediaItem[] = [];
    let order: string[] = [];

    if (this.state.activeListId() === 'all') {
      list = [...this.items];
      order = this.order;
    } else {
      const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
      if (activeList) {
        order = activeList[this.pathsKey] ?? [];
        list = this.items.filter(v => order.includes(v.path));
      } else {
        list = [...this.items];
      }
    }

    if (order && order.length > 0) {
      list.sort((a, b) => {
        const indexA = order.indexOf(a.path);
        const indexB = order.indexOf(b.path);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }

    return list;
  }

  drop(event: CdkDragDrop<MediaItem[]>) {
    if (!this.state.reorderMode) return;
    const newOrder = reorderVisiblePaths(this.orderedMedia.map(v => v.path), this.displayedMedia.map(v => v.path), event.previousIndex, event.currentIndex);
    if (this.state.activeListId() === 'all') {
      this.order = newOrder;
    } else {
      const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
      if (activeList) activeList[this.pathsKey] = newOrder;
    }
  }

  toggle(name: string) {
    this.state.selectedMap[name] = !this.state.selectedMap[name];
    this.state.selectedMap = { ...this.state.selectedMap };
  }

  async playSingle(v: MediaItem) {
    if (this.state.syncManaged && !this.state.syncFresh) { this.state.err = 'Espera a confirmar el estado del agente'; return; }
    if (v.type !== this.kind) { this.state.err = 'Tipo de medio incompatible'; return; }
    if (!this.state.botId) { this.state.err = 'Crea el bot primero'; return; }
    const version = ++this.state.mediaRequestVersion;
    const bot = this.state.botId;
    this.state.err = '';
    this.state.busyRow = v.path;
    this.state.mediaChangeMessage = 'Preparando ' + this.getName(v.path) + (this.state.playbackId ? '; el medio actual continúa.' : '…');
    try {
      // Send play immediately: browser metadata and Firestore are outside the critical path.
      const ticket = await firstValueFrom(this.backend.play(bot, this.kind, v.url));
      if (!ticket.operation_id) throw new Error('La API no devolvió operation_id');
      const deadline = Date.now() + 60000;
      while (version === this.state.mediaRequestVersion && !this.destroyRef.destroyed) {
        const operation = await firstValueFrom(this.zoom.getOperation(ticket.operation_id));
        if (version !== this.state.mediaRequestVersion || bot !== this.state.botId || this.destroyRef.destroyed) return;
        if (operation.status === 'succeeded') {
          this.state.botAction = 'play';
          this.state.playbackId = ticket.playback_id ?? '';
          this.state.playing = true;
          this.state.mediaChangeMessage = 'Reproduciendo ' + this.getName(v.path);
          await this.state.updateConfig();
          return;
        }
        if (operation.status === 'failed' || operation.status === 'cancelled') {
          throw new Error(operation.error?.code ?? 'No se pudo iniciar el medio');
        }
        if (Date.now() >= deadline) throw new Error('La preparación sigue pendiente; consulta el estado del bot antes de reintentar.');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error: any) {
      if (version === this.state.mediaRequestVersion) {
        this.state.err = error?.error?.error?.code ?? error?.message ?? 'Error preparando el medio';
        this.state.mediaChangeMessage = 'No se pudo confirmar el cambio de medio.';
      }
    } finally {
      if (version === this.state.mediaRequestVersion) this.state.busyRow = '';
    }
  }

  getName(path: string): string {
    const parts = path.split('/');
    return parts.slice(1).join('/') || path;
  }
}

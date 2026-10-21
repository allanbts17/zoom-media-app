import { Injectable, computed, inject } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { reorderVisiblePaths } from '../../../shared/utils/media-list.utils';
import { HomeStateService } from '../../../pages/home/home-state.service';
import { BackendService } from '../../../shared/services/backend.service';
import { MediaItem, ZoomBotTicket } from '../../../shared/interfaces';

/** Shared playback and ordering behavior; provided only through the media layout.
 * Collection documents are adapted to neutral MediaItem rows. */
@Injectable()
export abstract class MediaPlaybackService {
  abstract readonly kind: 'video' | 'audio';
  readonly state = inject(HomeStateService);
  private readonly backend = inject(BackendService);

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
    if (v.type !== this.kind) { this.state.err = 'Tipo de medio incompatible'; return; }
    if (!this.state.botId) { this.state.err = 'Crea el bot primero'; return; }
    try {
      this.state.busyRow = v.path;
      await this.state.updateConfig()
      if (v.duration == null) {
        try { v.duration = await this.loadDuration(v.url); } catch { }
      }
      const res: ZoomBotTicket = await this.backend.play(this.state.botId, this.kind, v.url).toPromise() as ZoomBotTicket
      this.state.botAction = res.action
      this.state.playbackId = res?.playback_id as string;

    } catch (e: any) {
      this.state.err = e?.message ?? 'Error reproduciendo';
    } finally {
      this.state.busyRow = '';
      await this.state.updateConfig();
    }
  }

  private loadDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const v = document.createElement(this.kind);
      v.preload = 'metadata';
      v.src = url;
      const cleanup = () => { v.src = ''; v.remove(); };
      v.onloadedmetadata = () => {
        const d = v.duration; cleanup();
        isFinite(d) ? resolve(d) : reject(new Error('No duration'));
      };
      v.onerror = () => { cleanup(); reject(new Error('Metadata load error')); };
    });
  }

  getName(path: string): string {
    const parts = path.split('/');
    return parts.slice(1).join('/') || path;
  }
}

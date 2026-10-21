import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDropList, CdkDragHandle, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { HomeStateService } from '../../pages/home/home-state.service';
import { BackendService } from '../../shared/services/backend.service';
import { VideoItem, ZoomBotTicket } from '../../shared/interfaces';
import { DurationPipe } from '../../shared/pipes/duration-pipe';

/** Videos table with selection, drag & drop reordering and per-row playback. */
@Component({
  selector: 'app-videos-table',
  imports: [CommonModule, CdkDropList, CdkDrag, CdkDragHandle, DurationPipe],
  templateUrl: './videos-table.layout.html',
  styleUrl: './videos-table.layout.css'
})
export class VideosTableLayout {
  readonly state = inject(HomeStateService);
  private readonly backend = inject(BackendService);

  private readonly normalizedQuery = computed(() => this.normalizeName(this.state.videoSearchQuery()));

  private normalizeName(name: string): string {
    // nogrep: js-incomplete-html-attribute-sanitization
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  get displayedVideos(): VideoItem[] {
    const query = this.normalizedQuery();
    return query
      ? this.orderedVideos.filter(video => this.normalizeName(this.getName(video.videoPath) ?? '').includes(query))
      : this.orderedVideos;
  }

  private get orderedVideos(): VideoItem[] {
    let list: VideoItem[] = [];
    let order: string[] = [];

    if (this.state.activeListId() === 'all') {
      list = [...this.state.videos];
      order = this.state.globalVideoOrder;
    } else {
      const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
      if (activeList) {
        order = activeList.videoPaths;
        list = this.state.videos.filter(v => order.includes(v.videoPath));
      } else {
        list = [...this.state.videos];
      }
    }

    if (order && order.length > 0) {
      list.sort((a, b) => {
        const indexA = order.indexOf(a.videoPath);
        const indexB = order.indexOf(b.videoPath);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }

    return list;
  }

  drop(event: CdkDragDrop<VideoItem[]>) {
    if (!this.state.reorderMode) return;
    const newDisplayed = [...this.displayedVideos];
    moveItemInArray(newDisplayed, event.previousIndex, event.currentIndex);

    // Replace only visible slots so filtering never removes hidden videos from the order.
    const visiblePaths = new Set(newDisplayed.map(v => v.videoPath));
    let visibleIndex = 0;
    const newOrder = this.orderedVideos.map(v => visiblePaths.has(v.videoPath)
      ? newDisplayed[visibleIndex++].videoPath
      : v.videoPath);
    if (this.state.activeListId() === 'all') {
      this.state.globalVideoOrder = newOrder;
    } else {
      const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
      if (activeList) activeList.videoPaths = newOrder;
    }
  }

  toggle(name: string) {
    this.state.selectedMap[name] = !this.state.selectedMap[name];
    this.state.selectedMap = { ...this.state.selectedMap };
  }

  async playSingle(v: VideoItem) {
    if (!this.state.botId) { this.state.err = 'Crea el bot primero'; return; }
    try {
      this.state.busyRow = v.videoPath;
      await this.state.updateConfig()
      if (v.duration == null) {
        try { v.duration = await this.loadDuration(v.videoUrl); } catch { }
      }
      const res: ZoomBotTicket = await this.backend.play(this.state.botId, 'video', v.videoUrl).toPromise() as ZoomBotTicket
      console.log('Playback response: ', res)
      this.state.botAction = res.action
      this.state.playbackId = res?.playback_id as string;
      this.state.updateConfig()
      //await this.backend.outputMedia(this.state.botId, v.videoUrl).toPromise();
    } catch (e: any) {
      this.state.err = e?.message ?? 'Error reproduciendo';
    } finally {
      this.state.busyRow = '';
      this.state.updateConfig()
    }
  }

  private loadDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
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
    return parts[1];
  }
}

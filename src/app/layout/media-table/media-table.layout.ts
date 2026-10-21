import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDropList, CdkDragHandle, CdkDragDrop } from '@angular/cdk/drag-drop';
import { HomeStateService } from '../../pages/home/home-state.service';
import { MediaItem, MediaTab } from '../../shared/interfaces';
import { DurationPipe } from '../../shared/pipes/duration-pipe';
import { TabsComponent } from '../../shared/components/tabs/tabs.component';
import { VideosMediaService } from './services/videos-media.service';
import { AudiosMediaService } from './services/audios-media.service';
import { DocsMediaService } from './services/docs-media.service';
import { DriveMediaService } from './services/drive-media.service';

@Component({
  selector: 'app-media-table',
  imports: [CommonModule, CdkDropList, CdkDrag, CdkDragHandle, DurationPipe, TabsComponent],
  providers: [VideosMediaService, AudiosMediaService, DocsMediaService, DriveMediaService],
  templateUrl: './media-table.layout.html',
  styleUrl: './media-table.layout.css',
})
export class MediaTableLayout {
  readonly state = inject(HomeStateService);
  readonly videos = inject(VideosMediaService);
  readonly audios = inject(AudiosMediaService);
  readonly docs = inject(DocsMediaService);
  readonly drive = inject(DriveMediaService);
  readonly tabs = [
    { id: 'videos', label: 'Videos' },
    { id: 'audios', label: 'Audios' },
    { id: 'docs', label: 'Docs' },
    { id: 'drive', label: 'Drive' },
  ];

  get service() { return this.state.activeTab() === 'audios' ? this.audios : this.videos; }
  get displayedMedia() { return this.service.displayedMedia; }
  get loading() { return this.state.activeTab() === 'audios' ? this.state.audioLoading : this.state.loading; }

  selectTab(id: string) {
    if (this.state.reorderMode || !this.tabs.some(tab => tab.id === id)) return;
    this.state.activeTab.set(id as MediaTab);
    if (id === 'drive') void this.drive.loadDriveFiles(false);
  }

  openDrive() { this.selectTab('drive'); }
  // Adapters create fresh view models; keep each row's DOM stable across checks.
  trackMediaPath(_index: number, item: MediaItem): string { return item.path; }

  drop(event: CdkDragDrop<MediaItem[]>) { this.service.drop(event); }
  toggle(path: string) { this.service.toggle(path); }
  playSingle(item: MediaItem) { return this.service.playSingle(item); }
  getName(path: string) { return this.service.getName(path); }
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDropList, CdkDragHandle } from '@angular/cdk/drag-drop';
import { HomeStore } from '../../pages/home/home.store';
import { DurationPipe } from '../../shared/pipes/duration-pipe';

/** Videos table with selection, drag & drop reordering and per-row playback. */
@Component({
  selector: 'app-videos-table',
  imports: [CommonModule, CdkDropList, CdkDrag, CdkDragHandle, DurationPipe],
  templateUrl: './videos-table.layout.html',
  styleUrl: './videos-table.layout.css'
})
export class VideosTableLayout {
  store = inject(HomeStore);

  getName(path: string): string {
    const parts = path.split('/');
    return parts[1];
  }
}

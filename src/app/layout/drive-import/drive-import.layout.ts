import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeStore } from '../../pages/home/home.store';

/** Collapsible Google Drive file browser with per-file import. */
@Component({
  selector: 'app-drive-import',
  imports: [CommonModule],
  templateUrl: './drive-import.layout.html',
  styleUrl: './drive-import.layout.css'
})
export class DriveImportLayout {
  store = inject(HomeStore);

  formatBytes(bytes?: number): string {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

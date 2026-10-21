import { Injectable, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeStateService } from '../../../pages/home/home-state.service';
import { BackendService } from '../../../shared/services/backend.service';
import { LoadingService } from '../../../shared/services/loading.service';
import { DriveFile } from '../../../shared/interfaces';

/** Collapsible Google Drive file browser with per-file import. */
@Injectable()
export class DriveMediaService {
  readonly state = inject(HomeStateService);
  private readonly backend = inject(BackendService);
  private readonly loadingService = inject(LoadingService);
  driveFiles: DriveFile[] = [];
  driveLoading = false;
  driveError = '';
  driveImportingId = '';
  private loaded = false;

  get filteredDriveFiles(): DriveFile[] {
    const query = this.state.driveSearchQuery().toLowerCase().trim();
    if (!query) return this.driveFiles;
    return this.driveFiles.filter(f => f.name.toLowerCase().includes(query));
  }

  async loadDriveFiles(expand: boolean = true) {
    if (this.driveLoading || (this.loaded && !expand)) return;

    this.driveLoading = true;
    this.driveError = '';
    try {
      const result = await this.backend.listDriveFiles().toPromise();
      this.driveFiles = result?.files ?? [];
      this.loaded = true;
    } catch (e: any) {
      this.driveError = e?.message ?? 'Error cargando archivos de Drive';
    } finally {
      this.driveLoading = false;
    }
  }


  async importDriveFile(file: DriveFile) {
    if (this.driveImportingId) return; // ya hay una importación en curso
    this.driveImportingId = file.id;
    this.driveError = '';
    this.loadingService.show();
    try {
      await this.backend.importDriveFile(file.id, file.name).toPromise();
    } catch (e: any) {
      this.driveError = e?.message ?? 'Error importando archivo';
    } finally {
      this.driveImportingId = '';
      this.loadingService.hide();
    }
  }

  formatBytes(bytes?: number): string {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

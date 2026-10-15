import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeStateService } from '../../pages/home/home-state.service';
import { BackendService } from '../../shared/services/backend.service';
import { LoadingService } from '../../shared/services/loading.service';
import { ModalService } from '../../shared/services/modal.service';
import { VideoListsService } from '../../shared/services/video-lists.service';
import { ZoomService } from '../../shared/services/zoom.service';

/** Stop playback, active list selector/delete and reorder controls. */
@Component({
  selector: 'app-global-actions',
  imports: [CommonModule, FormsModule],
  templateUrl: './global-actions.layout.html',
  styleUrl: './global-actions.layout.css'
})
export class GlobalActionsLayout {
  readonly state = inject(HomeStateService);
  private readonly backend = inject(BackendService);
  private readonly loadingService = inject(LoadingService);
  private readonly confirmService = inject(ModalService);
  private readonly videoListsService = inject(VideoListsService);
  private readonly zoom = inject(ZoomService);

  originalOrderBackup: string[] = [];

  async toggleReorder() {
    if (this.state.reorderMode) {
      // Guardar el orden
      this.loadingService.show();
      try {
        if (this.state.activeListId() === 'all') {
          await this.backend.setConfig({
            botId: this.state.botId,
            busyRow: this.state.busyRow,
            playing: this.state.playing,
            globalVideoOrder: this.state.globalVideoOrder
          });
        } else {
          const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
          if (activeList && activeList.id) {
            await this.videoListsService.updateList(activeList.id, { videoPaths: activeList.videoPaths });
          }
        }
      } catch (e: any) {
        this.state.err = e?.message ?? 'Error guardando el orden';
      } finally {
        this.loadingService.hide();
        this.state.reorderMode = false;
      }
    } else {
      if (this.state.activeListId() === 'all') {
        this.originalOrderBackup = [...this.state.globalVideoOrder];
      } else {
        const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
        this.originalOrderBackup = activeList ? [...activeList.videoPaths] : [];
      }
      this.state.reorderMode = true;
    }
  }

  cancelReorder() {
    if (this.state.activeListId() === 'all') {
      this.state.globalVideoOrder = [...this.originalOrderBackup];
    } else {
      const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
      if (activeList) activeList.videoPaths = [...this.originalOrderBackup];
    }
    this.state.reorderMode = false;
  }

  async deleteCurrentList() {
    if (this.state.activeListId() === 'all') return;

    let confirm = await this.confirmService.confirm('Confirmación', '¿Seguro que quieres borrar la lista actual?');
    if (!confirm) return;

    this.loadingService.show();
    try {
      await this.videoListsService.deleteList(this.state.activeListId());
      this.state.activeListId.set('all');
    } catch (e: any) {
      this.state.err = e?.message ?? 'Error borrando la lista';
    } finally {
      this.loadingService.hide();
    }
  }

  async stopNow() {
    if (!this.state.botId) return;
    try {
      await this.backend.stopMedia(this.state.botId).toPromise();
    } catch (e: any) {
      this.state.err = e?.message ?? 'Error deteniendo';
    } finally {
      this.state.playing = false;
      this.state.updateConfig()
    }
  }

  async shareApp() {
    await this.zoom.shareApp();
  }

}

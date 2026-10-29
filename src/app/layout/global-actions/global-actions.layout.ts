import { firstValueFrom } from 'rxjs';
import { ZoomBotService } from '../../shared/services/zoom-bot.service';
import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeStateService } from '../../pages/home/home-state.service';
import { BackendService } from '../../shared/services/backend.service';
import { LoadingService } from '../../shared/services/loading.service';
import { ModalService } from '../../shared/services/modal.service';
import { VideoListsService } from '../../shared/services/video-lists.service';
import { ZoomBotAction } from '../../shared/interfaces';
import { UtilsService } from '../../shared/services/utils.service';

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
  private readonly zoom = inject(ZoomBotService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadingService = inject(LoadingService);
  private readonly confirmService = inject(ModalService);
  private readonly videoListsService = inject(VideoListsService);
  protected readonly utils = inject(UtilsService);

  originalOrderBackup: string[] = [];

  async toggleReorder() {
    if (this.state.reorderMode) {
      // Guardar el orden
      this.loadingService.show();
      try {
        if (this.state.activeListId() === 'all') {
          await this.backend.setConfig({
            botId: this.state.botId,
            playing: this.state.playing,
            [this.state.activeTab() === 'audios' ? 'globalAudioOrder' : 'globalVideoOrder']: this.state.mediaOrder
          });
        } else {
          const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
          if (activeList && activeList.id) {
            await this.videoListsService.updateList(activeList.id, { [this.state.pathsKey]: activeList[this.state.pathsKey] ?? [] });
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
        this.originalOrderBackup = [...this.state.mediaOrder];
      } else {
        const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
        this.originalOrderBackup = activeList ? [...(activeList[this.state.pathsKey] ?? [])] : [];
      }
      this.state.reorderMode = true;
    }
  }

  cancelReorder() {
    if (this.state.activeListId() === 'all') {
      this.state.mediaOrder = [...this.originalOrderBackup];
    } else {
      const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
      if (activeList) activeList[this.state.pathsKey] = [...this.originalOrderBackup];
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

  async togglePause() {
    if (!this.utils.canPauseResume(this.state)) return;
    try {
      if (this.state.botAction == 'play' || this.state.botAction == 'resume') {
        const res = await this.backend.pause(this.state.botId, this.state.playbackId).toPromise()
        this.state.botAction = res?.action as ZoomBotAction
      } else {
        const res = await this.backend.resume(this.state.botId, this.state.playbackId).toPromise()
        this.state.botAction = res?.action as ZoomBotAction
      }
      this.state.updateConfig()
    } catch (e: any) {
      this.state.err = e?.message ?? 'Error deteniendo';
    }
  }

  async stopNow() {
    if (!this.state.botId) return;
    const preparing = this.state.syncPreparing || !!this.state.busyRow || (this.state.syncManaged && !this.state.syncFresh);
    const version = ++this.state.mediaRequestVersion;
    this.state.busyRow = '';
    this.state.mediaChangeMessage = 'Deteniendo reproducción y preparación…';
    try {
      const ticket = await firstValueFrom(this.backend.stop(this.state.botId, preparing ? undefined : this.state.playbackId));
      if (!ticket.operation_id) throw new Error('La API no devolvió operation_id');
      const deadline = Date.now() + 60000;
      while (version === this.state.mediaRequestVersion && !this.destroyRef.destroyed) {
        const operation = await firstValueFrom(this.zoom.getOperation(ticket.operation_id));
        if (version !== this.state.mediaRequestVersion || this.destroyRef.destroyed) return;
        if (operation.status === 'succeeded') {
          this.state.botAction = 'stop';
          this.state.playbackId = '';
          this.state.playing = false;
          this.state.mediaChangeMessage = 'Reproducción detenida.';
          await this.state.updateConfig();
          return;
        }
        if (operation.status === 'failed' || operation.status === 'cancelled') throw new Error(operation.error?.code ?? 'No se pudo detener');
        if (Date.now() >= deadline) throw new Error('No se pudo confirmar stop; consulta el estado del bot.');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error: any) {
      if (version === this.state.mediaRequestVersion) {
        this.state.err = error?.message ?? 'Error deteniendo';
        this.state.mediaChangeMessage = 'No se pudo confirmar la detención.';
      }
    }
  }
}

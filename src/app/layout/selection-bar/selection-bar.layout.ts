import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeStateService } from '../../pages/home/home-state.service';
import { BackendService } from '../../shared/services/backend.service';
import { LoadingService } from '../../shared/services/loading.service';
import { ModalService } from '../../shared/services/modal.service';
import { VideoListsService } from '../../shared/services/video-lists.service';
import { MediaItem } from '../../shared/interfaces';

/** Bulk actions over the selected videos (create list, add/remove from list, delete). */
@Component({
  selector: 'app-selection-bar',
  imports: [CommonModule, FormsModule],
  templateUrl: './selection-bar.layout.html',
  styleUrl: './selection-bar.layout.css'
})
export class SelectionBarLayout {
  readonly state = inject(HomeStateService);
  private readonly backend = inject(BackendService);
  private readonly loadingService = inject(LoadingService);
  private readonly confirmService = inject(ModalService);
  private readonly videoListsService = inject(VideoListsService);

  newListTitle = '';

  selectedList(): MediaItem[] {
    if (!['videos', 'audios'].includes(this.state.activeTab())) return [];
    return this.state.mediaItems.filter(v => this.state.selectedMap[v.path]);
  }

  async createNewList() {
    const queue = this.selectedList();
    if (queue.length === 0) return;
    if (!this.newListTitle.trim()) {
      this.state.err = 'Ingresa un nombre para la nueva lista';
      return;
    }
    this.state.err = '';
    this.loadingService.show();
    try {
      const paths = queue.map(v => v.path);
      await this.videoListsService.addList(this.newListTitle, this.state.pathsKey === 'videoPaths' ? paths : [], this.state.pathsKey === 'audioPaths' ? paths : []);
      this.newListTitle = '';
      this.state.selectedMap = {}; // clear selection
    } catch (e: any) {
      this.state.err = e?.message ?? 'Error creando lista';
    } finally {
      this.loadingService.hide();
    }
  }

  async addSelectedToList(listId: string) {
    const queue = this.selectedList();
    if (queue.length === 0 || !listId) return;

    const targetList = this.state.videoLists.find(l => l.id === listId);
    if (!targetList || !targetList.id) return;

    this.loadingService.show();
    try {
      const newPaths = [...(targetList[this.state.pathsKey] ?? [])];
      queue.forEach(v => {
        if (!newPaths.includes(v.path)) {
          newPaths.push(v.path);
        }
      });
      await this.videoListsService.updateList(targetList.id, { [this.state.pathsKey]: newPaths });
      this.state.selectedMap = {}; // clear selection
    } catch (e: any) {
      this.state.err = e?.message ?? 'Error agregando a la lista';
    } finally {
      this.loadingService.hide();
    }
  }

  async removeSelectedFromCurrentList() {
    if (this.state.activeListId() === 'all') return;
    const queue = this.selectedList();
    if (queue.length === 0) return;

    const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
    if (!activeList || !activeList.id) return;

    this.loadingService.show();
    try {
      const pathsToRemove = queue.map(v => v.path);
      const newPaths = (activeList[this.state.pathsKey] ?? []).filter(p => !pathsToRemove.includes(p));
      await this.videoListsService.updateList(activeList.id, { [this.state.pathsKey]: newPaths });
      this.state.selectedMap = {};
    } catch (e: any) {
      this.state.err = e?.message ?? 'Error removiendo de la lista';
    } finally {
      this.loadingService.hide();
    }
  }

  async deletedSelectedVideos() {

    let confirm = await this.confirmService.confirm('Confirmación', '¿Seguro que quieres borrar?')
    if (!confirm) return;

    const selected = this.selectedList();
    console.log('Delete selected videos:', selected);
    this.loadingService.show();
    try {
    for (const v of selected) {
      if (v.type === 'audio') await this.backend.deleteAudio(v.source.audioPath);
      else if (v.type === 'video') await this.backend.deleteVideo(v.source)
    }
    this.state.selectedMap = {};
    } catch(error: any) { this.state.err = error?.message ?? 'Error eliminando medios'; }
    finally { this.loadingService.hide(); }
  }

}
